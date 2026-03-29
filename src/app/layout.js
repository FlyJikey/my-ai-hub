import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "./AppShell";
import { themeInitScript } from "./theme-script";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "AI Hub Dashboard",
  description: "Free E-commerce AI Integration Platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={inter.className}>
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
