import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { generateAnswer } from '@/lib/gemini';

// 불용어 제거 후 핵심 키워드 추출
function extractKeywords(query: string): string[] {
  const stopwords = new Set(['어디야', '어디', '어떤', '뭐야', '뭐', '어떻게', '언제', '왜', '어느', '있어', '없어', '알려줘', '알려', '해줘', '해', '되나요', '인가요', '인지', '의', '이', '가', '을', '를', '은', '는', '로', '에', '에서', '에게', '와', '과', '도', '만', '까지', '부터', '하고', '하는', '하면', '하지', '한', '됩니다', '됩', '입니다', '입', '것', '거', '수', '더', '좀', '제', '학교', '대학']);
  const words = query.trim().split(/\s+/);
  const keywords = words.filter(w => w.length >= 2 && !stopwords.has(w));
  return keywords.length > 0 ? keywords : words.filter(w => w.length >= 2);
}

export async function POST(req: NextRequest) {
  const { query } = await req.json();
  if (!query?.trim()) {
    return NextResponse.json({ error: 'query required' }, { status: 400 });
  }

  try {
    const keywords = extractKeywords(query);

    // 각 키워드를 OR 조건으로 검색
    let results: Record<string, unknown>[] = [];
    if (keywords.length === 0) {
      results = [];
    } else {
      // 키워드별 ILIKE 조건 생성 (최대 5개)
      const topKeywords = keywords.slice(0, 5);

      // 동적 OR 조건 — 키워드 수에 따라 분기
      if (topKeywords.length === 1) {
        const k = `%${topKeywords[0]}%`;
        results = await sql`
          SELECT a.id as article_id, a.title, a.url, a.published_at, a.source,
                 s.year, s.universities, s.admission_types, s.summary,
                 LEFT(a.raw_content, 500) AS chunk_text,
                 0.9 AS similarity
          FROM articles a
          LEFT JOIN structured_data s ON s.article_id = a.id
          WHERE a.title ILIKE ${k} OR a.raw_content ILIKE ${k}
          ORDER BY a.published_at DESC NULLS LAST
          LIMIT 8
        `;
      } else if (topKeywords.length === 2) {
        const [k0, k1] = topKeywords.map(k => `%${k}%`);
        results = await sql`
          SELECT a.id as article_id, a.title, a.url, a.published_at, a.source,
                 s.year, s.universities, s.admission_types, s.summary,
                 LEFT(a.raw_content, 500) AS chunk_text,
                 0.9 AS similarity
          FROM articles a
          LEFT JOIN structured_data s ON s.article_id = a.id
          WHERE a.title ILIKE ${k0} OR a.raw_content ILIKE ${k0}
             OR a.title ILIKE ${k1} OR a.raw_content ILIKE ${k1}
          ORDER BY a.published_at DESC NULLS LAST
          LIMIT 8
        `;
      } else if (topKeywords.length === 3) {
        const [k0, k1, k2] = topKeywords.map(k => `%${k}%`);
        results = await sql`
          SELECT a.id as article_id, a.title, a.url, a.published_at, a.source,
                 s.year, s.universities, s.admission_types, s.summary,
                 LEFT(a.raw_content, 500) AS chunk_text,
                 0.9 AS similarity
          FROM articles a
          LEFT JOIN structured_data s ON s.article_id = a.id
          WHERE a.title ILIKE ${k0} OR a.raw_content ILIKE ${k0}
             OR a.title ILIKE ${k1} OR a.raw_content ILIKE ${k1}
             OR a.title ILIKE ${k2} OR a.raw_content ILIKE ${k2}
          ORDER BY a.published_at DESC NULLS LAST
          LIMIT 8
        `;
      } else {
        const [k0, k1, k2, k3] = topKeywords.slice(0, 4).map(k => `%${k}%`);
        results = await sql`
          SELECT a.id as article_id, a.title, a.url, a.published_at, a.source,
                 s.year, s.universities, s.admission_types, s.summary,
                 LEFT(a.raw_content, 500) AS chunk_text,
                 0.9 AS similarity
          FROM articles a
          LEFT JOIN structured_data s ON s.article_id = a.id
          WHERE a.title ILIKE ${k0} OR a.raw_content ILIKE ${k0}
             OR a.title ILIKE ${k1} OR a.raw_content ILIKE ${k1}
             OR a.title ILIKE ${k2} OR a.raw_content ILIKE ${k2}
             OR a.title ILIKE ${k3} OR a.raw_content ILIKE ${k3}
          ORDER BY a.published_at DESC NULLS LAST
          LIMIT 8
        `;
      }
    }

    // AI 답변 생성
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
      answer = `관련 게시물을 찾을 수 없습니다. (검색 키워드: ${keywords.join(', ')})`;
    }

    return NextResponse.json({ results, answer });
  } catch (err) {
    console.error('Search error:', err);
    return NextResponse.json({ error: '검색 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
