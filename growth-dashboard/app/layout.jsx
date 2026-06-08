import "./globals.css";

export const metadata = {
  title: "LanguageForest 그로스 대시보드",
  description: "Mixpanel 퍼널 · 리텐션 대시보드 (Phase 1)",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
