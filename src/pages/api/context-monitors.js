import { MONITOR_SOURCES } from '../../lib/context-monitors.js';
import { contextStore } from '../../lib/context-store.js';
export const prerender = false;
export async function GET() {
  const sources = await Promise.all(Object.entries(MONITOR_SOURCES).map(async ([topic, source]) => {
    try { const monitor = await contextStore.get(`monitor:${topic}`); return { topic, title: source.title, sourceUrl: source.url, configured: Boolean(monitor?.id), checkedAt: monitor?.checkedAt, changed: monitor?.changed || false, changes: monitor?.changes || [] }; }
    catch { return { topic, title: source.title, sourceUrl: source.url, configured: false, error: 'Storage unavailable' }; }
  }));
  return Response.json({ sources }, { headers: { 'Cache-Control': 'no-store' } });
}
