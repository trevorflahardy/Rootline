import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export const metadata: Metadata = {
  title: "Rootline - Map Your Family Story",
  description:
    "Build, explore, and preserve your family tree together. Rootline is a modern, collaborative family lineage tracker with interactive visualization, GEDCOM import/export, and smart permissions.",
  alternates: {
    canonical: "/",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://rootline.app";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Rootline",
    url: siteUrl,
    description:
      "A modern, collaborative family lineage tracking application. Build, explore, and preserve your family tree together.",
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Interactive family tree visualization",
      "Collaborative editing",
      "GEDCOM import and export",
      "Relationship discovery",
      "Smart permissions",
      "Change history and snapshots",
    ],
  };

  return (
    <>
      {/* jsonLd contains only hardcoded static server constants — no user-controlled data flows in. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
