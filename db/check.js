require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function check() {
  const counts = await sql`SELECT source, COUNT(*) as cnt FROM articles GROUP BY source ORDER BY source`;
  console.log('=== DB 저장 현황 ===');
  counts.forEach(r => console.log(`${r.source}: ${r.cnt}건`));

  const sample = await sql`SELECT id, source, title, published_at FROM articles ORDER BY id DESC LIMIT 3`;
  console.log('\n=== 최신 게시물 샘플 ===');
  sample.forEach(r => console.log(`[${r.id}] ${r.source} / ${r.published_at} / ${r.title}`));
}

check().catch(e => console.error(e.message));
