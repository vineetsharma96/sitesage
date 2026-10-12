import { timingSafeEqual } from 'node:crypto';
import { contextStore } from '../../lib/context-store.js';
import { recordMonitorRun, MONITOR_SOURCES } from '../../lib/context-monitors.js';
export const prerender = false;
export async function POST({ request, url }) {
  const expected = import.meta.env?.TINYFISH_WEBHOOK_SECRET || process.env.TINYFISH_WEBHOOK_SECRET;
  const token = url.searchParams.get('token') || '';
  if (!expected || Buffer.byteLength(expected) !== Buffer.byteLength(token) || !timingSafeEqual(Buffer.from(expected), Buffer.from(token))) return new Response('Unauthorized', { status: 401 });
  const raw = await request.text();
  if (raw.length > 256000) return new Response('Payload too large', { status: 413 });
  let run;
  try { run = JSON.parse(raw); } catch { return new Response('Invalid JSON', { status: 400 }); }
  try {
    for (const topic of Object.keys(MONITOR_SOURCES)) {
      const monitor = await contextStore.get(`monitor:${topic}`);
      if (monitor?.id && monitor.id === (topic === 'weather' ? run.search_monitor_id : run.fetch_monitor_id)) {
        if (monitor.lastRunId === run.id) return new Response('Already received');
        await recordMonitorRun(topic, run); return new Response('Received');
      }
    }
    return new Response('Unknown monitor', { status: 404 });
  } catch { return new Response('Monitor result unavailable', { status: 503 }); }
}
