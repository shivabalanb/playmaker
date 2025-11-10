import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import { DisplayedMatchesProvider } from "@/contexts/DisplayedMatchesContext";
import { GlobalAIChat } from "@/components/GlobalAIChat";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Playmaker - League of Legends Analytics",
  description: "AI-powered League of Legends match analysis and performance insights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <WebSocketProvider>
          <DisplayedMatchesProvider>
            {children}
            <GlobalAIChat />
          </DisplayedMatchesProvider>
        </WebSocketProvider>
      </body>
    </html>
  );
}
