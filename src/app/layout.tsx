import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Providers } from "@/components/layout/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["700"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rootline.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Rootline - Map Your Family Story",
    template: "%s | Rootline",
  },
  description:
    "A modern, collaborative family lineage tracking application. Build, explore, and preserve your family tree together.",
  keywords: [
    "family tree",
    "genealogy",
    "lineage",
    "family history",
    "ancestry",
    "family tree builder",
    "GEDCOM",
    "collaborative family tree",
    "family tree visualization",
  ],
  authors: [{ name: "Rootline" }],
  creator: "Rootline",
  openGraph: {
    title: "Rootline - Map Your Family Story",
    description:
      "Build, explore, and preserve your family tree together with an interactive visualization.",
    url: siteUrl,
    type: "website",
    siteName: "Rootline",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rootline - Map Your Family Story",
    description:
      "Build, explore, and preserve your family tree together with an interactive visualization.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplay.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-gradient-to-br from-stone-50 via-neutral-50 to-stone-100 dark:from-stone-900 dark:via-neutral-900 dark:to-stone-950" suppressHydrationWarning>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:rounded-md focus:ring-2 focus:ring-ring"
          >
            Skip to content
          </a>
          <Providers>
            <div id="main-content">
              {children}
            </div>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
