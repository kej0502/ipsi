export const dynamic = 'force-dynamic';

import { sql } from '@/lib/db';
import { ExternalLink, Users } from 'lucide-react';

type ArchiveArticle = {
  id: number;
  title: string;
  url: string;
  published_at: string | null;
  year: number | null;
  exam_type: string | null;
  applicant_count: number | null;
  exam_stats: Record<string, unknown> | null;
  summary: string | null;
  key_changes: string | null;
};

async function getArchiveData() {
  const rows = await sql`
    SELECT
      a.id, a.title, a.url, a.published_at,
      s.year, s.exam_type, s.applicant_count, s.exam_stats,
      s.summary, s.key_changes
    FROM articles a
    LEFT JOIN structured_data s ON s.article_id = a.id
    WHERE a.source = 'archive'
    ORDER BY s.year DESC NULLS LAST, a.published_at DESC NULLS LAST
  `;
  return rows as ArchiveArticle[];
}

export default async function ArchivePage() {
  const articles = await getArchiveData();

  // 연도별 그룹화
  const byYear = new Map<string, ArchiveArticle[]>();
  for (const a of articles) {
    const key = a.year ? String(a.year) : '연도 미분류';
    if (!byYear.has(key)) byYear.set(key, []);
    byYear.get(key)!.push(a);
  }
  const years = Array.from(byYear.keys()).sort((a, b) => {
    if (a === '연도 미분류') return 1;
    if (b === '연도 미분류') return -1;
    return Number(b) - Number(a);
  });

  // 통계
  const withApplicants = articles.filter(a => a.applicant_count);
  const examTypes = Array.from(new Set(articles.map(a => a.exam_type).filter(Boolean)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">교육기관 발표자료</h1>
        <p className="text-sm text-gray-500 mt-1">수능·모의고사·학력평가 공식 발표 자료 분석</p>
      </div>

      {/* 요약 통계 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="총 자료 수" value={`${articles.length}건`} />
        <StatCard label="시험 종류" value={`${examTypes.length}종`} />
        <StatCard label="응시 인원 데이터" value={`${withApplicants.length}건`} />
        <StatCard label="수록 연도" value={`${years.filter(y => y !== '연도 미분류').length}개년`} />
      </div>

      {/* 연도별 목록 */}
      <div className="space-y-6">
        {years.map(year => (
          <section key={year}>
            <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span className="bg-blue-600 text-white text-sm px-3 py-0.5 rounded-full">{year}</span>
              <span className="text-sm font-normal text-gray-500">{byYear.get(year)!.length}건</span>
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {byYear.get(year)!.map(article => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          </section>
        ))}
        {articles.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            데이터가 없습니다. 크롤러를 먼저 실행해주세요.
          </div>
        )}
      </div>
    </div>
  );
}

function ArticleCard({ article }: { article: ArchiveArticle }) {
  const stats = article.exam_stats as {
    subjects?: Record<string, { 응시?: number; 평균?: number; 등급컷?: Record<string, number> }>;
    grade_distribution?: Record<string, number>;
    notes?: string;
  } | null;

  const subjects = stats?.subjects ? Object.entries(stats.subjects) : [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-sm transition-shadow">
      {/* 헤더 */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {article.exam_type && (
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                  {article.exam_type}
                </span>
              )}
              {article.year && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {article.year}년
                </span>
              )}
            </div>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-gray-900 hover:text-blue-700 flex items-start gap-1 line-clamp-2"
            >
              {article.title}
              <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 text-gray-400" />
            </a>
          </div>
          {article.published_at && (
            <span className="text-xs text-gray-400 shrink-0">
              {new Date(article.published_at).toLocaleDateString('ko-KR')}
            </span>
          )}
        </div>

        {/* 응시 인원 */}
        {article.applicant_count && (
          <div className="mt-2 flex items-center gap-1.5 text-sm text-gray-700">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="font-semibold">{article.applicant_count.toLocaleString()}명</span>
            <span className="text-gray-400 text-xs">응시</span>
          </div>
        )}
      </div>

      {/* 요약 */}
      {article.summary && (
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-xs text-gray-600 leading-relaxed">{article.summary}</p>
        </div>
      )}

      {/* 과목별 데이터 */}
      {subjects.length > 0 && (
        <div className="px-5 py-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">과목별 현황</p>
          <div className="space-y-1.5">
            {subjects.slice(0, 4).map(([subj, data]) => (
              <div key={subj} className="flex items-center justify-between text-xs">
                <span className="text-gray-700 font-medium w-16 shrink-0">{subj}</span>
                <div className="flex gap-3 text-gray-500">
                  {data.응시 && (
                    <span>{data.응시.toLocaleString()}명</span>
                  )}
                  {data.평균 && (
                    <span>평균 {data.평균}점</span>
                  )}
                  {data.등급컷 && Object.keys(data.등급컷).length > 0 && (
                    <span>
                      1등급 {data.등급컷[1] ?? data.등급컷['1']}점
                    </span>
                  )}
                </div>
              </div>
            ))}
            {subjects.length > 4 && (
              <p className="text-xs text-gray-400">외 {subjects.length - 4}과목</p>
            )}
          </div>
        </div>
      )}

      {/* 변경사항 */}
      {article.key_changes && (
        <div className="px-5 py-3 border-t border-gray-50">
          <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1.5 rounded leading-relaxed">
            {article.key_changes.substring(0, 120)}
            {article.key_changes.length > 120 ? '...' : ''}
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
