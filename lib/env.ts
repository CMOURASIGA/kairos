type PublicEnv = {
  NEXT_PUBLIC_APP_URL: string;
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
};

type ServerEnv = PublicEnv & {
  OPENAI_API_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

export const PUBLIC_ENV_KEYS: Array<keyof PublicEnv> = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

export const SERVER_ENV_KEYS: Array<keyof ServerEnv> = [
  ...PUBLIC_ENV_KEYS,
  "OPENAI_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

function getEnvValue(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function getPublicEnv(): PublicEnv {
  return {
    NEXT_PUBLIC_APP_URL: getEnvValue("NEXT_PUBLIC_APP_URL"),
    NEXT_PUBLIC_SUPABASE_URL: getEnvValue("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: getEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}

export function getServerEnv(): ServerEnv {
  const env: ServerEnv = {
    ...getPublicEnv(),
    OPENAI_API_KEY: getEnvValue("OPENAI_API_KEY"),
    SUPABASE_SERVICE_ROLE_KEY: getEnvValue("SUPABASE_SERVICE_ROLE_KEY"),
  };
  return env;
}

export function validatePublicEnv(): string[] {
  const env = getPublicEnv();
  return Object.entries(env)
    .filter(([, value]) => !value)
    .map(([key]) => key);
}

export function validateServerEnv(): string[] {
  const env = getServerEnv();
  return Object.entries(env)
    .filter(([, value]) => !value)
    .map(([key]) => key);
}
