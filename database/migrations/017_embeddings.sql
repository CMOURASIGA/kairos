-- US-017 - Embeddings + busca semantica

create extension if not exists "vector";

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
