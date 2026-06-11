require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function reset() {
  await sql`TRUNCATE search_embeddings, structured_data, articles RESTART IDENTITY CASCADE`;
  console.log('DB 초기화 완료');
}

reset().catch(e => console.error(e.message));
