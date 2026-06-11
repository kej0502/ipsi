const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OR_MODEL = 'google/gemini-2.0-flash-exp:free';
const HF_EMBED_URL =
  'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/paraphrase-multilingual-mpnet-base-v2';

export async function getEmbedding(text: string): Promise<number[]> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const resp = await fetch(HF_EMBED_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: text }),
    });

    if (resp.status === 503) {
      const data = await resp.json() as { estimated_time?: number };
      const wait = Math.min((data.estimated_time ?? 20) * 1000, 30000);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }

    const data = await resp.json() as number[] | number[][];
    if (Array.isArray(data[0])) return (data as number[][])[0];
    return data as number[];
  }
  throw new Error('임베딩 실패 (3회 재시도 초과)');
}

export async function generateAnswer(question: string, context: string): Promise<string> {
  if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY가 설정되지 않았습니다');

  const prompt = `당신은 한국 대학입시 전문 AI입니다. 아래 참고 자료를 바탕으로 질문에 답변하세요.

참고 자료:
---
${context}
---

질문: ${question}

답변은 한국어로, 핵심만 간결하게 (3-5줄) 작성해주세요. 자료에 없는 내용은 추측하지 마세요.`;

  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OR_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenRouter 오류: ${resp.status} ${err}`);
  }

  const data = await resp.json() as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content;
}
