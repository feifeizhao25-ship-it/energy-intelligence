import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "FutureX — AI Agent Operating System",
  description:
    "Discover, install, and execute AI Agents through a single chat interface. The future of AI-powered automation.",
  keywords: ["AI", "agents", "automation", "marketplace", "FutureX"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Sidebar />
        <main
          style={{
            marginLeft: "var(--sidebar-width)",
            minHeight: "100vh",
          }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}
