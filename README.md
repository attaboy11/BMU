# BMU Fault Finder

BMU Fault Finder is an app to help façade-access / BMU engineers diagnose faults, identify parts, and document callouts on site.

## What this project is for

- Symptom → likely fault suggestions
- Parts identification (components, part numbers, locations)
- Step-by-step troubleshooting flows
- Job notes you can copy into service reports

## Tech stack (planned)

- Front end: React + TypeScript (mobile-first, works on phone)
- Back end: Node.js + TypeScript (REST API)
- Data: JSON / simple database of BMU models, subsystems, components, and fault flows

## Status

MVP in progress. Initial goal: usable demo for Alimak engineers to test on real callouts.

## Getting started (future)

```bash
git clone https://github.com/attaboy11/BMU.git
cd BMU
npm install
npm run dev
