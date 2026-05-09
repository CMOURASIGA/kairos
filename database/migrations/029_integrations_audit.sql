-- Auditoria operacional das integracoes (US-006 / US-029)
create table if not exists integration_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  integration_id text not null,
  level text not null check (level in ('debug', 'info', 'warn', 'error')),
  message text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists integration_executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  integration_id text not null,
  workflow_ref text,
  external_execution_id text,
  status text not null check (status in ('queued', 'running', 'success', 'error')),
  source text not null default 'api',
  payload jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_integration_logs_integration_created
  on integration_logs(integration_id, created_at desc);

create index if not exists idx_integration_logs_level_created
  on integration_logs(level, created_at desc);

create index if not exists idx_integration_executions_integration_started
  on integration_executions(integration_id, started_at desc);

create index if not exists idx_integration_executions_status_started
  on integration_executions(status, started_at desc);

