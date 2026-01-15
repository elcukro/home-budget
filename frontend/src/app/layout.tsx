import type { Metadata } from "next";
import "./globals.css";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import AuthProvider from "@/components/AuthProvider";
import IntlProviderWrapper from "@/components/IntlProviderWrapper";
import InactivityChecker from "@/components/InactivityChecker";
import ChartInitializer from "@/components/ChartInitializer";
import ChunkErrorHandler from "@/components/ChunkErrorHandler";

export const metadata: Metadata = {
  title: "FiredUp - Twoja droga do wolności finansowej",
  description: "Zarządzaj budżetem domowym, spłacaj długi i osiągnij niezależność finansową",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ChunkErrorHandler />
        <AuthProvider>
          <SettingsProvider>
            <SubscriptionProvider>
              <IntlProviderWrapper>
                <ChartInitializer />
                {children}
                <InactivityChecker />
              </IntlProviderWrapper>
            </SubscriptionProvider>
          </SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
