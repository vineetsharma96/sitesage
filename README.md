# SiteSage — AI-Powered Construction Safety Command Center

[![Astro](https://img.shields.io/badge/Astro-5.0+-orange.svg)](https://astro.build)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Safety Standard](https://img.shields.io/badge/OSHA-29_CFR_1926-green.svg)](https://www.osha.gov)

SiteSage is a construction safety UI prototype built around an edge-first AI concept. The current app simulates camera scenes, detections, operational metrics and incident workflows. Its TinyFish research workspace reads official safety sources through a live web agent. Production RTSP ingestion, computer vision accuracy and field performance remain to be validated.

Read [prototype and TinyFish setup notes](docs/prototype-notes.md) for configuration, verification and HackIIITD submission context.

The additional `/context` workspace attaches TinyFish Search weather sources and Fetch rule text to incident evidence. Original alerts appear immediately; cached context and human-reviewed escalation are saved locally in development or in PostgreSQL when configured. Native daily rule/advisory monitors and their webhook receiver are included; see the setup notes to register them. The existing `/research` Agent/SSE workflow remains available.

---

## 🏗️ Core Architecture & Features

### 1. Unified Command Center (`/dashboard`)
* **Real-Time Video HUD**: Simulated multi-worker detection canvas with real-time bounding boxes (Hard Hat, High-Vis Vest, Exclusion Zones).
* **Incident Investigation Drawer**: Deep-dive triage with forensic timestamping, confidence rating, CCTV snapshot evidence, and supervisor actions.
* **Operational Metric Strip**: Site-wide compliance score, active worker headcounts, high-risk exclusion zone breaches, and camera stream health.

### 2. Multi-Camera Live Monitoring (`/monitoring`)
* **8-Camera Operational Grid**: Live scanning visualizers with per-camera threat levels (`Critical`, `High`, `Medium`, `Low`).
* **Interactive Threat Overlays**: Real-time bounding boxes and rapid incident escalation links.

### 3. Geofence & Safety Zone Designer (`/zones`)
* **Interactive Polygon Canvas**: Vector polygon editor to define exclusion zones, crane swing perimeters, and high-voltage areas directly over camera views.
* **Zone Rules Engine**: Custom dwell-time limits, PPE prerequisites, and automated alert triggering.

### 4. Camera Network Telemetry (`/cameras`)
* **Edge Node Registry**: Detailed telemetry on 27 RTSP streams, including bitrate, latency jitter, packet loss, and hardware models (Axis, Bosch, Hanwha).
* **Stream Diagnostics & Provisioning**: Camera onboarding wizard and live packet stability waveform diagnostics.

### 5. Compliance & OSHA Reports (`/reports`)
* **Official Regulatory Dossiers**: OSHA 1926 Subpart C/E compliance packages, Daily Shift Safety Briefings, and forensic video archives.
* **Subcontractor Safety League**: Automatic compliance scoring and violation tracking by contractor.
* **Cryptographic Sign-Off**: HMAC-SHA256 verified digital audit trail.

### 6. AI Rules Engine & Settings (`/settings`)
* **Confidence Sliders**: Granular thresholds for Hard Hat (85%), Safety Vest (80%), Geofence Breach (92%), and Proximity Warnings (75%).
* **Edge Hardware Monitor**: NVIDIA TensorRT INT8 GPU allocation, temperature, and inference FPS metrics.
* **Dispatch Webhooks**: Automated push to WebSockets, Twilio SMS, Motorola MOTOTRBO Radio TTS, and Slack.

---

## 🚀 Quick Start

### Prerequisites
* **Node.js**: v22.12.0 or higher
* **npm**: v9.0.0 or higher

### Installation
```bash
# Clone the repository
git clone https://github.com/vineetsharma96/sitesage.git
cd sitesage

# Install dependencies
npm install

# Start development server
npm run dev -- --background
```

Navigate to `http://localhost:4321` in your browser.

---

## 📁 Project Structure

```text
SiteSage/
├── public/
│   └── favicon.svg           # Industrial CV aperture favicon
├── src/
│   ├── layouts/
│   │   └── Layout.astro      # Main app shell with navigation and incident drawer
│   ├── styles/
│   │   └── global.css        # Command center dark design system & tokens
│   └── pages/
│       ├── index.astro       # Landing & showcase page
│       ├── dashboard.astro   # Main Command Center
│       ├── monitoring.astro  # 8-camera grid overview
│       ├── incidents.astro   # Incident investigation database
│       ├── zones.astro       # Safety zone polygon designer
│       ├── cameras.astro     # Camera network & telemetry
│       ├── analytics.astro   # Safety metrics & heatmaps
│       ├── reports.astro     # OSHA compliance & report exporter
│       ├── settings.astro    # AI rules engine & dispatch webhooks
│       └── geofence.astro    # Redirect to /zones
├── astro.config.mjs
├── package.json
└── README.md
```

---

## 🎨 Industrial Design System

Built on a command dark palette tailored for high-contrast industrial environments:
* **Background Canvas**: `#0B1220` (Deep Command Navy)
* **Surface Containers**: `#111827` (Slate Surface)
* **Primary Interactive**: `#2563EB` / `#3B82F6` (Action Blue)
* **Safety Status**:
  * Compliant / Safe: `#10B981`
  * Warning / Degraded: `#F59E0B`
  * Critical / Breach: `#EF4444`

---

## 📄 License
This project is licensed under the MIT License.
