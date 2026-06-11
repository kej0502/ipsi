"""
메가스터디 입시정보 크롤러
- 입시뉴스, 입시대담, 교육기관발표자료 수집
- Gemini API로 구조화 데이터 추출
- Neon PostgreSQL 저장
"""

import os
import re
import time
import json
import logging
from datetime import datetime, date
from typing import Optional

import requests
from bs4 import BeautifulSoup
import psycopg2
from psycopg2.extras import Json, execute_values
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env.local'))

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

DATABASE_URL = os.environ['DATABASE_URL']
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    'Referer': 'https://www.megastudy.net/',
}

SOURCES = {
    'news': {
        'label': '입시뉴스',
        'list_url': 'https://www.megastudy.net/Entinfo/News/news_list_ax.asp?page={page}',
        'view_url': 'https://www.megastudy.net/Entinfo/News/news_view_ax.asp?idx={idx}',
        'onclick_pattern': r'fncNewsView\((\d+)\)',
        'base_url': 'https://www.megastudy.net/Entinfo/News',
    },
    'ipsi_news': {
        'label': '입시대담',
        'list_url': 'https://www.megastudy.net/Entinfo/ipsi_News/news_list_ax.asp?page={page}',
        'view_url': 'https://www.megastudy.net/Entinfo/ipsi_News/news_view_ax.asp?idx={idx}',
        'onclick_pattern': r'fncNewsView\((\d+)\)',
        'base_url': 'https://www.megastudy.net/Entinfo/ipsi_News',
    },
    'archive': {
        'label': '교육기관발표자료',
        'list_url': 'https://www.megastudy.net/entinfo/g_archive/list_ax.asp?pidx={page}',
        'view_url': 'https://www.megastudy.net/entinfo/g_archive/view_ax.asp?idx={idx}',
        'onclick_pattern': r'fncAchivView\((\d+)\)',
        'base_url': 'https://www.megastudy.net/entinfo/g_archive',
    },
}


def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    return conn


def fetch_html(url: str, retries: int = 3) -> Optional[BeautifulSoup]:
    for attempt in range(retries):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=20)
            # 사이트는 EUC-KR / CP949 인코딩 사용
            resp.encoding = resp.apparent_encoding or 'cp949'
            if resp.status_code == 200:
                return BeautifulSoup(resp.text, 'lxml')
            log.warning(f"HTTP {resp.status_code}: {url}")
        except Exception as e:
            log.warning(f"Attempt {attempt+1} failed for {url}: {e}")
            time.sleep(2 ** attempt)
    return None


def get_article_ids_from_page(source_key: str, page: int) -> list[int]:
    src = SOURCES[source_key]
    url = src['list_url'].format(page=page)
    soup = fetch_html(url)
    if not soup:
        return []

    pattern = src['onclick_pattern']
    ids = []
    for tag in soup.find_all(onclick=True):
        m = re.search(pattern, tag['onclick'])
        if m:
            ids.append(int(m.group(1)))
    return ids


def get_all_article_ids(source_key: str, max_pages: int = 50) -> list[int]:
    all_ids = []
    for page in range(1, max_pages + 1):
        ids = get_article_ids_from_page(source_key, page)
        if not ids:
            log.info(f"[{source_key}] 페이지 {page}에서 종료 (총 {len(all_ids)}개 발견)")
            break
        log.info(f"[{source_key}] 페이지 {page}: {len(ids)}개 발견")
        all_ids.extend(ids)
        time.sleep(1)
    return list(set(all_ids))


def parse_article(source_key: str, idx: int) -> Optional[dict]:
    src = SOURCES[source_key]
    url = src['view_url'].format(idx=idx)
    soup = fetch_html(url)
    if not soup:
        return None

    # 제목
    title_el = soup.find('h2') or soup.find('h1')
    title = title_el.get_text(strip=True) if title_el else ''

    # 날짜 (등록일 : 2026-05-27 패턴)
    full_text = soup.get_text()
    date_match = re.search(r'등록일\s*:\s*(\d{4}-\d{2}-\d{2})', full_text)
    published_at = None
    if date_match:
        try:
            published_at = datetime.strptime(date_match.group(1), '%Y-%m-%d').date()
        except ValueError:
            pass

    # 본문 (.viewContents)
    content_el = soup.find(class_='viewContents')
    if not content_el:
        content_el = soup.find(class_='view_con') or soup.find(id='articleContent')

    raw_content = content_el.get_text(separator='\n', strip=True) if content_el else ''

    if not title and not raw_content:
        return None

    return {
        'source': source_key,
        'title': title,
        'url': url,
        'published_at': published_at,
        'raw_content': raw_content,
    }


def save_article(conn, article: dict) -> Optional[int]:
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO articles (source, title, url, published_at, raw_content)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (url) DO UPDATE SET
                title = EXCLUDED.title,
                raw_content = EXCLUDED.raw_content
            RETURNING id
        """, (
            article['source'],
            article['title'],
            article['url'],
            article['published_at'],
            article['raw_content'],
        ))
        row = cur.fetchone()
        conn.commit()
        return row[0] if row else None


# ── Gemini 분석 ────────────────────────────────────────────────

def setup_gemini():
    if not GEMINI_API_KEY:
        log.warning("GEMINI_API_KEY 없음 - AI 분석 건너뜀")
        return None
    genai.configure(api_key=GEMINI_API_KEY)
    return genai.GenerativeModel('gemini-2.0-flash')


ANALYSIS_PROMPT = """아래는 한국 대학입시 관련 기사/자료입니다. 다음 항목을 JSON으로 추출해주세요.

규칙:
- 없는 정보는 null 또는 빈 배열로
- universities: 언급된 대학교 이름 목록 (예: ["서울대", "연세대"])
- year: 해당 학년도 숫자 (예: 2027)
- admission_types: 전형 종류 목록 (예: ["수시", "정시", "논술", "학종", "교과"])
- cutoff_scores: 등급컷/점수 데이터 {{대학: {{전형: 점수}}}} 형태
- competition_rates: 경쟁률 데이터 {{대학: {{전형: 경쟁률}}}} 형태
- key_changes: 전년 대비 주요 변경사항 한 문단 (없으면 null)
- summary: 3줄 이내 핵심 요약

반드시 유효한 JSON만 출력하세요. 마크다운 코드블록 없이 순수 JSON.

기사:
---
{content}
---"""


def analyze_with_gemini(model, article: dict) -> Optional[dict]:
    if not model:
        return None

    content = f"제목: {article['title']}\n\n{article['raw_content']}"
    content = content[:8000]  # 토큰 절약

    try:
        response = model.generate_content(
            ANALYSIS_PROMPT.format(content=content),
            generation_config=genai.types.GenerationConfig(
                temperature=0.1,
                response_mime_type='application/json',
            )
        )
        text = response.text.strip()
        # 마크다운 코드블록 제거
        text = re.sub(r'^```(?:json)?\n?', '', text)
        text = re.sub(r'\n?```$', '', text)
        return json.loads(text)
    except Exception as e:
        log.warning(f"Gemini 분석 실패: {e}")
        return None


def save_structured(conn, article_id: int, data: dict):
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO structured_data
              (article_id, universities, year, admission_types,
               cutoff_scores, competition_rates, key_changes, summary)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
        """, (
            article_id,
            data.get('universities') or [],
            data.get('year'),
            data.get('admission_types') or [],
            Json(data.get('cutoff_scores') or {}),
            Json(data.get('competition_rates') or {}),
            data.get('key_changes'),
            data.get('summary'),
        ))
        conn.commit()


# ── 임베딩 ────────────────────────────────────────────────────

def get_embedding(text: str) -> Optional[list[float]]:
    if not GEMINI_API_KEY:
        return None
    try:
        result = genai.embed_content(
            model='models/text-embedding-004',
            content=text,
            task_type='retrieval_document',
        )
        return result['embedding']
    except Exception as e:
        log.warning(f"임베딩 실패: {e}")
        return None


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = ' '.join(words[i:i + chunk_size])
        chunks.append(chunk)
        i += chunk_size - overlap
    return chunks


def save_embeddings(conn, article_id: int, content: str):
    chunks = chunk_text(content)
    rows = []
    for chunk in chunks[:10]:  # 최대 10 청크
        emb = get_embedding(chunk)
        if emb:
            rows.append((article_id, chunk, emb))
        time.sleep(0.1)

    if rows:
        with conn.cursor() as cur:
            execute_values(cur, """
                INSERT INTO search_embeddings (article_id, chunk_text, embedding)
                VALUES %s
                ON CONFLICT DO NOTHING
            """, rows, template='(%s, %s, %s::vector)')
        conn.commit()


# ── 메인 파이프라인 ────────────────────────────────────────────

def get_existing_urls(conn) -> set[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT url FROM articles")
        return {row[0] for row in cur.fetchall()}


def run(source_keys: list[str] = None, max_pages: int = 50, analyze: bool = True):
    if source_keys is None:
        source_keys = list(SOURCES.keys())

    conn = get_db()
    model = setup_gemini() if analyze else None
    existing_urls = get_existing_urls(conn)

    for source_key in source_keys:
        label = SOURCES[source_key]['label']
        log.info(f"\n{'='*50}\n[{label}] 크롤링 시작\n{'='*50}")

        all_ids = get_all_article_ids(source_key, max_pages=max_pages)
        log.info(f"[{label}] 총 {len(all_ids)}개 ID 발견")

        new_count = 0
        for idx in sorted(all_ids, reverse=True):
            url = SOURCES[source_key]['view_url'].format(idx=idx)
            if url in existing_urls:
                continue

            article = parse_article(source_key, idx)
            if not article:
                log.warning(f"파싱 실패: {url}")
                time.sleep(0.5)
                continue

            article_id = save_article(conn, article)
            if not article_id:
                continue

            log.info(f"[{label}] 저장: {article['title'][:50]}")
            new_count += 1
            existing_urls.add(url)

            if model and article.get('raw_content'):
                structured = analyze_with_gemini(model, article)
                if structured:
                    save_structured(conn, article_id, structured)
                    log.info(f"  → 구조화 데이터 저장")

                save_embeddings(conn, article_id, article['raw_content'])
                time.sleep(1)  # API rate limit
            else:
                time.sleep(0.3)

        log.info(f"[{label}] 신규 저장: {new_count}개")

    conn.close()
    log.info("크롤링 완료")


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--sources', nargs='+', choices=list(SOURCES.keys()),
                        help='수집할 소스 (기본: 전체)')
    parser.add_argument('--max-pages', type=int, default=50)
    parser.add_argument('--no-analyze', action='store_true', help='AI 분석 건너뜀')
    args = parser.parse_args()

    run(
        source_keys=args.sources,
        max_pages=args.max_pages,
        analyze=not args.no_analyze,
    )
