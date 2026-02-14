import type { Metadata } from "next";
import "../globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Sign In - Home Budget",
  description: "Sign in to your Home Budget account",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      {children}
      <SonnerToaster />
    </div>
  );
}
