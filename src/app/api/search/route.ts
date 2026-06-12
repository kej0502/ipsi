import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { generateAnswer } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  const { query } = await req.json();
  if (!query?.trim()) {
    return NextResponse.json({ error: 'query required' }, { status: 400 });
  }

  try {
    // 키워드 검색
    const keyword = `%${query}%`;
    const results = await sql`
      SELECT a.id as article_id, a.title, a.url, a.published_at, a.source,
             s.year, s.universities, s.admission_types, s.summary,
             LEFT(a.raw_content, 500) AS chunk_text,
             0.9 AS similarity
      FROM articles a
      LEFT JOIN structured_data s ON s.article_id = a.id
      WHERE a.title ILIKE ${keyword} OR a.raw_content ILIKE ${keyword}
      ORDER BY a.published_at DESC NULLS LAST
      LIMIT 8
    `;

    // AI 답변 생성 (검색 결과 기반)
    let answer = '';
    if (results.length > 0) {
      type Row = { title: string; chunk_text: string };
      const context = (results as Row[])
        .slice(0, 5)
        .map((r, i) => `[${i + 1}] 제목: ${r.title}\n${r.chunk_text}`)
        .join('\n\n---\n\n');
      try {
        answer = await generateAnswer(query, context);
      } catch {
        answer = '검색 결과를 바탕으로 AI 답변을 생성할 수 없습니다.';
      }
    } else {
      answer = '관련 게시물을 찾을 수 없습니다.';
    }

    return NextResponse.json({ results, answer });
  } catch (err) {
    console.error('Search error:', err);
    return NextResponse.json({ error: '검색 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
