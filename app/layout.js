export const metadata = {
  title: '2025 Oyun Takibi',
  description: 'Aylık oyun takip takvimi',
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body style={{ margin: 0, padding: 0, background: '#0e0e12' }}>
        {children}
      </body>
    </html>
  );
}
