/**
 * DB 스키마 초기화 스크립트
 * 실행: node db/setup.js
 */
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function setup() {
  console.log('DB 스키마 초기화 중...');

  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  console.log('✓ pgvector 확장 활성화');

  await sql`
    CREATE TABLE IF NOT EXISTS articles (
      id          SERIAL PRIMARY KEY,
      source      VARCHAR(50) NOT NULL,
      title       TEXT NOT NULL,
      url         TEXT NOT NULL UNIQUE,
      published_at DATE,
      raw_content TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC)`;
  console.log('✓ articles 테이블 생성');

  await sql`
    CREATE TABLE IF NOT EXISTS structured_data (
      id                SERIAL PRIMARY KEY,
      article_id        INTEGER REFERENCES articles(id) ON DELETE CASCADE,
      universities      TEXT[],
      year              INTEGER,
      admission_types   TEXT[],
      cutoff_scores     JSONB DEFAULT '{}',
      competition_rates JSONB DEFAULT '{}',
      key_changes       TEXT,
      summary           TEXT,
      extracted_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_structured_data_article_id ON structured_data(article_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_structured_data_year ON structured_data(year)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_structured_data_universities ON structured_data USING GIN(universities)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_structured_data_admission_types ON structured_data USING GIN(admission_types)`;
  console.log('✓ structured_data 테이블 생성');

  await sql`
    CREATE TABLE IF NOT EXISTS search_embeddings (
      id           SERIAL PRIMARY KEY,
      article_id   INTEGER REFERENCES articles(id) ON DELETE CASCADE,
      chunk_text   TEXT NOT NULL,
      embedding    vector(768)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_search_embeddings_article_id ON search_embeddings(article_id)`;
  console.log('✓ search_embeddings 테이블 생성');

  console.log('\n✅ 모든 테이블 생성 완료!');
  console.log('다음 단계: python crawler/crawler.py 실행하여 데이터 수집');
}

setup().catch(err => {
  console.error('오류:', err.message);
  process.exit(1);
});
