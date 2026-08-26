# FutureX Project Standards (CLAUDE.md)

_Unified guidelines for the Sovereign AI Agent operative._

## 🛠 Tech Stack
- **Frontend**: Next.js 14+ (App Router), TailwindCSS, Lucide Icons.
- **Backend**: NestJS for APIs, Prisma for database access.
- **Database**: SQLite (local dev), PostgreSQL (production-ready).

## 🧩 Architectural Principles
- **Dual Region Routing**: Always check `dbRouter.ts` for CN/GLOBAL region differences.
- **Agent Context**: Built-in agents must use their unique `agentId` (`futurex.*`) when creating records.
- **No Token Waste**: Prefer local tools (grep, find) over asking the LLM to guess file structures.

## 🦅 Personality Standards
- **Tone**: Professional, technical, concise.
- **Validation**: Every new API endpoint must be checked with a curl command after deployment.
- **Documentation**: Significant architectural changes or bugs found must be logged in `memory/` or `.learnings/`.

## 🔒 Privacy
- **Local First**: Never upload logs containing sensitive `API_KEY`s or database strings to external servers.
- **WhatsApp Policy**: Only interactive with the allowed list (+86...91).
