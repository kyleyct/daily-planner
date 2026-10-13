/**
 * Daily Planner — Web Push habit reminders (Cloudflare Worker)
 * Stores only subscription + schedule; never goal/review content.
 */
import { buildPushHTTPRequest } from '@pushforge/builder';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

const DEFAULT_TZ = 'Asia/Hong_Kong';

const COPY = {
  morning: {
    title: '訂今日目標',
    body: '花兩分鐘寫下今日目標。習慣比完成多少更重要。'
  },
  evening: {
    title: '今晚檢討',
    body: '回顧今日：完成了什麼、為什麼、明日可改進。檢討與計劃比分數重要。'
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS }
  });
}

function text(msg, status = 200) {
  return new Response(msg, { status, headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' } });
}

function normalizeSchedule(s) {
  const out = {
    morning: '08:00',
    evening: '21:00',
    morningOn: true,
    eveningOn: true,
    tz: DEFAULT_TZ
  };
  if (!s || typeof s !== 'object') return out;
  if (typeof s.morning === 'string' && /^\d{2}:\d{2}$/.test(s.morning)) out.morning = s.morning;
  if (typeof s.evening === 'string' && /^\d{2}:\d{2}$/.test(s.evening)) out.evening = s.evening;
  if (typeof s.morningOn === 'boolean') out.morningOn = s.morningOn;
  if (typeof s.eveningOn === 'boolean') out.eveningOn = s.eveningOn;
  if (typeof s.tz === 'string' && s.tz.length && s.tz.length < 64) out.tz = s.tz;
  return out;
}

function subKey(endpoint) {
  // Stable key from endpoint (KV key length limit ~512)
  let h = 2166136261;
  for (let i = 0; i < endpoint.length; i++) {
    h ^= endpoint.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hex = (h >>> 0).toString(16).padStart(8, '0');
  // Short suffix for uniqueness among rare collisions
  const tail = endpoint.slice(-24).replace(/[^a-zA-Z0-9]/g, '');
  return 'sub:' + hex + ':' + tail;
}

function parseSubscription(body) {
  const sub = body.subscription || body;
  if (!sub || typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('https://')) return null;
  const keys = sub.keys || {};
  if (typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') return null;
  return {
    endpoint: sub.endpoint,
    expirationTime: sub.expirationTime ?? null,
    keys: { p256dh: keys.p256dh, auth: keys.auth }
  };
}

/** HKT (or tz) calendar date YYYY-MM-DD and minutes since midnight */
function nowInTz(tz) {
  const zone = tz || DEFAULT_TZ;
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
  const parts = {};
  for (const p of fmt.formatToParts(new Date())) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  const date = parts.year + '-' + parts.month + '-' + parts.day;
  const minutes = parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10);
  return { date, minutes, hm: parts.hour + ':' + parts.minute };
}

function hmToMinutes(hm) {
  const m = /^(\d{2}):(\d{2})$/.exec(hm || '');
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/** True if current minutes fall in [slot, slot+5) — matches every-5-min cron windows */
function inSlotWindow(nowMin, slotHm) {
  const slot = hmToMinutes(slotHm);
  if (slot == null) return false;
  return nowMin >= slot && nowMin < slot + 5;
}

async function sendPush(env, subscription, kind) {
  const copy = COPY[kind] || COPY.morning;
  const privateJWK = env.VAPID_PRIVATE_KEY;
  const subject = env.VAPID_SUBJECT || 'mailto:noreply@example.com';
  if (!privateJWK) throw new Error('VAPID_PRIVATE_KEY secret missing');

  const { endpoint, headers, body } = await buildPushHTTPRequest({
    privateJWK: typeof privateJWK === 'string' ? privateJWK : JSON.stringify(privateJWK),
    subscription,
    message: {
      payload: {
        title: copy.title,
        body: copy.body,
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        tag: 'habit-' + kind,
        renotify: true,
        lang: 'zh-Hant-HK',
        data: { kind: kind }
      },
      adminContact: subject,
      options: { ttl: 3600, urgency: 'normal', topic: 'habit-' + kind }
    }
  });

  const res = await fetch(endpoint, { method: 'POST', headers, body });
  return res;
}

async function handleSubscribe(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }
  const subscription = parseSubscription(body);
  if (!subscription) return json({ error: 'invalid subscription' }, 400);
  const schedule = normalizeSchedule(body.schedule);
  const key = subKey(subscription.endpoint);
  let prev = null;
  try {
    prev = await env.SUBS.get(key, 'json');
  } catch (_) {}
  const record = {
    subscription,
    schedule,
    lastSent: (prev && prev.lastSent) || { morning: null, evening: null },
    updatedAt: new Date().toISOString()
  };
  await env.SUBS.put(key, JSON.stringify(record));
  return json({ ok: true, key });
}

async function handleUnsubscribe(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }
  const endpoint =
    (body.endpoint) ||
    (body.subscription && body.subscription.endpoint) ||
    null;
  if (!endpoint) return json({ error: 'endpoint required' }, 400);
  await env.SUBS.delete(subKey(endpoint));
  return json({ ok: true });
}

async function handleSchedule(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }
  const endpoint =
    (body.endpoint) ||
    (body.subscription && body.subscription.endpoint) ||
    null;
  if (!endpoint) return json({ error: 'endpoint required' }, 400);
  const key = subKey(endpoint);
  const prev = await env.SUBS.get(key, 'json');
  if (!prev || !prev.subscription) return json({ error: 'not subscribed' }, 404);
  prev.schedule = normalizeSchedule(body.schedule || Object.assign({}, prev.schedule, body));
  if (body.subscription) {
    const sub = parseSubscription(body);
    if (sub) prev.subscription = sub;
  }
  prev.updatedAt = new Date().toISOString();
  await env.SUBS.put(key, JSON.stringify(prev));
  return json({ ok: true });
}

async function runCron(env) {
  const list = await env.SUBS.list({ prefix: 'sub:', limit: 1000 });
  let sent = 0;
  let removed = 0;
  let checked = 0;

  for (const item of list.keys) {
    checked++;
    const rec = await env.SUBS.get(item.name, 'json');
    if (!rec || !rec.subscription || !rec.schedule) continue;

    const tz = rec.schedule.tz || DEFAULT_TZ;
    const { date, minutes } = nowInTz(tz);
    const last = rec.lastSent || { morning: null, evening: null };
    let dirty = false;

    for (const kind of ['morning', 'evening']) {
      const on = kind === 'morning' ? rec.schedule.morningOn !== false : rec.schedule.eveningOn !== false;
      const hm = kind === 'morning' ? rec.schedule.morning : rec.schedule.evening;
      if (!on || !inSlotWindow(minutes, hm)) continue;
      if (last[kind] === date) continue;

      try {
        const res = await sendPush(env, rec.subscription, kind);
        if (res.status === 404 || res.status === 410) {
          await env.SUBS.delete(item.name);
          removed++;
          dirty = false;
          break;
        }
        if (res.ok || res.status === 201) {
          last[kind] = date;
          dirty = true;
          sent++;
        } else {
          // 429 / 5xx — leave lastSent unset so a later cron in window can retry
          console.log('push failed', res.status, await res.text().catch(() => ''));
        }
      } catch (err) {
        console.log('push error', String(err && err.message ? err.message : err));
      }
    }

    if (dirty) {
      rec.lastSent = last;
      rec.updatedAt = new Date().toISOString();
      await env.SUBS.put(item.name, JSON.stringify(rec));
    }
  }

  // Paginate if needed
  let cursor = list.list_complete ? null : list.cursor;
  while (cursor) {
    const more = await env.SUBS.list({ prefix: 'sub:', limit: 1000, cursor });
    for (const item of more.keys) {
      // Same logic — recurse lightly by re-calling for remaining keys
      // Inline duplicate to avoid deep recursion; rare for personal use
      checked++;
      const rec = await env.SUBS.get(item.name, 'json');
      if (!rec || !rec.subscription || !rec.schedule) continue;
      const tz = rec.schedule.tz || DEFAULT_TZ;
      const { date, minutes } = nowInTz(tz);
      const last = rec.lastSent || { morning: null, evening: null };
      let dirty = false;
      for (const kind of ['morning', 'evening']) {
        const on = kind === 'morning' ? rec.schedule.morningOn !== false : rec.schedule.eveningOn !== false;
        const hm = kind === 'morning' ? rec.schedule.morning : rec.schedule.evening;
        if (!on || !inSlotWindow(minutes, hm)) continue;
        if (last[kind] === date) continue;
        try {
          const res = await sendPush(env, rec.subscription, kind);
          if (res.status === 404 || res.status === 410) {
            await env.SUBS.delete(item.name);
            removed++;
            dirty = false;
            break;
          }
          if (res.ok || res.status === 201) {
            last[kind] = date;
            dirty = true;
            sent++;
          }
        } catch (_) {}
      }
      if (dirty) {
        rec.lastSent = last;
        await env.SUBS.put(item.name, JSON.stringify(rec));
      }
    }
    cursor = more.list_complete ? null : more.cursor;
  }

  return { checked, sent, removed };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    try {
      if (request.method === 'GET' && (path === '/vapidPublicKey' || path === '/vapid')) {
        return json({ publicKey: env.VAPID_PUBLIC_KEY || '' });
      }
      if (request.method === 'GET' && path === '/') {
        return json({
          service: 'daily-planner-push',
          ok: true,
          endpoints: ['/vapidPublicKey', '/subscribe', '/unsubscribe', '/schedule']
        });
      }
      if (request.method === 'POST' && path === '/subscribe') return handleSubscribe(request, env);
      if (request.method === 'POST' && path === '/unsubscribe') return handleUnsubscribe(request, env);
      if (request.method === 'POST' && path === '/schedule') return handleSchedule(request, env);

      // Manual cron trigger for debugging (requires ?key=CRON_SECRET if set)
      if (request.method === 'POST' && path === '/run-cron') {
        if (env.CRON_SECRET && url.searchParams.get('key') !== env.CRON_SECRET) {
          return json({ error: 'forbidden' }, 403);
        }
        const result = await runCron(env);
        return json({ ok: true, ...result });
      }

      return json({ error: 'not found' }, 404);
    } catch (err) {
      console.log('fetch error', String(err && err.message ? err.message : err));
      return json({ error: 'server error' }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      runCron(env).then((r) => console.log('cron', JSON.stringify(r))).catch((e) => console.log('cron err', e))
    );
  }
};
