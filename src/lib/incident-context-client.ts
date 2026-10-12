type Incident = { id?: string; detection?: string; severity?: string };
let current: Incident = {};
let version = 0;
let lastResult: any;
const topicFor = (text: string) => /fall|tether|height/i.test(text) ? 'fall' : /zone|buffer|gate|breach/i.test(text) ? 'zones' : 'ppe';
export async function requestIncidentContext(incident: Incident) {
  const response = await fetch('/api/incident-context', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: incident.id, topic: topicFor(incident.detection || ''), severity: incident.severity || 'critical' }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Context unavailable.');
  return result;
}
const setText = (id: string, text: string) => { const el = document.getElementById(id); if (el) el.textContent = text; };
function render(result: any) {
  lastResult = result;
  setText('context-status', result.status === 'ready' ? 'Live context / review required' : result.status === 'partial' ? 'Partial context' : 'Context unavailable');
  setText('context-meta', `${result.site.city} demo site · ${new Date(result.fetchedAt).toLocaleString()}`);
  setText('context-severity', `${result.severity.original.toUpperCase()} → ${result.severity.recommended.toUpperCase()} suggested`);
  setText('context-reason', result.severity.reason);
  setText('context-errors', result.errors.join(' '));
  setText('context-weather-note', result.weather?.note || 'Weather source unavailable. The original alert remains active.');
  const weather = document.getElementById('context-weather')!; weather.replaceChildren();
  result.weather?.advisories.forEach((item: any) => {
    const article = document.createElement('article');
    const a = document.createElement('a'); a.href = item.sourceUrl; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = `${item.title} ↗`;
    const meta = document.createElement('small'); meta.textContent = `${item.advisoryTypes.join(', ') || 'Advisory candidate'} · Published: ${item.publishedAt || 'unknown'} · Verify validity`;
    const p = document.createElement('p'); p.textContent = item.excerpt;
    article.append(a, meta, p); weather.append(article);
  });
  const link = document.getElementById('context-rule-link') as HTMLAnchorElement;
  link.hidden = !result.rule;
  if (result.rule) { link.href = result.rule.sourceUrl; link.textContent = `${result.rule.title} / US OSHA ↗`; }
  setText('context-rule-text', result.rule?.text || 'Rule source unavailable. Existing safety research is still available below.');
  setText('context-cache', [result.weather?.cached ? 'Weather reused from site cache' : 'Weather refreshed', result.rule?.cached ? 'Rule reused from cache' : 'Rule refreshed'].join(' · '));
  const accept = document.getElementById('context-accept') as HTMLButtonElement;
  accept.hidden = Boolean(result.review) || result.severity.original === result.severity.recommended;
  if (result.review) {
    const badge = document.getElementById('drawer-severity-badge');
    if (badge) { badge.textContent = result.review.severity.toUpperCase(); badge.className = 'badge badge-warning'; }
    setText('context-reason', `Escalation accepted ${new Date(result.review.acceptedAt).toLocaleString()}. Original severity retained in context.`);
  }
}
export async function loadIncidentContext(incident: Incident, refresh = false) {
  current = incident; const thisVersion = ++version;
  const panel = document.getElementById('incident-context-panel'); if (!panel) return;
  panel.hidden = false; panel.setAttribute('aria-busy', 'true'); lastResult = null;
  setText('context-status', 'Getting context…'); setText('context-meta', 'New Delhi demo site · Original alert available now');
  for (const id of ['context-severity', 'context-reason', 'context-errors', 'context-weather-note', 'context-rule-text', 'context-cache']) setText(id, '');
  document.getElementById('context-weather')!.replaceChildren();
  (document.getElementById('context-rule-link') as HTMLAnchorElement).hidden = true;
  (document.getElementById('context-accept') as HTMLButtonElement).hidden = true;
  const refreshButton = document.getElementById('context-refresh') as HTMLButtonElement; refreshButton.disabled = true;
  try {
    let result;
    if (!refresh) {
      const saved = await fetch(`/api/incident-context?incident=${encodeURIComponent(incident.id || '')}`).then(r => r.json());
      if (saved.context && saved.context.incident.topic === topicFor(incident.detection || '') && saved.context.incident.severity === incident.severity && Date.now() - Date.parse(saved.context.fetchedAt) < 15 * 60000) result = saved.context;
    }
    result ||= await requestIncidentContext(incident);
    if (thisVersion === version) render(result);
  } catch (error) { if (thisVersion === version) { setText('context-status', 'Context unavailable'); setText('context-errors', `${(error as Error).message} The original alert remains active.`); } }
  finally { if (thisVersion === version) { panel.setAttribute('aria-busy', 'false'); refreshButton.disabled = false; } }
}
export function initContextControls() {
  document.getElementById('context-refresh')?.addEventListener('click', () => loadIncidentContext(current, true));
  document.getElementById('context-accept')?.addEventListener('click', async () => {
    if (!lastResult) return;
    const incidentId = lastResult.incident.id; const thisVersion = version;
    const button = document.getElementById('context-accept') as HTMLButtonElement; button.disabled = true;
    try {
      const response = await fetch('/api/context-review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: incidentId, confirmed: true }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      if (thisVersion === version) { lastResult.review = data.review; render(lastResult); }
    } catch (error) { if (thisVersion === version) setText('context-errors', (error as Error).message); }
    finally { button.disabled = false; }
  });
  document.getElementById('context-download')?.addEventListener('click', () => {
    if (!lastResult) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(lastResult, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `${lastResult.incident.id}-context.json`; link.click(); URL.revokeObjectURL(url);
  });
}
