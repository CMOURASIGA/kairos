-- US-021 - Contexto operacional das decisoes

alter table if exists decisions
  add column if not exists contexto text;
