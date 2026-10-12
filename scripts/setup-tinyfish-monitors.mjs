import { contextStore } from '../src/lib/context-store.js';
import { recordMonitorRun, MONITOR_SOURCES } from '../src/lib/context-monitors.js';
const { TINYFISH_API_KEY, TINYFISH_WEBHOOK_SECRET, SITESAGE_PUBLIC_URL, DATABASE_URL } = process.env;
if (!TINYFISH_API_KEY || !TINYFISH_WEBHOOK_SECRET || !SITESAGE_PUBLIC_URL || !DATABASE_URL) throw new Error('Set TINYFISH_API_KEY, TINYFISH_WEBHOOK_SECRET, SITESAGE_PUBLIC_URL and DATABASE_URL before enabling daily monitors.');
const callback = new URL('/api/tinyfish-monitor-webhook', SITESAGE_PUBLIC_URL);
if (callback.protocol !== 'https:' || /localhost|127\.0\.0\.1/.test(callback.hostname)) throw new Error('Monitors need a public HTTPS backend.');
callback.searchParams.set('token', TINYFISH_WEBHOOK_SECRET);
for (const [topic, source] of Object.entries(MONITOR_SOURCES)) {
  if ((await contextStore.get(`monitor:${topic}`))?.id) { console.log(`${source.title}: already registered`); continue; }
  const response = await fetch('https://agent.tinyfish.ai/v1/monitors', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': TINYFISH_API_KEY },
    body: JSON.stringify({ type: source.type, name: `SiteSage / ${source.title}`, config: source.config, schedule_cron: 'CRON_TZ=Asia/Kolkata 0 7 * * *', purpose: 'Construction safety rule or weather advisory changes requiring human review.', webhook_url: callback.toString() }),
    signal: AbortSignal.timeout(150000),
  });
  if (!response.ok) throw new Error(`Monitor creation failed (${response.status}). Check TinyFish before retrying.`);
  const data = await response.json();
  if (!data.monitor?.id) throw new Error('Monitor response missing its ID. Inspect TinyFish before retrying.');
  await contextStore.put(`monitor:${topic}`, { id: data.monitor.id, sourceUrl: source.url, title: source.title });
  if (data.run) await recordMonitorRun(topic, data.run);
  console.log(`${source.title}: daily monitor registered`);
}
