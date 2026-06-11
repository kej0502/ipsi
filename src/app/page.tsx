export const dynamic = 'force-dynamic';

import { sql } from '@/lib/db';
import Link from 'next/link';
import { FileText, School, TrendingUp, ExternalLink } from 'lucide-react';

const SOURCE_LABELS: Record<string, string> = {
  news: '입시뉴스',
  ipsi_news: '입시대담',
  archive: '교육기관발표자료',
};

type SourceStat = { source: string; count: number };
type RecentArticle = {
  id: number; source: string; title: string; url: string;
  published_at: string; summary: string | null;
  universities: string[] | null; year: number | null; admission_types: string[] | null;
};
type UnivStat = { univ: string; cnt: number };

async function getStats() {
  const [totalRows, sourceRows, recentRows, univRows] = await Promise.all([
    sql`SELECT COUNT(*) as count FROM articles`,
    sql`SELECT source, COUNT(*) as count FROM articles GROUP BY source ORDER BY count DESC`,
    sql`
      SELECT a.id, a.source, a.title, a.url, a.published_at,
             s.summary, s.universities, s.year, s.admission_types
      FROM articles a
      LEFT JOIN structured_data s ON s.article_id = a.id
      ORDER BY a.published_at DESC NULLS LAST, a.id DESC
      LIMIT 10
    `,
    sql`
      SELECT unnest(universities) as univ, COUNT(*) as cnt
      FROM structured_data
      WHERE universities IS NOT NULL
      GROUP BY univ
      ORDER BY cnt DESC
      LIMIT 10
    `,
  ]);

  return {
    total: Number(totalRows[0]?.count ?? 0),
    bySource: sourceRows as SourceStat[],
    recent: recentRows as RecentArticle[],
    topUniversities: univRows as UnivStat[],
  };
}

export default async function HomePage() {
  let stats;
  try {
    stats = await getStats();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-lg w-full">
          <h2 className="font-bold text-red-700 mb-2">데이터베이스 연결 오류</h2>
          <p className="text-sm text-red-600">{msg}</p>
          <p className="text-xs text-gray-500 mt-3">Vercel 환경변수(DATABASE_URL)를 확인해주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">입시정보 분석 대시보드</h1>
        <p className="mt-2 text-gray-500">메가스터디 입시뉴스 · 입시대담 · 교육기관발표자료 AI 분석</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="총 게시물" value={stats.total.toLocaleString()} color="blue" />
        {stats.bySource.map((s) => (
          <StatCard
            key={s.source}
            icon={FileText}
            label={SOURCE_LABELS[s.source] ?? s.source}
            value={Number(s.count).toLocaleString()}
            color="indigo"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 최신 게시물 */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <h2 className="font-semibold text-gray-800">최신 분석 게시물</h2>
          </div>
          <ul className="divide-y divide-gray-50">
            {stats.recent.map((article) => (
              <li key={article.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                        {SOURCE_LABELS[article.source] ?? article.source}
                      </span>
                      {article.year && (
                        <span className="text-xs text-gray-500">{article.year}학년도</span>
                      )}
                      {article.admission_types?.slice(0, 2).map((t: string) => (
                        <span key={t} className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                    <a href={article.url} target="_blank" rel="noopener noreferrer"
                       className="text-sm font-medium text-gray-900 hover:text-blue-700 line-clamp-2 flex items-start gap-1">
                      {article.title}
                      <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 text-gray-400" />
                    </a>
                    {article.summary && (
                      <p className="mt-1 text-xs text-gray-500 line-clamp-2">{article.summary}</p>
                    )}
                    {article.universities && article.universities.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {article.universities.slice(0, 4).map((u: string) => (
                          <span key={u} className="text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{u}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {article.published_at ? new Date(article.published_at).toLocaleDateString('ko-KR') : '날짜 없음'}
                  </span>
                </div>
              </li>
            ))}
            {stats.recent.length === 0 && (
              <li className="px-5 py-12 text-center text-gray-400 text-sm">
                게시물이 없습니다. 크롤러를 먼저 실행해주세요.
              </li>
            )}
          </ul>
        </div>

        {/* 자주 언급된 대학 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <School className="w-4 h-4 text-purple-600" />
            <h2 className="font-semibold text-gray-800">자주 언급된 대학</h2>
          </div>
          <ul className="divide-y divide-gray-50">
            {stats.topUniversities.map((u, i) => (
              <li key={u.univ} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-400 w-5 text-center">{i + 1}</span>
                  <Link href={`/universities?q=${encodeURIComponent(u.univ)}`}
                        className="text-sm font-medium text-gray-800 hover:text-blue-700">
                    {u.univ}
                  </Link>
                </div>
                <span className="text-sm text-gray-500">{Number(u.cnt).toLocaleString()}건</span>
              </li>
            ))}
            {stats.topUniversities.length === 0 && (
              <li className="px-5 py-8 text-center text-gray-400 text-sm">데이터 없음</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: 'blue' | 'indigo' | 'purple' | 'emerald';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    purple: 'bg-purple-50 text-purple-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className={`inline-flex p-2 rounded-lg ${colors[color]} mb-3`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
