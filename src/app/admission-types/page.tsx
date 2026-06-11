export const dynamic = 'force-dynamic';

import { sql } from '@/lib/db';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

const SOURCE_LABELS: Record<string, string> = {
  news: '입시뉴스',
  ipsi_news: '입시대담',
  archive: '교육기관발표자료',
};

const ADMISSION_TYPES = ['수시', '정시', '논술', '학종', '교과', '실기'];

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  수시: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  정시: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  논술: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  학종: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  교과: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
  실기: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
};

type TypeStat = { type: string; cnt: number };
type AdmissionArticle = {
  id: number; source: string; title: string; url: string;
  published_at: string; universities: string[] | null; year: number | null;
  summary: string | null; key_changes: string | null;
};

async function getTypeStats(): Promise<TypeStat[]> {
  const rows = await sql`
    SELECT unnest(admission_types) as type, COUNT(*) as cnt
    FROM structured_data
    WHERE admission_types IS NOT NULL
    GROUP BY type
    ORDER BY cnt DESC
  `;
  return rows as TypeStat[];
}

async function getArticlesByType(type: string): Promise<AdmissionArticle[]> {
  const rows = await sql`
    SELECT a.id, a.source, a.title, a.url, a.published_at,
           s.universities, s.year, s.summary, s.key_changes
    FROM articles a
    JOIN structured_data s ON s.article_id = a.id
    WHERE ${type} = ANY(s.admission_types)
    ORDER BY a.published_at DESC NULLS LAST, a.id DESC
    LIMIT 60
  `;
  return rows as AdmissionArticle[];
}

export default async function AdmissionTypesPage({ searchParams }: { searchParams: { type?: string } }) {
  const typeStats = await getTypeStats();
  const selectedType = searchParams.type ?? '';

  let articles: Awaited<ReturnType<typeof getArticlesByType>> = [];
  if (selectedType) {
    articles = await getArticlesByType(selectedType);
  }

  const color = TYPE_COLORS[selectedType] ?? { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">전형별 입시정보</h1>

      {/* 전형 선택 카드 */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {ADMISSION_TYPES.map(type => {
          const stat = typeStats.find((s) => s.type === type);
          const c = TYPE_COLORS[type] ?? { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
          const isSelected = selectedType === type;
          return (
            <Link
              key={type}
              href={`/admission-types?type=${encodeURIComponent(type)}`}
              className={`rounded-xl border-2 p-4 text-center transition-all ${
                isSelected
                  ? `${c.bg} ${c.border} shadow-sm`
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className={`text-lg font-bold ${isSelected ? c.text : 'text-gray-800'}`}>{type}</p>
              <p className="text-xs text-gray-500 mt-1">{stat ? Number(stat.cnt) : 0}건</p>
            </Link>
          );
        })}
      </div>

      {/* 추가 전형 (DB에 있는 것) */}
      {typeStats.filter((s) => !ADMISSION_TYPES.includes(s.type)).length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs text-gray-500 self-center">기타:</span>
          {typeStats
            .filter((s) => !ADMISSION_TYPES.includes(s.type))
            .map((s) => (
              <Link
                key={s.type}
                href={`/admission-types?type=${encodeURIComponent(s.type)}`}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                  selectedType === s.type
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                }`}
              >
                {s.type} ({Number(s.cnt)})
              </Link>
            ))}
        </div>
      )}

      {/* 게시물 목록 */}
      {selectedType && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className={`text-xl font-bold ${color.text}`}>{selectedType} 전형</h2>
            <span className="text-sm text-gray-500">{articles.length}건</span>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <ul className="divide-y divide-gray-50">
              {articles.map((article) => (
                <li key={article.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
                          {SOURCE_LABELS[article.source] ?? article.source}
                        </span>
                        {article.year && (
                          <span className="text-xs text-gray-500">{article.year}학년도</span>
                        )}
                      </div>
                      <a href={article.url} target="_blank" rel="noopener noreferrer"
                         className="text-sm font-medium text-gray-900 hover:text-blue-700 flex items-start gap-1">
                        <span className="line-clamp-2">{article.title}</span>
                        <ExternalLink className="w-3 h-3 text-gray-400 shrink-0 mt-0.5" />
                      </a>
                      {article.summary && (
                        <p className="mt-1 text-xs text-gray-500 line-clamp-2">{article.summary}</p>
                      )}
                      {article.key_changes && (
                        <p className="mt-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded line-clamp-1">
                          변경: {article.key_changes}
                        </p>
                      )}
                      {article.universities && article.universities.length > 0 && (
                        <div className="mt-1 flex gap-1 flex-wrap">
                          {article.universities.slice(0, 6).map((u: string) => (
                            <Link key={u} href={`/universities?q=${encodeURIComponent(u)}`}
                                  className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded hover:text-blue-700 hover:bg-blue-50 transition-colors">
                              {u}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {article.published_at ? new Date(article.published_at).toLocaleDateString('ko-KR') : ''}
                    </span>
                  </div>
                </li>
              ))}
              {articles.length === 0 && (
                <li className="px-5 py-12 text-center text-gray-400">
                  해당 전형 관련 게시물이 없습니다.
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
