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

## Finance API Endpoints

All endpoints under `/api/finance/`:

### Transações Bilionárias
- `GET /finance/transactions` — lista transações (filtros: type, status, gateway)
- `POST /finance/transactions` — registra transação + análise automática de risco por IA
- `GET /finance/transactions/:id` — detalhe da transação
- `POST /finance/transactions/:id/analyze` — re-analisa com IA (SSE streaming)
- `POST /finance/transactions/batch-analyze` — análise em lote de até 50 transações
- `GET /finance/transactions/summary` — agregados: volume, risco médio, por tipo/status/gateway

### Gateways de Pagamento
- `GET /finance/gateways` — lista gateways registrados
- `POST /finance/gateways` — cadastra gateway (Stripe, Adyen, PagSeguro, MercadoPago, etc.)
- `GET /finance/gateways/:id` — detalhe do gateway
- `POST /finance/gateways/:id/analyze` — análise de performance por IA (SSE streaming)

### Mercado / Ativos
- `GET /finance/market` — lista ativos monitorados (filtro: assetType)
- `POST /finance/market` — cadastra ativo (ações, crypto, forex, commodities, índices)
- `POST /finance/market/:id/analyze` — análise técnica + sinal de operação por IA (SSE streaming)
- `POST /finance/market/overview` — morning call / visão geral da carteira (SSE streaming)

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
