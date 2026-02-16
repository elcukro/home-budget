import type { Metadata } from "next";
import "./globals.css";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import AuthProvider from "@/components/AuthProvider";
import IntlProviderWrapper from "@/components/IntlProviderWrapper";
import InactivityChecker from "@/components/InactivityChecker";
import ChartInitializer from "@/components/ChartInitializer";
import ChunkErrorHandler from "@/components/ChunkErrorHandler";
import ErrorBoundary from "@/components/ErrorBoundary";
import { PostHogProvider } from "@/components/providers/PostHogProvider";
import CookieConsent from "@/components/CookieConsent";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://firedup.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "FiredUp - Budżet domowy i droga do wolności finansowej",
    template: "%s | FiredUp",
  },
  description: "Zarządzaj budżetem domowym, spłacaj długi i osiągnij wolność finansową z metodą Baby Steps. Aplikacja do budżetowania dostosowana do polskiego systemu finansowego.",
  alternates: {
    canonical: "/",
  },
  keywords: ["budżet domowy", "finanse osobiste", "FIRE", "wolność finansowa", "Baby Steps", "Dave Ramsey", "IKE", "IKZE", "PPK", "oszczędzanie"],
  authors: [{ name: "FiredUp" }],
  creator: "FiredUp",
  openGraph: {
    type: "website",
    locale: "pl_PL",
    url: siteUrl,
    siteName: "FiredUp",
    title: "FiredUp - Twoja droga do wolności finansowej",
    description: "Koniec z życiem od wypłaty do wypłaty. Zarządzaj budżetem, spłacaj długi i osiągnij niezależność finansową.",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "FiredUp - Aplikacja do zarządzania finansami osobistymi",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FiredUp - Twoja droga do wolności finansowej",
    description: "Koniec z życiem od wypłaty do wypłaty. Zarządzaj budżetem i osiągnij niezależność finansową.",
    images: ["/images/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Add your verification codes here when needed
    // google: "your-google-verification-code",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "FiredUp",
  url: siteUrl,
  logo: `${siteUrl}/logo.png`,
  description:
    "Aplikacja do zarządzania budżetem domowym i osiągania wolności finansowej. Metoda Baby Steps dostosowana do polskiego systemu finansowego.",
  foundingDate: "2025",
  sameAs: [],
  contactPoint: {
    "@type": "ContactPoint",
    email: "kontakt@firedup.app",
    contactType: "customer service",
    availableLanguage: "Polish",
  },
};

const webSiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "FiredUp",
  url: siteUrl,
  description:
    "Zarządzaj budżetem domowym, spłacaj długi i osiągnij niezależność finansową.",
  inLanguage: "pl",
  publisher: {
    "@type": "Organization",
    name: "FiredUp",
    url: siteUrl,
  },
};

const softwareAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "FiredUp",
  url: siteUrl,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description:
    "Aplikacja do zarządzania budżetem domowym z metodą Baby Steps, śledzeniem wydatków, spłatą długów i planowaniem finansowym.",
  offers: [
    {
      "@type": "Offer",
      price: "0",
      priceCurrency: "PLN",
      name: "Darmowy",
      description: "Plan darmowy z podstawowymi funkcjami",
    },
    {
      "@type": "Offer",
      price: "19.99",
      priceCurrency: "PLN",
      name: "Premium Miesięczny",
      description:
        "Pełny dostęp: brak limitów, integracja z bankiem, analiza AI",
    },
    {
      "@type": "Offer",
      price: "149",
      priceCurrency: "PLN",
      name: "Premium Roczny",
      description: "Oszczędzasz 37% - pełny dostęp na cały rok",
    },
  ],
  featureList: [
    "Śledzenie wydatków i przychodów",
    "Metoda Baby Steps (7 kroków)",
    "Spłacanie kredytów metodą kuli śnieżnej",
    "Integracja z polskimi bankami",
    "Rekomendacje AI",
    "Wsparcie dla IKE, IKZE, PPK",
  ],
  inLanguage: "pl",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(webSiteJsonLd),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(softwareAppJsonLd),
          }}
        />
        <ChunkErrorHandler />
        <ErrorBoundary>
          <AuthProvider>
            <PostHogProvider>
              <SettingsProvider>
                <SubscriptionProvider>
                  <IntlProviderWrapper>
                    <ChartInitializer />
                    {children}
                    <InactivityChecker />
                    <CookieConsent />
                  </IntlProviderWrapper>
                </SubscriptionProvider>
              </SettingsProvider>
            </PostHogProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
