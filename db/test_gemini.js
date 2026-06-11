require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function test() {
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const result = await model.generateContent('한국어로 "API 연결 성공!"이라고 말해줘.');
  console.log('결과:', result.response.text());
}

test().catch(e => {
  console.error('오류:', e.message);
  if (e.message.includes('API_KEY')) {
    console.error('→ API 키 형식이 올바르지 않습니다.');
    console.error('  Google AI Studio (aistudio.google.com)에서 발급한 키는 AIzaSy...로 시작합니다.');
  }
});
