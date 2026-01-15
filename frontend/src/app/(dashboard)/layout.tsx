'use client';

import Sidebar from "@/components/Sidebar";
import Footer from "@/components/Footer";
import { Toaster as SonnerToaster } from "@/components/ui/toaster";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
      <Footer />
      <SonnerToaster />
    </div>
  );
}
