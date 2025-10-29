import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { Toaster as SonnerToaster } from "@/components/ui/toaster";
import { SettingsProvider } from "@/contexts/SettingsContext";
import PageTitle from "@/components/PageTitle";
import AuthProvider from "@/components/AuthProvider";
import IntlProviderWrapper from "@/components/IntlProviderWrapper";
import InactivityChecker from "@/components/InactivityChecker";
import { headers } from 'next/headers';
import ChartInitializer from "@/components/ChartInitializer";

export const metadata: Metadata = {
  title: "Home Budget",
  description: "Track and manage your personal finances",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = headers();
  const pathname = headersList.get('x-pathname') || '';
  const isAuthPage = pathname.startsWith('/auth');

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <AuthProvider>
          <SettingsProvider>
            <IntlProviderWrapper>
              <ChartInitializer />
              <div className="flex min-h-screen bg-background">
                {!isAuthPage && <Sidebar />}
                <main className={`flex-1 ${!isAuthPage ? 'p-8' : ''}`}>
                  {children}
                </main>
              </div>
              {!isAuthPage && <SonnerToaster />}
              <InactivityChecker />
            </IntlProviderWrapper>
          </SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
