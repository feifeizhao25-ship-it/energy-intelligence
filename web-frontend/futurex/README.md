# FutureX Platform

FutureX is an AI Agent Operating System and Marketplace MVP.

## Features Built
- **Chat Interface**: The core interaction model (`/chat`) where users speak freely and the `intentAnalyzer` automatically maps their intent to an agent and executes it seamlessly.
- **Agent Store**: A marketplace (`/store`) where users can search, browse, and install/uninstall AI agents.
- **Developer Console**: A dashboard (`/dev`) for developers to create and publish agents using the FXAP/v1 protocol.
- **Merchant Console**: A no-code platform (`/merchant`) for businesses to quickly generate agents.
- **Social Feed**: A global feed (`/feed`) to see trending, popular, and new AI agents.
- **User Profiles**: Profiles (`/profile/[username]`) with sharing and follow capabilities.
- **Admin Panel**: A centralized dashboard (`/admin`) for platform moderation (Approve, Reject, Suspend agents).
- **Scheduler**: A cron script (`scripts/cron.ts`) to execute delayed tasks and update trending scores natively.

## Prerequisites
- Node.js 18+

## Setup & Run
1. Install dependencies
```bash
npm install
```

2. Setup database
```bash
npm run db:migrate
```

3. Start Scheduler Engine Server (Background Tasks)
```bash
npm run scheduler
```

4. Start Web Application 
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Architecture
- Dual DB Routing ready (currently targeting SQLite `dev.db`, set to Postgres URLs via `.env` in production)
- Prisma ORM v5
- Next.js 14 App Router
- TailwindCSS v3 (Dark mode, neon aesthetics)

Happy building on FutureX!
