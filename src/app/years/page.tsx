export const dynamic = 'force-dynamic';

import { sql } from '@/lib/db';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

const SOURCE_LABELS: Record<string, string> = {
  news: '입시뉴스',
  ipsi_news: '입시대담',
  archive: '교육기관발표자료',
};

type YearStat = { year: number; cnt: number };
type YearArticle = {
  id: number; source: string; title: string; url: string;
  published_at: string; universities: string[] | null;
  admission_types: string[] | null; summary: string | null;
};

async function getYears(): Promise<YearStat[]> {
  const rows = await sql`
    SELECT year, COUNT(*) as cnt
    FROM structured_data
    WHERE year IS NOT NULL
    GROUP BY year
    ORDER BY year DESC
  `;
  return rows as YearStat[];
}

async function getYearData(year: number): Promise<YearArticle[]> {
  const rows = await sql`
    SELECT a.id, a.source, a.title, a.url, a.published_at,
           s.universities, s.admission_types, s.summary, s.key_changes
    FROM articles a
    JOIN structured_data s ON s.article_id = a.id
    WHERE s.year = ${year}
    ORDER BY a.published_at DESC NULLS LAST, a.id DESC
    LIMIT 100
  `;
  return rows as YearArticle[];
}

export default async function YearsPage({ searchParams }: { searchParams: { year?: string } }) {
  const years = await getYears();
  const selectedYear = searchParams.year ? parseInt(searchParams.year) : null;

  let articles: YearArticle[] = [];
  let univStats: { univ: string; cnt: number }[] = [];

  if (selectedYear) {
    articles = await getYearData(selectedYear);

    const allUnivs = articles.flatMap((a) => a.universities ?? []);
    const univMap = new Map<string, number>();
    allUnivs.forEach(u => univMap.set(u, (univMap.get(u) ?? 0) + 1));
    univStats = Array.from(univMap.entries())
      .map(([univ, cnt]) => ({ univ, cnt }))
      .sort((a, b) => b.cnt - a.cnt)
      .slice(0, 20);
  }

  const admissionStats = articles.length > 0
    ? (() => {
        const map = new Map<string, number>();
        articles.forEach((a) => {
          (a.admission_types ?? []).forEach(t => map.set(t, (map.get(t) ?? 0) + 1));
        });
        return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
      })()
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">연도별 입시정보</h1>

      {/* 연도 선택 탭 */}
      <div className="flex gap-2 flex-wrap">
        {years.map((y) => (
          <Link
            key={y.year}
            href={`/years?year=${y.year}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedYear === y.year
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-400 hover:text-blue-700'
            }`}
          >
            {y.year}학년도
            <span className="ml-1.5 text-xs opacity-70">{Number(y.cnt)}</span>
          </Link>
        ))}
        {years.length === 0 && (
          <p className="text-gray-400 text-sm">데이터 없음 — 크롤러를 먼저 실행해주세요.</p>
        )}
      </div>

      {selectedYear && (
        <div className="space-y-6">
          {/* 요약 통계 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-2xl font-bold text-gray-900">{articles.length}</p>
              <p className="text-sm text-gray-500">총 게시물</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-2xl font-bold text-gray-900">{univStats.length}</p>
              <p className="text-sm text-gray-500">언급 대학 수</p>
            </div>
            {admissionStats.slice(0, 2).map(([type, cnt]) => (
              <div key={type} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-2xl font-bold text-gray-900">{cnt}</p>
                <p className="text-sm text-gray-500">{type} 관련 게시물</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 게시물 목록 */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">{selectedYear}학년도 게시물</h2>
              </div>
              <ul className="divide-y divide-gray-50 max-h-[60vh] overflow-y-auto">
                {articles.map((article) => (
                  <li key={article.id} className="px-5 py-3 hover:bg-gray-50">
                    <div className="flex items-start gap-2 mb-1 flex-wrap">
                      <span className="text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-medium">
                        {SOURCE_LABELS[article.source] ?? article.source}
                      </span>
                      {article.admission_types?.slice(0, 3).map((t: string) => (
                        <span key={t} className="text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{t}</span>
                      ))}
                    </div>
                    <a href={article.url} target="_blank" rel="noopener noreferrer"
                       className="text-sm font-medium text-gray-900 hover:text-blue-700 flex items-start gap-1">
                      <span className="line-clamp-1">{article.title}</span>
                      <ExternalLink className="w-3 h-3 text-gray-400 shrink-0 mt-0.5" />
                    </a>
                    {article.universities && article.universities.length > 0 && (
                      <div className="mt-1 flex gap-1 flex-wrap">
                        {article.universities.slice(0, 5).map((u: string) => (
                          <Link key={u} href={`/universities?q=${encodeURIComponent(u)}`}
                                className="text-xs text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded hover:text-blue-700">
                            {u}
                          </Link>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* 대학별 언급 빈도 */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">대학별 언급 빈도</h2>
              </div>
              <ul className="divide-y divide-gray-50">
                {univStats.map(({ univ, cnt }, i) => (
                  <li key={univ} className="px-5 py-2.5 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-5 text-right">{i + 1}</span>
                      <Link href={`/universities?q=${encodeURIComponent(univ)}`}
                            className="text-sm text-gray-800 hover:text-blue-700">
                        {univ}
                      </Link>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-400 rounded-full"
                          style={{ width: `${(cnt / (univStats[0]?.cnt ?? 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-6 text-right">{cnt}</span>
                    </div>
                  </li>
                ))}
                {univStats.length === 0 && (
                  <li className="px-5 py-6 text-center text-sm text-gray-400">데이터 없음</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
