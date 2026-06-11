-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 원본 게시물 테이블
CREATE TABLE IF NOT EXISTS articles (
  id          SERIAL PRIMARY KEY,
  source      VARCHAR(50) NOT NULL,  -- 'news' | 'ipsi_news' | 'archive'
  title       TEXT NOT NULL,
  url         TEXT NOT NULL UNIQUE,
  published_at DATE,
  raw_content TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);

-- Claude/Gemini API로 추출한 구조화 데이터
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
);

CREATE INDEX IF NOT EXISTS idx_structured_data_article_id ON structured_data(article_id);
CREATE INDEX IF NOT EXISTS idx_structured_data_year ON structured_data(year);
CREATE INDEX IF NOT EXISTS idx_structured_data_universities ON structured_data USING GIN(universities);
CREATE INDEX IF NOT EXISTS idx_structured_data_admission_types ON structured_data USING GIN(admission_types);

-- 벡터 검색용 임베딩 테이블
CREATE TABLE IF NOT EXISTS search_embeddings (
  id           SERIAL PRIMARY KEY,
  article_id   INTEGER REFERENCES articles(id) ON DELETE CASCADE,
  chunk_text   TEXT NOT NULL,
  embedding    vector(768)  -- Gemini text-embedding-004 = 768차원
);

CREATE INDEX IF NOT EXISTS idx_search_embeddings_article_id ON search_embeddings(article_id);
CREATE INDEX IF NOT EXISTS idx_search_embeddings_vector
  ON search_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
