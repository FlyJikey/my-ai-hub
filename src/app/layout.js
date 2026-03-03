import { Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "./context/AppContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "AI Hub Dashboard",
  description: "Free E-commerce AI Integration Platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body className={inter.className}>
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
