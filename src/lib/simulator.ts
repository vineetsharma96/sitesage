/**
 * SiteSage — Client-Side Event Simulator
 * Simulates real-time WebSocket-style events for demo purposes.
 * Import and call initSimulator() in your page's client script.
 */

import { requestIncidentContext } from './incident-context-client';
export interface SimEvent {
  id: string;
  type: 'critical_incident' | 'warning' | 'resolved' | 'system';
  camera: string;
  cameraName: string;
  location: string;
  detection: string;
  confidence: number;
  timestamp: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

const EVENT_POOL: Omit<SimEvent, 'id' | 'timestamp'>[] = [
  { type:'critical_incident', camera:'CAM-04', cameraName:'Sector B — Crane Zone',  location:'Sector B',         detection:'No Hard Hat',        confidence:0.98, severity:'critical' },
  { type:'warning',           camera:'CAM-03', cameraName:'Sector B — Main Entry',  location:'Sector B',         detection:'Zone Proximity Alert',confidence:0.91, severity:'high' },
  { type:'critical_incident', camera:'CAM-01', cameraName:'North Tower — Level 08', location:'North Tower / L08',detection:'No Safety Vest',      confidence:0.93, severity:'critical' },
  { type:'warning',           camera:'CAM-06', cameraName:'Loading Bay — East',     location:'Loading Bay',      detection:'PPE Degradation',     confidence:0.85, severity:'high' },
  { type:'critical_incident', camera:'CAM-02', cameraName:'North Tower — Level 12', location:'North Tower / L12',detection:'Restricted Area Breach',confidence:0.96, severity:'critical' },
  { type:'warning',           camera:'CAM-05', cameraName:'South Tower — Gate',     location:'Gate C',           detection:'Unknown Personnel',   confidence:0.87, severity:'high' },
  { type:'resolved',          camera:'CAM-04', cameraName:'Sector B — Crane Zone',  location:'Sector B',         detection:'PPE Compliance Restored',confidence:0.99, severity:'low' },
  { type:'warning',           camera:'CAM-08', cameraName:'Perimeter — South',      location:'Perimeter',        detection:'Perimeter Anomaly',   confidence:0.82, severity:'medium' },
];

let eventCounter = 249; // starts after INC-0248 (shown in static data)

function makeEvent(): SimEvent {
  const template = EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)];
  const now = new Date();
  return {
    ...template,
    id: `INC-0${eventCounter++}`,
    timestamp: now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit' }),
  };
}

type EventCallback = (event: SimEvent) => void;
const listeners: EventCallback[] = [];

export function onSimEvent(cb: EventCallback) {
  listeners.push(cb);
}

function dispatch(event: SimEvent) {
  listeners.forEach(cb => cb(event));
  if (event.type !== 'resolved' && event.type !== 'system') void requestIncidentContext(event).catch(() => {});
}

// Public event emitter for demo mode "Simulate Critical Alert" button
export function simulateCriticalAlert() {
  const ev: SimEvent = {
    id: `INC-0${eventCounter++}`,
    type: 'critical_incident',
    camera: 'CAM-04',
    cameraName: 'Sector B — Crane Zone',
    location: 'North Tower / Sector B',
    detection: 'No Hard Hat',
    confidence: 0.98,
    timestamp: new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit' }),
    severity: 'critical',
  };
  dispatch(ev);
}

export function initSimulator(options?: { minInterval?: number; maxInterval?: number }) {
  const min = options?.minInterval ?? 8000;
  const max = options?.maxInterval ?? 20000;

  function scheduleNext() {
    const delay = min + Math.random() * (max - min);
    setTimeout(() => {
      dispatch(makeEvent());
      scheduleNext();
    }, delay);
  }

  // Expose globally for demo button
  (window as any).__sitesage_simulate_critical = simulateCriticalAlert;
  (window as any).__sitesage_simulator_active = true;

  scheduleNext();
}
