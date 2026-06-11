export const dynamic = 'force-dynamic';

import { sql } from '@/lib/db';
import Link from 'next/link';
import { ExternalLink, ChevronRight } from 'lucide-react';

const SOURCE_LABELS: Record<string, string> = {
  news: '입시뉴스',
  ipsi_news: '입시대담',
  archive: '교육기관발표자료',
};

const ADMISSION_COLORS: Record<string, string> = {
  수시: 'bg-blue-50 text-blue-700',
  정시: 'bg-emerald-50 text-emerald-700',
  논술: 'bg-purple-50 text-purple-700',
  학종: 'bg-orange-50 text-orange-700',
  교과: 'bg-pink-50 text-pink-700',
};

type UnivStat = { univ: string; cnt: number };
type UnivArticle = {
  id: number; source: string; title: string; url: string;
  published_at: string; year: number | null; admission_types: string[] | null;
  summary: string | null; cutoff_scores: Record<string, unknown>;
  competition_rates: Record<string, unknown>; key_changes: string | null;
};

async function getUniversities(): Promise<UnivStat[]> {
  const rows = await sql`
    SELECT unnest(universities) as univ, COUNT(*) as cnt
    FROM structured_data
    WHERE universities IS NOT NULL AND array_length(universities, 1) > 0
    GROUP BY univ
    ORDER BY cnt DESC
    LIMIT 80
  `;
  return rows as UnivStat[];
}

async function getUniversityArticles(univ: string): Promise<UnivArticle[]> {
  const rows = await sql`
    SELECT a.id, a.source, a.title, a.url, a.published_at,
           s.year, s.admission_types, s.summary, s.cutoff_scores, s.competition_rates, s.key_changes
    FROM articles a
    JOIN structured_data s ON s.article_id = a.id
    WHERE ${univ} = ANY(s.universities)
    ORDER BY a.published_at DESC NULLS LAST, a.id DESC
    LIMIT 50
  `;
  return rows as UnivArticle[];
}

export default async function UniversitiesPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const selected = searchParams.q ?? '';
  const universities = await getUniversities();

  let articles: UnivArticle[] = [];
  if (selected) {
    articles = await getUniversityArticles(selected);
  }

  const years = Array.from(
    new Set(articles.map((a) => a.year).filter(Boolean))
  ).sort((a, b) => (b as number) - (a as number));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">학교별 입시정보</h1>

      <div className="flex gap-6">
        {/* 대학 목록 사이드바 */}
        <aside className="w-56 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-24">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">대학 목록</p>
            </div>
            <ul className="max-h-[70vh] overflow-y-auto divide-y divide-gray-50">
              {universities.map((u) => (
                <li key={u.univ}>
                  <Link
                    href={`/universities?q=${encodeURIComponent(u.univ)}`}
                    className={`flex items-center justify-between px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors ${selected === u.univ ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                  >
                    <span className="truncate">{u.univ}</span>
                    <span className="text-xs text-gray-400 shrink-0 ml-2">{Number(u.cnt)}</span>
                  </Link>
                </li>
              ))}
              {universities.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-gray-400">데이터 없음</li>
              )}
            </ul>
          </div>
        </aside>

        {/* 메인 콘텐츠 */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">{selected}</h2>
                <span className="text-sm text-gray-500">{articles.length}건의 게시물</span>
              </div>

              {/* 연도별 그룹 */}
              {years.map((year) => {
                const yearArticles = articles.filter((a) => a.year === year);
                return (
                  <div key={String(year)} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                      <h3 className="font-semibold text-gray-800">{year}학년도 ({yearArticles.length}건)</h3>
                    </div>
                    <ul className="divide-y divide-gray-50">
                      {yearArticles.map((article) => (
                        <li key={article.id} className="px-5 py-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap gap-1.5 mb-1">
                                <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
                                  {SOURCE_LABELS[article.source] ?? article.source}
                                </span>
                                {article.admission_types?.map((t: string) => (
                                  <span key={t} className={`text-xs px-2 py-0.5 rounded-full font-medium ${ADMISSION_COLORS[t] ?? 'bg-gray-50 text-gray-600'}`}>
                                    {t}
                                  </span>
                                ))}
                              </div>
                              <a href={article.url} target="_blank" rel="noopener noreferrer"
                                 className="text-sm font-medium text-gray-900 hover:text-blue-700 flex items-center gap-1">
                                {article.title}
                                <ExternalLink className="w-3 h-3 text-gray-400 shrink-0" />
                              </a>
                              {article.summary && (
                                <p className="mt-1 text-xs text-gray-500 line-clamp-2">{article.summary}</p>
                              )}
                              {article.key_changes && (
                                <p className="mt-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                                  변경사항: {article.key_changes.substring(0, 100)}
                                  {article.key_changes.length > 100 ? '...' : ''}
                                </p>
                              )}
                            </div>
                            <span className="text-xs text-gray-400 shrink-0">
                              {article.published_at ? new Date(article.published_at).toLocaleDateString('ko-KR') : ''}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}

              {/* 연도 미분류 */}
              {articles.filter((a) => !a.year).length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-800">학년도 미분류</h3>
                  </div>
                  <ul className="divide-y divide-gray-50">
                    {articles
                      .filter((a) => !a.year)
                      .map((article) => (
                        <li key={article.id} className="px-5 py-3">
                          <a href={article.url} target="_blank" rel="noopener noreferrer"
                             className="text-sm text-gray-800 hover:text-blue-700 flex items-center gap-1">
                            {article.title}
                            <ExternalLink className="w-3 h-3 text-gray-400" />
                          </a>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {articles.length === 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
                  해당 대학 관련 게시물이 없습니다.
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <ChevronRight className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">왼쪽에서 대학을 선택하세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
