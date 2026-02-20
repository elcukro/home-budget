"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner, faCheckCircle, faTimesCircle } from "@fortawesome/free-solid-svg-icons";

type CallbackState = "loading" | "success" | "error";

export default function BankingCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<CallbackState>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (!ref) {
      setState("error");
      setMessage("Missing reference parameter. Please try connecting your bank again.");
      return;
    }

    completeConnection(ref);
  }, [searchParams]);

  const completeConnection = async (reference: string) => {
    try {
      // Look up requisition by reference to get the requisition ID
      // The reference was stored when creating the requisition
      const reqResponse = await fetch(`/api/banking/requisitions/${reference}`);
      if (!reqResponse.ok) {
        throw new Error("Failed to find bank connection request");
      }
      const requisition = await reqResponse.json();

      if (!requisition.accounts || requisition.accounts.length === 0) {
        throw new Error("No accounts were linked. The bank authorization may have been cancelled.");
      }

      // Fetch account details for names
      const accountNames: Record<string, string> = {};
      for (const accountId of requisition.accounts) {
        try {
          const detailsRes = await fetch(`/api/banking/accounts/${accountId}/details`);
          if (detailsRes.ok) {
            const details = await detailsRes.json();
            const ownerName = details.account?.ownerName;
            const product = details.account?.product;
            const iban = details.account?.iban;
            // Build a display name: "Product (****1234)" or "Owner Name"
            if (product && iban) {
              accountNames[accountId] = `${product} (****${iban.slice(-4)})`;
            } else if (ownerName) {
              accountNames[accountId] = ownerName;
            }
          }
        } catch {
          // Non-critical, continue
        }
      }

      // Save the connection
      const connectionResponse = await fetch("/api/banking/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institution_id: requisition.institution_id || "unknown",
          institution_name: requisition.institution_id || "Bank",
          requisition_id: requisition.id,
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          accounts: requisition.accounts,
          account_names: accountNames,
        }),
      });

      if (!connectionResponse.ok) {
        const errData = await connectionResponse.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to save banking connection");
      }

      setState("success");
      setMessage(`Successfully connected ${requisition.accounts.length} account(s)!`);

      // Redirect to settings after a brief moment
      setTimeout(() => {
        router.push("/settings?tab=banking");
      }, 2000);
    } catch (err: any) {
      setState("error");
      setMessage(err.message || "An unexpected error occurred");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Bank Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <FontAwesomeIcon icon={faSpinner} className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Completing bank connection...</p>
            </div>
          )}

          {state === "success" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <FontAwesomeIcon icon={faCheckCircle} className="w-8 h-8 text-green-500" />
              <p className="text-green-700 font-medium">{message}</p>
              <p className="text-sm text-muted-foreground">Redirecting to settings...</p>
            </div>
          )}

          {state === "error" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <FontAwesomeIcon icon={faTimesCircle} className="w-8 h-8 text-red-500" />
              <p className="text-red-700 font-medium">{message}</p>
              <Button
                variant="outline"
                onClick={() => router.push("/settings?tab=banking")}
              >
                Back to Settings
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
