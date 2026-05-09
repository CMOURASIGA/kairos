# KAIROS
## Ajuste Tecnico - Camada de Voz

---

## Decisao

Inicialmente, nao usaremos ElevenLabs para voz.

Motivo:
- o plano Free bloqueia vozes da biblioteca via API
- as vozes PT-BR melhores exigem plano pago
- isso estava gerando erro `402 paid_plan_required`
- nao vamos travar o desenvolvimento por causa da voz

---

## Nova abordagem

Usar OpenAI TTS inicialmente.

A OpenAI continuara sendo usada para:
- inteligencia
- respostas
- especialistas
- memoria
- geracao de voz

A voz podera ser substituida futuramente por ElevenLabs Premium.

---

## Variaveis de ambiente

Adicionar:

```env
OPENAI_API_KEY=
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=sage
```

---

## Servico de voz

Criar:

```text
/services/voice/openai-tts.ts
```

Responsabilidade:
- receber texto
- chamar OpenAI TTS
- retornar audio em MP3

---

## API Route

Criar endpoint:

```text
/api/voice
```

Payload esperado:

```json
{
  "text": "Ola Christian. Eu sou o Kairos."
}
```

Retorno:
- audio mp3
- content-type: audio/mpeg

Exemplo de chamada OpenAI TTS:

```json
{
  "model": "gpt-4o-mini-tts",
  "voice": "sage",
  "input": "Ola Christian. Eu sou o Kairos."
}
```

---

## Fluxo no frontend

```text
Kairos responde em texto
↓
Usuario clica em "Ouvir resposta"
↓
Frontend chama /api/voice
↓
Backend gera audio pela OpenAI
↓
Frontend reproduz o audio
```

---

## Regras importantes

- Nao gerar audio automaticamente.
- Gerar audio apenas quando o usuario clicar em "Ouvir resposta".
- Nao expor `OPENAI_API_KEY` no frontend.
- Tratar erro da API.
- Exibir loading enquanto gera audio.
- Manter implementacao desacoplada para permitir troca futura para ElevenLabs.

---

## Criterios de aceite

- Botao "Ouvir resposta" aparece nas respostas do Kairos.
- Ao clicar, o sistema gera audio.
- Audio e reproduzido no navegador.
- Erros sao tratados sem quebrar o chat.
- API Key fica somente no backend.
- A voz usada inicialmente e `sage`.

---

A orientacao principal e: **OpenAI TTS agora, ElevenLabs fica para fase futura premium.**
