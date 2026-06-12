import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { GraduationCap, Home, School, CalendarDays, BookOpen, Search, FileText } from 'lucide-react';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '메가스터디 입시정보 대시보드',
  description: 'AI 기반 대학입시 정보 분석 플랫폼',
};

const navItems = [
  { href: '/', label: '홈', icon: Home },
  { href: '/universities', label: '학교별', icon: School },
  { href: '/years', label: '연도별', icon: CalendarDays },
  { href: '/admission-types', label: '전형별', icon: BookOpen },
  { href: '/archive', label: '발표자료', icon: FileText },
  { href: '/search', label: 'AI 검색', icon: Search },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center h-16 gap-8">
                <Link href="/" className="flex items-center gap-2 font-bold text-lg text-blue-700 shrink-0">
                  <GraduationCap className="w-6 h-6" />
                  입시 대시보드
                </Link>
                <div className="flex items-center gap-1">
                  {navItems.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </nav>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
