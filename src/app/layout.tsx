import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-gradient-to-br from-gray-100 via-gray-50 to-stone-100 dark:from-gray-950 dark:via-gray-900 dark:to-stone-950" suppressHydrationWarning>
          <Providers>
            {children}
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
