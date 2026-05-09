# Kairos

Sistema cognitivo operacional pessoal com memoria contextual compartilhada.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase
- OpenAI API

## Requisitos

- Node.js 20+
- npm 10+

## Setup

```bash
npm install
cp .env.example .env.local
```

Preencha as variaveis obrigatorias no `.env.local`.

## Preenchimento do .env.local

Use estes valores:

- `NEXT_PUBLIC_APP_URL`: URL da app (local: `http://localhost:3000`)
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase `Project Settings > API > Project URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase `Project Settings > API > anon public`
- `OPENAI_API_KEY`: OpenAI Dashboard `API keys`
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase `Project Settings > API > service_role secret`
- `KAIROS_DEFAULT_USER_ID` (opcional): UUID de usuario padrao enquanto nao houver autenticacao
- `KAIROS_API_KEY` (opcional): se definido, APIs operacionais exigem `x-kairos-api-key` ou `Authorization: Bearer`
- `OPENAI_TTS_MODEL`: modelo de voz inicial (ex.: `gpt-4o-mini-tts`)
- `OPENAI_TTS_VOICE`: voz inicial (ex.: `sage`)
- `OPENAI_EMBEDDING_MODEL`: modelo para embeddings (ex.: `text-embedding-3-small`)
- `KAIROS_MEMORY_COMPRESSION_*`: parametros de compressao de memoria (opcionais)
- `KAIROS_PRIORITY_*`: parametros do sistema automatico de prioridade (opcionais)
- `KAIROS_DAILY_MODEL`: modelo opcional para enriquecimento automatico do Daily
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: base para Gmail/Calendar/Drive
- `GMAIL_ACCESS_TOKEN` / `GMAIL_USER_ID`: leitura segura server-side de emails no Gmail
- `GOOGLE_CALENDAR_ACCESS_TOKEN` / `GOOGLE_CALENDAR_ID`: leitura segura de eventos do Google Calendar
- `GOOGLE_DRIVE_ACCESS_TOKEN`: leitura segura de metadados de arquivos do Google Drive
- `AZURE_DEVOPS_ORG_URL` / `AZURE_DEVOPS_PAT` / `AZURE_DEVOPS_PROJECT`: base para Azure DevOps (projetos + work items)
- `N8N_BASE_URL` / `N8N_API_KEY` / `N8N_WEBHOOK_BASE_URL`: base para automacoes n8n (API e webhook)

Validacao rapida:

```bash
npm run env:check
```

Diagnostico via API:

- `GET /api/health/env` retorna quais variaveis faltam (sem expor valores).
- `GET /api/health/supabase` valida conexao real com Supabase.
- APIs operacionais aceitam `x-kairos-user-id` (UUID) para contexto do usuario e, quando `KAIROS_API_KEY` estiver definido, exigem autenticacao por header.
- `GET /api/integrations/health` executa healthcheck, logs e monitoramento da camada de integracoes.
- `GET /api/integrations/gmail/messages` retorna mensagens recentes (metadados) com leitura segura.
- `GET /api/integrations/google-calendar/events` retorna eventos futuros para acompanhamento operacional.
- `GET /api/integrations/google-drive/files` retorna arquivos acessiveis (metadados) respeitando permissoes do token.
- `GET /api/integrations/azure-devops/work-items` retorna projetos e work items para contexto operacional.
- `GET /api/integrations/n8n/flows` lista fluxos e historico monitorado de execucoes.
- `POST /api/integrations/n8n/flows` aciona fluxo n8n por API ou webhook.
- `GET /api/memories/relevant?q=...` retorna memorias relevantes para uma consulta contextual.

## Ativar Supabase no projeto

1. No painel Supabase, abra SQL Editor.
2. Execute o conteudo de `database/schema.sql`.
   - Para ambiente ja existente, execute tambem `database/migrations/017_embeddings.sql`.
   - Para campo de contexto em decisoes, execute `database/migrations/021_decision_context.sql`.
3. Rode `npm run dev`.
4. Valide:
   - `GET /api/health/env`
   - `GET /api/health/supabase`

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run env:check
```

## Escopo implementado nesta base

- Estrutura inicial de projeto
- Layout principal com navegacao
- Tela de Chat com selecao de especialista
- Botao "Ouvir resposta" no Chat (audio sob demanda)
- Endpoint `/api/chat` com validacao
- Endpoint `/api/voice` com OpenAI TTS (texto para voz)
- Embeddings OpenAI + busca semantica de memorias (pgvector)
- Memory Compression Engine com resumo automatico de memorias antigas
- Priority System com classificacao e descarte automatico
- Feedback explicito de memoria (util/nao util) para governanca contextual
- Endpoint dedicado de busca de memorias relevantes para diagnostico contextual
- Kairos Core inicial com roteamento basico
- Memory layer basico em memoria (in-memory)
- Tela Daily inicial com resumo operacional
- Camada base de integracoes desacopladas com monitoramento e logs
- Integracao Gmail com conexao, leitura segura de emails e logs operacionais
- Integracao Google Calendar com recuperacao de eventos e contextualizacao da agenda Daily
- Integracao Google Drive com acesso contextual a arquivos e controle de permissao por escopo/token
- Integracao Azure DevOps com projetos, work items e contexto operacional integrado no Daily
- Integracao n8n com fluxos acionaveis, logs e monitoramento de execucoes
- Estrutura inicial Supabase e OpenAI

## Banco (Supabase)

Schema inicial em:

- `database/schema.sql`
