# Bunnyshell Sandbox Control Panel

TypeScript control panel powered by `@hopx-ai/sdk`.

## UX/UI stack

- React + Vite frontend
- shadcn-style component primitives (`Button` with CVA + Radix Slot pattern)
- AI SDK Elements-inspired dark dashboard styling
- Integrated noVNC (`@novnc/novnc`) viewer for browser desktop access

## Features

- Create sandboxes
- Click-to-select sandbox context (no repeated sandbox ID entry)
- Start/stop/delete selected sandbox
- Filesystem browser + file content viewer
- Interactive terminal powered by xterm.js
- Environment variable get/set/delete
- VNC status/start/stop + connect in-browser via noVNC

## Setup

```bash
npm install
export HOPX_API_KEY="your_api_key"
npm run build
npm run dev
```

Open `http://localhost:3000`.

## Notes

- Backend API: `src/server.ts`
- Frontend app: `client/src`
