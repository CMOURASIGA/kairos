-- Extensoes
create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- Tabela de perfil do usuario
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  nome text,
  profissao text,
  estilo_comunicacao text,
  objetivos text,
  created_at timestamptz not null default now()
);

-- Conversas
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  titulo text not null default 'Nova conversa',
  created_at timestamptz not null default now()
);

-- Mensagens
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  specialist text not null default 'general',
  created_at timestamptz not null default now()
);

-- Memorias
create table if not exists memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tipo text not null,
  prioridade text not null check (prioridade in ('P0', 'P1', 'P2', 'P3', 'P4')),
  conteudo text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

-- Projetos
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  nome text not null,
  status text not null default 'ativo',
  descricao text,
  created_at timestamptz not null default now()
);

-- Decisoes
create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  titulo text not null,
  contexto text,
  motivo text,
  impacto text,
  status text not null default 'aberta',
  project_id uuid references projects(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Execucoes de agentes
create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  conversation_id uuid references conversations(id) on delete set null,
  specialist text not null,
  input_summary text,
  output_summary text,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_conversation_id on messages(conversation_id);
create index if not exists idx_memories_user_id on memories(user_id);
create index if not exists idx_decisions_user_id on decisions(user_id);
create index if not exists idx_memories_embedding_hnsw
  on memories using hnsw (embedding vector_cosine_ops);

create or replace function match_memories(
  user_uuid uuid,
  query_embedding text,
  match_threshold float default 0.45,
  match_count int default 5
)
returns table (
  id uuid,
  user_id uuid,
  tipo text,
  prioridade text,
  conteudo text,
  created_at timestamptz,
  similarity float
)
language sql
stable
as $$
  select
    m.id,
    m.user_id,
    m.tipo,
    m.prioridade,
    m.conteudo,
    m.created_at,
    1 - (m.embedding <=> query_embedding::vector(1536)) as similarity
  from memories m
  where m.user_id = user_uuid
    and m.embedding is not null
    and (1 - (m.embedding <=> query_embedding::vector(1536))) >= match_threshold
  order by m.embedding <=> query_embedding::vector(1536)
  limit greatest(match_count, 1);
$$;
