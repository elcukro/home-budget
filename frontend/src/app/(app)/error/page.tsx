'use client';

import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function AuthError() {
  const searchParams = useSearchParams();
  const error = searchParams?.get("error");

  const getErrorMessage = (error: string) => {
    switch (error) {
      case "Configuration":
        return "There is a problem with the server configuration.";
      case "AccessDenied":
        return "You do not have permission to sign in.";
      case "Verification":
        return "The verification link has expired or has already been used.";
      default:
        return "An error occurred during authentication.";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full space-y-8 p-8 card">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-primary">
            Authentication Error
          </h2>
          <p className="mt-2 text-sm text-subtle">
            {error ? getErrorMessage(error) : "An unknown error occurred"}
          </p>
        </div>

        <div className="mt-8">
          <Link
            href="/auth/signin"
            className="w-full flex justify-center rounded-md border border-border bg-card py-2 px-4 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-secondary"
          >
            Return to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
} 
