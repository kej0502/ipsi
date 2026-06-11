import { neon } from '@neondatabase/serverless';

// Lazy initialization: avoid calling neon() at module load time during build
let _client: ReturnType<typeof neon> | null = null;

function getClient() {
  if (!_client) {
    _client = neon(process.env.DATABASE_URL!);
  }
  return _client;
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  return getClient()(strings, ...values) as Promise<Record<string, unknown>[]>;
}

export interface Article {
  id: number;
  source: string;
  title: string;
  url: string;
  published_at: string | null;
  raw_content: string | null;
  created_at: string;
}

export interface StructuredData {
  id: number;
  article_id: number;
  universities: string[];
  year: number | null;
  admission_types: string[];
  cutoff_scores: Record<string, unknown>;
  competition_rates: Record<string, unknown>;
  key_changes: string | null;
  summary: string | null;
  extracted_at: string;
}

export interface SearchEmbedding {
  id: number;
  article_id: number;
  chunk_text: string;
  similarity?: number;
}
