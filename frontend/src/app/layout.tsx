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
    default: "FiredUp - Twoja droga do wolności finansowej",
    template: "%s | FiredUp",
  },
  description: "Zarządzaj budżetem domowym, spłacaj długi i osiągnij niezależność finansową. Metoda Baby Steps dostosowana do polskiego systemu finansowego.",
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <body className="font-sans antialiased">
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
