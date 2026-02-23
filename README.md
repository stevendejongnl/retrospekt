# Retrospekt 🥓

A simple, self-hosted retrospective board. Built as a replacement for retrotool.io.

**retro_spek_t** — *spek* is Dutch for bacon.

## Features

- UUID-based sessions — no accounts, no login
- Share a URL to collaborate in real time
- Three default columns: Went Well, To Improve, Action Items
- Per-session name (remembered in localStorage)
- Vote on cards (idempotent, one vote per participant per card)
- Facilitator controls: collecting → discussing → closed phases
- Real-time updates via Server-Sent Events (auto-reconnects)

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite + Lit + TypeScript |
| Backend | Python FastAPI + uv |
| Database | MongoDB (Motor async driver) |
| Real-time | Server-Sent Events (SSE) |
| Deployment | Docker Compose / Kubernetes |

## Running locally

```bash
make start        # builds images and starts MongoDB + backend + frontend
make logs         # tail logs from all services
make stop         # stop everything
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3001 |
| Backend API | http://localhost:8001 |
| Health check | http://localhost:8001/health |

## API

```
GET  /health

POST   /api/v1/sessions                              create session
GET    /api/v1/sessions/{id}                         get session (no facilitator_token)
POST   /api/v1/sessions/{id}/join                    join session (adds participant)
POST   /api/v1/sessions/{id}/phase                   advance phase (X-Facilitator-Token required)
GET    /api/v1/sessions/{id}/stream                  SSE stream

POST   /api/v1/sessions/{id}/cards                   add card
DELETE /api/v1/sessions/{id}/cards/{card_id}         delete own card
POST   /api/v1/sessions/{id}/cards/{card_id}/votes   vote (idempotent)
DELETE /api/v1/sessions/{id}/cards/{card_id}/votes   remove vote
```

Every mutation broadcasts the full updated session JSON to all connected SSE clients.

## Session lifecycle

1. Open the app → enter session name + your name → **Create session**
2. Share the URL with your team
3. Everyone enters their name on first visit
4. Add cards to the three columns during the **Collecting** phase
5. Facilitator moves to **Discussing** — vote on cards that matter most
6. Facilitator **Closes** the session when done

Only the creator (identified by `facilitator_token` in localStorage) sees the phase controls.

## Development

```bash
make install      # uv sync + npm install
make test         # pytest
make lint         # ruff
make typecheck    # tsc --noEmit
```

## Deployment

A `kubernetes.yaml` is included with Namespace, Deployments, Services, and an Ingress pointing to `retrospekt.steven-dejong.nl`. The Ingress sets `proxy-buffering: off` and a long `proxy-read-timeout` to keep SSE connections alive through nginx.

Create the MongoDB secret before applying:

```bash
kubectl create secret generic retrospekt-mongodb-secret \
  --namespace retrospekt \
  --from-literal=mongodb-url='mongodb+srv://...'

kubectl apply -f kubernetes.yaml
```
