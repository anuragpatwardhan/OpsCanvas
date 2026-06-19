import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OpsCanvas — Engineering situational awareness",
  description:
    "A manager-centric operational command center. Convert noisy Jira, GitHub, and Slack activity into actionable signals.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="bg-bg text-ink antialiased font-sans">
        <div className="fixed inset-0 ambient-grid pointer-events-none opacity-60" />
        <div className="fixed inset-0 spotlight pointer-events-none" />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
