"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner, faCheckCircle, faTimesCircle } from "@fortawesome/free-solid-svg-icons";

type CallbackState = "loading" | "success" | "error";

export default function EnableBankingCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<CallbackState>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");

    if (!code || !stateParam) {
      setState("error");
      setMessage("Missing authorization code or state. Please try connecting your bank again.");
      return;
    }

    completeConnection(code, stateParam);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  async function completeConnection(code: string, stateToken: string) {
    try {
      const response = await fetch("/api/banking/enablebanking/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, state: stateToken }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || "Failed to complete bank connection");
      }

      const connection = await response.json();
      const accountCount = connection.accounts?.length || 0;
      const bankName = connection.aspsp_name || "Bank";

      setState("success");
      setMessage(
        `Successfully connected ${accountCount} account${accountCount !== 1 ? "s" : ""} from ${bankName}!`
      );

      // Clean up localStorage if set during bank selection
      localStorage.removeItem("eb_state");

      setTimeout(() => {
        router.push("/settings?tab=integrations");
      }, 2000);
    } catch (err: any) {
      setState("error");
      setMessage(err.message || "An unexpected error occurred");
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Bank Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <FontAwesomeIcon
                icon={faSpinner}
                className="w-8 h-8 animate-spin text-primary"
              />
              <p className="text-muted-foreground">Completing bank connection...</p>
            </div>
          )}

          {state === "success" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <FontAwesomeIcon
                icon={faCheckCircle}
                className="w-8 h-8 text-green-500"
              />
              <p className="text-green-700 font-medium">{message}</p>
              <p className="text-sm text-muted-foreground">
                Redirecting to settings...
              </p>
            </div>
          )}

          {state === "error" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <FontAwesomeIcon
                icon={faTimesCircle}
                className="w-8 h-8 text-red-500"
              />
              <p className="text-red-700 font-medium">{message}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => router.push("/banking")}>
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push("/settings?tab=integrations")}
                >
                  Back to Settings
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
