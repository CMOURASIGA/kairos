import { validatePublicEnv, validateServerEnv } from "@/lib/env";

export default function SettingsPage() {
  const missingPublic = validatePublicEnv();
  const missingServer = validateServerEnv();
  const hasTTSModel = Boolean(process.env.OPENAI_TTS_MODEL?.trim());
  const hasTTSVoice = Boolean(process.env.OPENAI_TTS_VOICE?.trim());
  const hasEmbeddingModel = Boolean(process.env.OPENAI_EMBEDDING_MODEL?.trim());

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-(--text-primary)">Configuracoes</h2>
      <p className="text-sm text-(--text-secondary)">
        Validacao inicial de ambiente para separar variaveis publicas e privadas.
      </p>

      <article className="rounded-xl border border-(--border) bg-(--bg-surface) p-4">
        <h3 className="text-sm font-semibold text-(--text-primary)">Variaveis Publicas</h3>
        {missingPublic.length === 0 ? (
          <p className="mt-2 text-sm text-(--success)">OK: configuradas.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-(--danger)">
            {missingPublic.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </article>

      <article className="rounded-xl border border-(--border) bg-(--bg-surface) p-4">
        <h3 className="text-sm font-semibold text-(--text-primary)">Variaveis Server-side</h3>
        {missingServer.length === 0 ? (
          <p className="mt-2 text-sm text-(--success)">OK: configuradas.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-(--danger)">
            {missingServer.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </article>

      <article className="rounded-xl border border-(--border) bg-(--bg-surface) p-4">
        <h3 className="text-sm font-semibold text-(--text-primary)">Onde obter cada chave</h3>
        <ul className="mt-2 space-y-1 text-sm text-(--text-secondary)">
          <li>NEXT_PUBLIC_SUPABASE_URL - Supabase Project Settings &gt; API &gt; Project URL</li>
          <li>NEXT_PUBLIC_SUPABASE_ANON_KEY - Supabase Project Settings &gt; API &gt; anon public</li>
          <li>SUPABASE_SERVICE_ROLE_KEY - Supabase Project Settings &gt; API &gt; service_role secret</li>
          <li>OPENAI_API_KEY - OpenAI Dashboard &gt; API keys</li>
          <li>OPENAI_TTS_MODEL - modelo de TTS (ex.: gpt-4o-mini-tts)</li>
          <li>OPENAI_TTS_VOICE - voz de TTS (ex.: sage)</li>
          <li>OPENAI_EMBEDDING_MODEL - modelo de embedding (ex.: text-embedding-3-small)</li>
        </ul>
      </article>

      <article className="rounded-xl border border-(--border) bg-(--bg-surface) p-4">
        <h3 className="text-sm font-semibold text-(--text-primary)">Voz via OpenAI TTS</h3>
        <ul className="mt-2 space-y-1 text-sm">
          <li className={hasTTSModel ? "text-(--success)" : "text-(--warning)"}>
            OPENAI_TTS_MODEL: {hasTTSModel ? "configurada" : "nao configurada (usara padrao)"}
          </li>
          <li className={hasTTSVoice ? "text-(--success)" : "text-(--warning)"}>
            OPENAI_TTS_VOICE: {hasTTSVoice ? "configurada" : "nao configurada (usara padrao)"}
          </li>
          <li className={hasEmbeddingModel ? "text-(--success)" : "text-(--warning)"}>
            OPENAI_EMBEDDING_MODEL:{" "}
            {hasEmbeddingModel ? "configurada" : "nao configurada (usara padrao)"}
          </li>
        </ul>
      </article>
    </section>
  );
}
