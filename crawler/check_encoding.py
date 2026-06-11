import requests
import sys

url = 'https://www.megastudy.net/Entinfo/News/news_view_ax.asp?idx=7656'
resp = requests.get(url, headers={
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
})
print('HTTP status:', resp.status_code)
print('Content-Type:', resp.headers.get('Content-Type'))
print('Detected encoding:', resp.encoding)
print('Apparent encoding:', resp.apparent_encoding)

# 실제 텍스트 확인
resp.encoding = resp.apparent_encoding
from bs4 import BeautifulSoup
soup = BeautifulSoup(resp.text, 'lxml')
h2 = soup.find('h2')
print('H2 title:', h2.get_text(strip=True) if h2 else 'NOT FOUND')

import re
full_text = soup.get_text()
dm = re.search(r'등록일\s*:\s*(\d{4}-\d{2}-\d{2})', full_text)
print('Date match:', dm.group(1) if dm else 'NOT FOUND')
# 주변 텍스트 확인
idx = full_text.find('등록일')
if idx > -1:
    print('Context around 등록일:', repr(full_text[idx:idx+50]))
