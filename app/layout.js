export const metadata = {
  title: "DJ Live - ?? ??? ?? ??? ???? ????",
  description: "Interactive DJ animation and mixer running on Vercel",
};

import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
