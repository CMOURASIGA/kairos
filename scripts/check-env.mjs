import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");

const required = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "OPENAI_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

function parseEnvFile(content) {
  const entries = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const index = line.indexOf("=");
    if (index === -1) continue;

    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    entries[key] = value;
  }

  return entries;
}

if (!fs.existsSync(envPath)) {
  console.error("Arquivo .env.local nao encontrado.");
  console.error("Copie .env.example para .env.local e preencha os valores.");
  process.exit(1);
}

const fileContent = fs.readFileSync(envPath, "utf8");
const values = parseEnvFile(fileContent);
const missing = required.filter((key) => !values[key]);

if (missing.length > 0) {
  console.error("Variaveis obrigatorias ausentes no .env.local:");
  for (const key of missing) console.error(`- ${key}`);
  process.exit(1);
}

console.log("Env OK. Todas as variaveis obrigatorias foram preenchidas.");
