# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Includes an AI API with chat, image generation, and voice capabilities powered by OpenAI via Replit AI Integrations.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: OpenAI via Replit AI Integrations (`@workspace/integrations-openai-ai-server`)

## AI API Endpoints

All endpoints under `/api/openai/`:

- `GET /openai/conversations` — lista conversas
- `POST /openai/conversations` — cria conversa (body: `{title}`)
- `GET /openai/conversations/:id` — busca conversa com mensagens
- `DELETE /openai/conversations/:id` — deleta conversa
- `GET /openai/conversations/:id/messages` — lista mensagens
- `POST /openai/conversations/:id/messages` — envia mensagem de texto (SSE streaming)
- `POST /openai/conversations/:id/voice-messages` — envia áudio (SSE streaming, base64)
- `POST /openai/generate-image` — gera imagem (body: `{prompt, size?}`)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
