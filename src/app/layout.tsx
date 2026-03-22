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

export const metadata: Metadata = {
  title: {
    default: "Rootline - Map Your Family Story",
    template: "%s | Rootline",
  },
  description:
    "A modern, collaborative family lineage tracking application. Build, explore, and preserve your family tree together.",
  keywords: ["family tree", "genealogy", "lineage", "family history", "ancestry"],
  openGraph: {
    title: "Rootline - Map Your Family Story",
    description:
      "Build, explore, and preserve your family tree together with an interactive visualization.",
    type: "website",
    siteName: "Rootline",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rootline - Map Your Family Story",
    description:
      "Build, explore, and preserve your family tree together with an interactive visualization.",
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
        <body className="min-h-full flex flex-col" suppressHydrationWarning>
          <Providers>
            {children}
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
