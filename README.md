# incident-copilot

<img width="1548" height="1306" alt="image" src="https://github.com/user-attachments/assets/9c4da9b3-d192-4540-b55b-d5821f91b0d8" />

AI-powered incident-response dashboard built with **CopilotKit** + **OpenAI**. Triage cybersecurity incidents conversationally, fill report forms via human-in-the-loop chat, drill into per-incident analysis and cross-incident timelines, and view charts over a decade of global cybersecurity threats (2015–2024).

## Stack
- **Frontend:** React + TypeScript + Vite, CopilotKit (`@copilotkit/react-core`, `@copilotkit/react-ui`), Recharts
- **Backend:** Node + Express + `@copilotkit/runtime` with the OpenAI adapter
- **LLM:** OpenAI via `OpenAIAdapter`
- **Data:** [Global Cybersecurity Threats (2015–2024)](https://www.kaggle.com/datasets/atharvasoundankar/global-cybersecurity-threats-2015-2024/data) (see `README_DATASET.md`)
- **Tests:** Vitest + Testing Library

## Run it

### Prerequisites
- Node.js 20.19+ or 22.12+
- pnpm — [install](https://pnpm.io/installation)
- An OpenAI API key

### Setup
```bash
git clone https://github.com/NathanTarbert/incident-copilot.git
cd incident-copilot
pnpm install
cp .env.example .env       # then paste your OPENAI_API_KEY
```

### Start both servers
```bash
pnpm dev:all
```
- Frontend: http://localhost:5173 (Vite)
- Backend:  http://localhost:4000/copilotkit (CopilotKit runtime)

### Or run them separately
```bash
pnpm dev:server      # one terminal — Express + runtime
pnpm dev             # another — Vite
```

### Tests
```bash
pnpm test            # one-shot
pnpm test:watch      # watch mode
```

## What's in the app

- **Incidents list & detail** — severities P0–P4, statuses Open / Investigating / Mitigated / Resolved, with sorting and filtering.
- **AI sidebar** — `CopilotSidebar` chat that can read app state and trigger frontend tools.
- **Conversational incident reporting** — the AI fills a structured `ChatIncidentForm` in-chat, the user reviews and submits (classic HITL pattern).
- **Tool calls visualized** — runbook execution cards, analysis panels, and cross-incident timelines render inline from tool results.
- **Charts** — Recharts-powered incident charts over the cybersecurity-threats dataset.

## How CopilotKit is wired

The frontend wraps the app in `<CopilotKit runtimeUrl="http://localhost:4000/copilotkit">` and a `<CopilotSidebar>`. Three integration points carry the work:

- **`useCopilotReadable`** — shares the live incidents list and selection state with the agent.
- **`useFrontendTool`** — registers ~9 tools the agent can call (report/resolve/clear incidents, fill the chat form, navigate to a detail view, run a runbook, etc.).
- **`useRenderToolCall`** — renders custom React UI for specific tool calls (runbook cards, analysis panels) directly inside the chat thread.

The backend (`server.js`) mounts `copilotRuntimeNodeHttpEndpoint` on `/copilotkit` with the `OpenAIAdapter` so each request reaches OpenAI with the latest app context attached.

## Project layout

```
incident-copilot/
├── server.js                       # Express + CopilotKit runtime + OpenAI adapter
├── src/
│   ├── App.tsx                     # CopilotKit provider, sidebar, frontend tools
│   ├── components/
│   │   ├── IncidentsList.tsx       # Sort + filter incidents
│   │   ├── IncidentDetail.tsx      # Per-incident detail view
│   │   ├── ChatIncidentForm.tsx    # HITL form rendered inside the sidebar
│   │   ├── CrossIncidentTimeline.tsx
│   │   ├── AnalysisPanel.tsx
│   │   ├── RunbookExecutionCard.tsx
│   │   └── charts/IncidentCharts.tsx
│   ├── services/
│   │   ├── incidentDatabase.ts     # In-memory store
│   │   └── mockApi.ts              # Async wrapper
│   ├── data/                       # Cybersecurity threats dataset
│   └── types/incident.ts
├── README_DATASET.md               # How the dataset is wired in
└── package.json
```

## Configuration

| Variable | Description | Required |
|---|---|---|
| `OPENAI_API_KEY` | Used by the runtime's OpenAI adapter. | Yes |

The backend port (`4000`) and the frontend's `runtimeUrl` are matched in `server.js` and `src/App.tsx` — change both if you need a different port.

## Deploy to Render

Deploys as **one Node web service** that serves both the Vite build and the `/copilotkit` runtime on the same origin — no CORS, no second deploy pipeline. The free tier works (no credit card required).

1. Render dashboard → **New +** → **Web Service** → connect this GitHub repo → branch `main`.
2. **Settings:**
   - **Language:** Node
   - **Build Command:**
     ```
     npx --yes pnpm@latest install --frozen-lockfile --config.dangerously-allow-all-builds=true && npx --yes pnpm@latest build
     ```
   - **Start Command:** `npx --yes pnpm@latest start`
   - **Instance Type:** Free
3. **Environment variables** (Advanced):
   - `NODE_ENV` = `production`
   - `VITE_COPILOTKIT_RUNTIME_URL` = `/copilotkit`
   - `OPENAI_API_KEY` = *your key*
4. **Create Web Service** — first build is ~3–5 minutes; live at `https://<your-service>.onrender.com`.

Under the hood:
- `pnpm build` produces `dist/`.
- `pnpm start` (= `NODE_ENV=production node server.js`) binds to Render's `$PORT`, serves `dist/` as static, mounts `/copilotkit`, and falls back to `index.html` for client-side routes.
- `VITE_COPILOTKIT_RUNTIME_URL=/copilotkit` makes the Vite build emit a same-origin runtime URL.

Why `npx pnpm` instead of `npm install -g pnpm`: Render's `/usr/lib/node_modules` is read-only, so the `-g` install fails with EROFS. `npx` caches pnpm under the writable home dir, no globals needed.

Why `--config.dangerously-allow-all-builds=true`: pnpm 11 requires explicit approval before running postinstall scripts for new packages (`@scarf/scarf`, `esbuild`) and exits non-zero with `ERR_PNPM_IGNORED_BUILDS` otherwise. The flag pre-approves them in CI where there's no human to prompt.

Free-tier caveat: the service spins down after ~15 minutes of no traffic; the next request takes ~30s to wake it up.

To run a production build locally:
```bash
pnpm build
OPENAI_API_KEY=sk-... pnpm start    # serves both at http://localhost:4000
```

## Troubleshooting

- **`Agent 'default' not found`** — make sure `pnpm dev:server` is running and the `runtimeUrl` in `App.tsx` matches.
- **`OPENAI_API_KEY is not set`** — populate `.env` and restart the server.
- **Port 4000 already in use** — `lsof -ti:4000 | xargs kill -9`.

## Learn more

- [CopilotKit docs](https://docs.copilotkit.ai/)
- [OpenAI API](https://platform.openai.com/docs/)
