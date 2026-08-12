import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ELASTICO — AI-Powered Football Analytics Platform",
  description: "ELASTICO — Professional football analytics platform with ELO predictions, AI chat, live match tracking, and 100+ analytical tools. World Cup 2026 companion.",
  keywords: ["ELASTICO", "football analytics", "AI predictions", "World Cup 2026", "ELO ratings", "soccer"],
  authors: [{ name: "ELASTICO Team" }],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ELASTICO",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      { url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%2310B981'/><text x='50' y='72' font-size='65' font-weight='bold' text-anchor='middle' fill='white'>E</text></svg>", sizes: "any" },
    ],
    apple: [
      { url: "/icons/icon-152x152.png", sizes: "152x152" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "theme-color": "#10B981",
    "msapplication-TileColor": "#0B0E14",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ELASTICO" />
        <link rel="apple-touch-icon" href="/icons/icon-152x152.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
        style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}