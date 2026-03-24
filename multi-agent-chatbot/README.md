# Multi-Agent Chatbot — Frontend

Next.js 15 frontend for the multi-agent chatbot system. Connects to the backend manager via REST and Socket.IO for real-time streaming responses.

## Stack

- **Next.js 15** — App Router, React 19
- **TypeScript** — strict mode
- **Tailwind CSS 4** — utility-first styling
- **shadcn/ui** — Radix UI component primitives
- **Socket.IO client** — real-time token streaming
- **next-themes** — dark/light mode

## Development

```bash
# from this directory
npm install
npm run dev     # starts on http://localhost:3002
```

> The backend manager must be running on port 3000. Start it from the repo root with `npm run dev`.

## Build

```bash
npm run build
npm start
```

## Environment

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend URL — defaults to `http://localhost:3000` |

Set in `.env.local` for local dev or pass as a build arg in Docker:

```bash
NEXT_PUBLIC_API_URL=https://your-backend.example.com npm run build
```

## Docker

Built via the 3-stage `Dockerfile` in this directory. The root `docker-compose.yml` manages it as the `frontend` service.

```bash
# from repo root
docker compose up frontend
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/login` | Login |
| `/signup` | Registration |
| `/chat` | Main chat interface |

## Features

- Real-time streaming responses via Socket.IO
- Conversation sidebar with history
- Agent selector — route to a specific agent or let the model router decide
- Team conversation mode — broadcast to multiple agents simultaneously
- Keyboard shortcuts (`?` to view all)
- Dark/light theme toggle
