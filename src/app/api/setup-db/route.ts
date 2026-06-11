import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST() {
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;

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

    await sql`
      CREATE TABLE IF NOT EXISTS search_embeddings (
        id           SERIAL PRIMARY KEY,
        article_id   INTEGER REFERENCES articles(id) ON DELETE CASCADE,
        chunk_text   TEXT NOT NULL,
        embedding    vector(768)
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_search_embeddings_article_id ON search_embeddings(article_id)`;

    // ivfflat 인덱스는 데이터가 있어야 생성 가능 - 나중에 생성
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_search_embeddings_vector
          ON search_embeddings USING ivfflat (embedding vector_cosine_ops)
          WITH (lists = 100)
      `;
    } catch {
      // 데이터 없으면 나중에 생성
    }

    return NextResponse.json({ ok: true, message: 'DB 스키마 생성 완료' });
  } catch (err) {
    console.error('Setup error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
