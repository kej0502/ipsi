import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getEmbedding, generateAnswer } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  const { query } = await req.json();
  if (!query?.trim()) {
    return NextResponse.json({ error: 'query required' }, { status: 400 });
  }

  try {
    // 1. 쿼리 임베딩
    const embedding = await getEmbedding(query);
    const embeddingStr = `[${embedding.join(',')}]`;

    // 2. 벡터 유사도 검색
    const vectorResults = await sql`
      SELECT
        e.article_id,
        e.chunk_text,
        1 - (e.embedding <=> ${embeddingStr}::vector) AS similarity,
        a.title,
        a.url,
        a.published_at,
        a.source,
        s.year,
        s.universities,
        s.admission_types,
        s.summary
      FROM search_embeddings e
      JOIN articles a ON a.id = e.article_id
      LEFT JOIN structured_data s ON s.article_id = e.article_id
      ORDER BY e.embedding <=> ${embeddingStr}::vector
      LIMIT 8
    `;

    // 3. 컨텍스트 구성
    type VectorRow = { title: string; chunk_text: string; [k: string]: unknown };
    const context = (vectorResults as VectorRow[])
      .slice(0, 5)
      .map((r, i) => `[${i + 1}] 제목: ${r.title}\n${r.chunk_text}`)
      .join('\n\n---\n\n');

    // 4. AI 답변 생성
    let answer = '';
    if (context) {
      answer = await generateAnswer(query, context);
    } else {
      answer = '관련 데이터가 없습니다. 크롤러를 실행하여 데이터를 수집해주세요.';
    }

    return NextResponse.json({ results: vectorResults, answer });
  } catch (err) {
    console.error('Search error:', err);

    // 임베딩 없이 키워드 검색 폴백
    const keyword = `%${query}%`;
    const fallback = await sql`
      SELECT a.id as article_id, a.title, a.url, a.published_at, a.source,
             s.year, s.universities, s.admission_types,
             LEFT(a.raw_content, 300) AS chunk_text,
             0.5 AS similarity
      FROM articles a
      LEFT JOIN structured_data s ON s.article_id = a.id
      WHERE a.title ILIKE ${keyword} OR a.raw_content ILIKE ${keyword}
      ORDER BY a.published_at DESC NULLS LAST
      LIMIT 8
    `;

    return NextResponse.json({
      results: fallback,
      answer: 'AI 검색 기능을 사용하려면 GEMINI_API_KEY를 설정하세요. 키워드 검색 결과를 표시합니다.',
    });
  }
}
