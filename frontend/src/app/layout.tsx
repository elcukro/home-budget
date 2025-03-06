import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from 'next-themes';
import { SettingsProvider } from '@/contexts/SettingsContext';
import PageTitle from "@/components/PageTitle";
import AuthProvider from "@/components/AuthProvider";
import IntlProviderWrapper from "@/components/IntlProviderWrapper";
import InactivityChecker from "@/components/InactivityChecker";
import { headers } from 'next/headers';
import ChartInitializer from "@/components/ChartInitializer";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

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
      <body className={inter.className}>
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <SettingsProvider>
              <IntlProviderWrapper>
                <ChartInitializer />
                <div className="flex min-h-screen bg-background">
                  {!isAuthPage && <Sidebar />}
                  <main className={`flex-1 ${!isAuthPage ? 'p-8' : ''}`}>
                    {children}
                  </main>
                </div>
                {!isAuthPage && <Toaster position="top-right" />}
                <InactivityChecker />
              </IntlProviderWrapper>
            </SettingsProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
