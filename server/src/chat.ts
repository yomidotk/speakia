/**
 * Every chat request to an AI model goes through here.
 *
 * Main: DigitalOcean serverless inference (gpt-oss-120b, prepaid, about 1.5M tokens a minute), when
 * DO_MODEL_ACCESS_KEY is set. If it fails or isn't set: Groq's free plan (8K tokens a minute per
 * model), then Groq's smaller model when the big one is at its limit. Speech-to-text stays on Groq:
 * DigitalOcean has no Whisper.
 */
export type ChatEnv = { GROQ_API_KEY?: string; CHAT_MODEL?: string; DO_MODEL_ACCESS_KEY?: string; DO_CHAT_MODEL?: string };

type Message = { role: 'system' | 'user' | 'assistant'; content: string };
export type ChatRequest = { messages: Message[]; temperature: number; effort: 'low' | 'medium'; maxTokens: number };
export type ChatResult = { ok: true; content: string } | { ok: false; status: number; detail: string };

type Provider = { name: string; url: string; key: string; model: string; extra: Record<string, unknown> };

function providers(env: ChatEnv): Provider[] {
  const list: Provider[] = [];
  if (env.DO_MODEL_ACCESS_KEY) {
    list.push({ name: 'digitalocean', url: 'https://inference.do-ai.run/v1/chat/completions', key: env.DO_MODEL_ACCESS_KEY, model: env.DO_CHAT_MODEL || 'openai-gpt-oss-120b', extra: {} });
  }
  if (env.GROQ_API_KEY) {
    const main = env.CHAT_MODEL || 'openai/gpt-oss-120b';
    // Groq: keep gpt-oss's reasoning out of the reply
    for (const model of main === 'openai/gpt-oss-20b' ? [main] : [main, 'openai/gpt-oss-20b']) {
      list.push({ name: 'groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: env.GROQ_API_KEY, model, extra: { include_reasoning: false } });
    }
  }
  return list;
}

/** Ask for a JSON answer; tries each provider in turn and returns the first answer that works. */
export async function chat(env: ChatEnv, req: ChatRequest): Promise<ChatResult> {
  let last: ChatResult = { ok: false, status: 503, detail: 'No AI provider is configured' };
  for (const p of providers(env)) {
    try {
      const res = await fetch(p.url, {
        method: 'POST',
        headers: { authorization: `Bearer ${p.key}`, 'content-type': 'application/json' },
        signal: AbortSignal.timeout(35_000),
        body: JSON.stringify({
          model: p.model, messages: req.messages, temperature: req.temperature,
          reasoning_effort: req.effort, max_tokens: req.maxTokens, response_format: { type: 'json_object' }, ...p.extra,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const content = data.choices?.[0]?.message?.content;
        if (content) return { ok: true, content };
        last = { ok: false, status: 502, detail: `${p.name} ${p.model}: empty answer` };
      } else {
        last = { ok: false, status: res.status, detail: (await res.text()).slice(0, 300) };
      }
    } catch (e) {
      last = { ok: false, status: 504, detail: e instanceof Error ? e.message : String(e) };
    }
    console.log(`chat: ${p.name} ${p.model} failed (${last.ok ? '' : `${last.status} ${last.detail}`}), trying the next one`);
  }
  return last;
}
