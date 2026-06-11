'use client';

import { useState } from 'react';
import { Search, Loader2, ExternalLink, Bot } from 'lucide-react';

interface SearchResult {
  article_id: number;
  title: string;
  url: string;
  published_at: string;
  source: string;
  chunk_text: string;
  similarity: number;
  year: number | null;
  universities: string[] | null;
  admission_types: string[] | null;
}

const SOURCE_LABELS: Record<string, string> = {
  news: '입시뉴스',
  ipsi_news: '입시대담',
  archive: '교육기관발표자료',
};

const EXAMPLES = [
  '2027 서울대 정시 등급컷 알려줘',
  '논술 수능최저 신설된 학교 어디야',
  '2028학년도 연세대 학종 변경사항',
  '수능 최저 없는 논술 전형 대학',
];

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [answer, setAnswer] = useState('');
  const [searched, setSearched] = useState(false);

  async function handleSearch(q: string = query) {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    setResults([]);
    setAnswer('');

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      setResults(data.results ?? []);
      setAnswer(data.answer ?? '');
    } catch {
      setAnswer('검색 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI 입시 검색</h1>
        <p className="mt-1 text-sm text-gray-500">자연어로 질문하면 관련 게시물을 찾고 AI가 답변합니다.</p>
      </div>

      {/* 검색창 */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="예: 2027 서울대 정시 등급컷 알려줘"
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => handleSearch()}
          disabled={loading || !query.trim()}
          className="px-5 py-3 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          검색
        </button>
      </div>

      {/* 예시 질문 */}
      {!searched && (
        <div>
          <p className="text-xs text-gray-500 mb-2">예시 질문</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map(ex => (
              <button
                key={ex}
                onClick={() => { setQuery(ex); handleSearch(ex); }}
                className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI 답변 */}
      {answer && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Bot className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-800">AI 답변</span>
          </div>
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{answer}</p>
        </div>
      )}

      {/* 검색 결과 */}
      {searched && !loading && results.length > 0 && (
        <div>
          <p className="text-sm text-gray-500 mb-3">관련 게시물 {results.length}건</p>
          <ul className="space-y-3">
            {results.map((r, i) => (
              <li key={i} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
                        {SOURCE_LABELS[r.source] ?? r.source}
                      </span>
                      {r.year && <span className="text-xs text-gray-500">{r.year}학년도</span>}
                      {r.admission_types?.slice(0, 3).map((t: string) => (
                        <span key={t} className="text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{t}</span>
                      ))}
                      <span className="text-xs text-emerald-600 ml-auto">유사도 {(r.similarity * 100).toFixed(0)}%</span>
                    </div>
                    <a href={r.url} target="_blank" rel="noopener noreferrer"
                       className="text-sm font-medium text-gray-900 hover:text-blue-700 flex items-start gap-1">
                      <span className="line-clamp-2">{r.title}</span>
                      <ExternalLink className="w-3 h-3 text-gray-400 shrink-0 mt-0.5" />
                    </a>
                    <p className="mt-1.5 text-xs text-gray-500 line-clamp-3 bg-gray-50 rounded p-2">
                      {r.chunk_text}
                    </p>
                    {r.universities && r.universities.length > 0 && (
                      <div className="mt-1.5 flex gap-1 flex-wrap">
                        {r.universities.slice(0, 5).map((u: string) => (
                          <span key={u} className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{u}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {searched && !loading && results.length === 0 && !answer && (
        <div className="text-center py-12 text-gray-400">
          <Search className="w-8 h-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm">관련 게시물을 찾을 수 없습니다.</p>
          <p className="text-xs mt-1">크롤러를 실행하거나 다른 키워드로 검색해보세요.</p>
        </div>
      )}
    </div>
  );
}
