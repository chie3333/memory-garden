import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '기억 정원사',
  description: '정리하지 않아도 기억을 잃어버리지 않게 해주는 개인 아카이브',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
