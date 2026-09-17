# Synapse — Student Skill-Based Collaboration & Peer Discovery Platform

A web application where college students create profiles showcasing their work, skills, and interests, then discover and connect with other students for skill-based project collaboration and shared event participation.

## Features

- **Profile System** — Showcase skills, interests, and work items with a completeness meter
- **Dual Recommendation Engine**
  - *Second-Degree Connections* — Discover friends-of-friends with round-robin interleaving for diversity
  - *Skill/Interest Similarity* — Find students with overlapping expertise, prioritizing same college
- **Search & Filters** — In-place search on the recommendations page with multi-filter support
- **Groups** — Create and manage collaboration teams
- **Boards** — Post group openings and find groups looking for your skills
- **Connection System** — Send/accept/decline connection requests with symmetric edge tracking

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, TailwindCSS 4, React Router 7, TanStack Query 5 |
| Backend | Node.js, Express 5, TypeScript 7 |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Background Jobs | BullMQ 6 |
| Auth | JWT (access + refresh tokens, rotating) |

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (for PostgreSQL and Redis)

### 1. Start Infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL (port 5432) and Redis (port 6379).

### 2. Server Setup

```bash
cd server
cp .env.example .env   # Edit as needed
npm install
npm run migrate         # Create database tables
npm run seed            # Populate skills, interests, colleges
npm run dev             # Start dev server on port 3001
```

### 3. Client Setup

```bash
cd client
npm install
npm run dev             # Start Vite dev server on port 5173
```

### 4. Background Worker (optional)

```bash
cd server
npm run worker          # Start BullMQ worker for recommendation jobs
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  React Frontend │────▶│  Express API    │
│  (Vite, :5173)  │     │  (:3001)        │
└─────────────────┘     └────────┬────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
              ┌─────▼─────-┐ ┌───▼───┐ ┌─────-▼────┐
              │ PostgreSQL │ │ Redis │ │  BullMQ   │
              │  (:5432)   │ │(:6379)│ │  Worker   │
              └────────────┘ └───────┘ └───────────┘
```

## API Endpoints

### Auth
- `POST /api/auth/signup` — Register (email domain validates college)
- `POST /api/auth/login` — Login
- `POST /api/auth/refresh` — Rotate refresh token
- `POST /api/auth/logout`

### Users
- `GET /api/users/me` — Own profile
- `PUT /api/users/me` — Update profile
- `GET /api/users/:id` — View profile
- `POST/DELETE /api/users/me/skills/:skillId`
- `POST/DELETE /api/users/me/interests/:interestId`
- `POST/PUT/DELETE /api/users/me/work/:id`
- `GET /api/users/skills?q=` — Skill typeahead
- `GET /api/users/interests?q=` — Interest typeahead

### Connections
- `POST /api/connections/request`
- `POST /api/connections/:id/accept`
- `POST /api/connections/:id/decline`
- `DELETE /api/connections/:id`
- `GET /api/connections` — List connections (paginated)
- `GET /api/connections/pending`
- `GET /api/connections/mutual/:userId`

### Recommendations
- `GET /api/recommendations/second-degree?cursor=&limit=30`
- `GET /api/recommendations/similarity?cursor=&limit=30`

### Search
- `GET /api/search/users?q=&skills[]=&interests[]=&match_mode=any|all&college_id=&year=&looking_for=`

### Groups
- `POST /api/groups`
- `GET /api/groups/me`
- `GET /api/groups/:id`
- `PUT /api/groups/:id`
- `DELETE /api/groups/:id/members/:userId`
- `POST /api/groups/:id/members/:userId/promote`

### Boards
- `GET /api/boards/global` — All open postings
- `GET /api/boards/matched` — Postings matching your skills
- `POST /api/boards/postings`
- `POST /api/boards/postings/:id/request` — Join request
- `POST /api/boards/join-requests/:id/approve`
- `POST /api/boards/join-requests/:id/reject`
- `GET /api/boards/my-requests`

## Project Structure

```
├── docker-compose.yml
├── server/
│   ├── src/
│   │   ├── config/          # DB, Redis, Queue, Env, Scoring weights
│   │   ├── db/              # Migrations and seeds
│   │   ├── middleware/      # Auth, validation, rate limiting, errors
│   │   ├── modules/         # Feature modules (auth, users, connections, recommendations, search, groups, boards)
│   │   ├── jobs/            # BullMQ worker and scheduler
│   │   ├── utils/           # Pagination, errors, profile completeness
│   │   └── types/           # Shared TypeScript types
│   └── scripts/             # Migration and seed runners
├── client/
│   ├── src/
│   │   ├── api/             # Axios API client modules
│   │   ├── components/      # Reusable UI components
│   │   ├── context/         # Auth context
│   │   ├── hooks/           # Custom hooks
│   │   ├── pages/           # Route pages
│   │   ├── lib/             # Utilities
│   │   └── types/           # Frontend types
│   └── public/
└── README.md
```

## License

Private — All rights reserved.
