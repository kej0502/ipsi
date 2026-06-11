import { GoogleGenerativeAI } from '@google/generative-ai';

let client: GoogleGenerativeAI | null = null;

function getClient() {
  if (!client) {
    client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }
  return client;
}

export async function getEmbedding(text: string): Promise<number[]> {
  const genai = getClient();
  const model = genai.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

export async function generateAnswer(question: string, context: string): Promise<string> {
  const genai = getClient();
  const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `당신은 한국 대학입시 전문 AI입니다. 아래 참고 자료를 바탕으로 질문에 답변하세요.

참고 자료:
---
${context}
---

질문: ${question}

답변은 한국어로, 핵심만 간결하게 (3-5줄) 작성해주세요. 자료에 없는 내용은 추측하지 마세요.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}
