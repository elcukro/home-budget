"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { useIntl } from "react-intl";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const API_BASE_URL = "/api/backend";

type AcceptState =
  | "loading"
  | "not_signed_in"
  | "preflight"       // checking existing data
  | "choose"          // user has data, must choose
  | "accepting"
  | "success"
  | "error"
  | "expired"
  | "already_linked"
  | "declined";       // user chose to keep own account

interface PreflightData {
  has_existing_data: boolean;
  expense_count: number;
  income_count: number;
  loan_count: number;
  saving_count: number;
}

export default function PartnerAcceptPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const intl = useIntl();
  const token = searchParams.get("token");

  const [state, setState] = useState<AcceptState>("loading");
  const [inviterName, setInviterName] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [preflightData, setPreflightData] = useState<PreflightData | null>(null);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setState("error");
      setErrorMessage("No invitation token provided");
      return;
    }

    const validateToken = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/partner/invite/${token}`);
        if (!response.ok) {
          const data = await response.json();
          if (response.status === 410) {
            setState("expired");
          } else {
            setState("error");
            setErrorMessage(data.detail || "Invalid invitation");
          }
          return;
        }
        const data = await response.json();
        setInviterName(data.inviter_name || "");

        if (status === "unauthenticated") {
          setState("not_signed_in");
        } else if (status === "authenticated") {
          setState("preflight");
        }
      } catch {
        setState("error");
        setErrorMessage("Failed to validate invitation");
      }
    };

    if (status !== "loading") {
      validateToken();
    }
  }, [token, status]);

  // Preflight check — does user have existing data?
  useEffect(() => {
    if (state !== "preflight" || !token || !session?.user?.email) return;

    const runPreflight = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/partner/accept/${token}/preflight`);
        if (!response.ok) {
          // If preflight fails, skip the choice and go straight to accept
          setState("accepting");
          return;
        }
        const data: PreflightData = await response.json();
        setPreflightData(data);

        if (data.has_existing_data) {
          setState("choose");
        } else {
          setState("accepting");
        }
      } catch {
        // If preflight fails, proceed with accept
        setState("accepting");
      }
    };

    runPreflight();
  }, [state, token, session?.user?.email]);

  // Accept invitation
  useEffect(() => {
    if (state !== "accepting" || !token || !session?.user?.email) return;

    const acceptInvitation = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/partner/accept/${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          const data = await response.json();
          if (response.status === 409) {
            setState("already_linked");
          } else if (response.status === 410) {
            setState("expired");
          } else {
            setState("error");
            setErrorMessage(data.detail || "Failed to accept invitation");
          }
          return;
        }

        setState("success");
        setTimeout(() => {
          router.push("/dashboard");
        }, 2000);
      } catch {
        setState("error");
        setErrorMessage("Failed to accept invitation");
      }
    };

    acceptInvitation();
  }, [state, token, session?.user?.email, router]);

  const totalRecords = preflightData
    ? preflightData.expense_count + preflightData.income_count + preflightData.loan_count + preflightData.saving_count
    : 0;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {intl.formatMessage({ id: "partner.accept.title" })}
          </CardTitle>
          {inviterName && (
            <CardDescription className="text-base">
              {intl.formatMessage(
                { id: "partner.accept.description" },
                { name: inviterName }
              )}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {state === "loading" && (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {state === "not_signed_in" && (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                {intl.formatMessage({ id: "partner.accept.signIn" })}
              </p>
              <Button
                onClick={() => signIn("google", { callbackUrl: `/partner/accept?token=${token}` })}
                className="w-full"
                size="lg"
              >
                {intl.formatMessage({ id: "partner.accept.signInButton" })}
              </Button>
            </div>
          )}

          {state === "preflight" && (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground">
                {intl.formatMessage({ id: "partner.accept.checking" })}
              </p>
            </div>
          )}

          {state === "choose" && preflightData && (
            <div className="space-y-4">
              {/* Warning about existing data */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
                <p className="font-medium text-amber-800">
                  {intl.formatMessage({ id: "partner.accept.hasDataWarning" })}
                </p>
                <p className="text-sm text-amber-700">
                  {intl.formatMessage(
                    { id: "partner.accept.hasDataDetails" },
                    { count: totalRecords }
                  )}
                </p>
                {/* Data summary */}
                <div className="grid grid-cols-2 gap-1 text-xs text-amber-600 mt-2">
                  {preflightData.expense_count > 0 && (
                    <span>{intl.formatMessage({ id: "partner.accept.dataExpenses" }, { count: preflightData.expense_count })}</span>
                  )}
                  {preflightData.income_count > 0 && (
                    <span>{intl.formatMessage({ id: "partner.accept.dataIncome" }, { count: preflightData.income_count })}</span>
                  )}
                  {preflightData.loan_count > 0 && (
                    <span>{intl.formatMessage({ id: "partner.accept.dataLoans" }, { count: preflightData.loan_count })}</span>
                  )}
                  {preflightData.saving_count > 0 && (
                    <span>{intl.formatMessage({ id: "partner.accept.dataSavings" }, { count: preflightData.saving_count })}</span>
                  )}
                </div>
              </div>

              {/* Download own data button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  try {
                    const response = await fetch(`${API_BASE_URL}/partner/accept/${token}/export`);
                    if (!response.ok) throw new Error("Export failed");
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `firedup-backup-${session?.user?.email || "data"}.json`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                  } catch {
                    setErrorMessage("Failed to download data");
                  }
                }}
              >
                {intl.formatMessage({ id: "partner.accept.downloadData" })}
              </Button>

              <Separator />

              {/* Choice: Join household */}
              <div className="space-y-2">
                <Button
                  onClick={() => setState("accepting")}
                  className="w-full"
                  size="lg"
                >
                  {intl.formatMessage(
                    { id: "partner.accept.joinHousehold" },
                    { name: inviterName }
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  {intl.formatMessage({ id: "partner.accept.joinHouseholdNote" })}
                </p>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-muted-foreground">
                    {intl.formatMessage({ id: "partner.accept.or" })}
                  </span>
                </div>
              </div>

              {/* Choice: Keep own account */}
              <div className="space-y-2">
                <Button
                  onClick={() => setState("declined")}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  {intl.formatMessage({ id: "partner.accept.keepOwnAccount" })}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  {intl.formatMessage({ id: "partner.accept.keepOwnAccountNote" })}
                </p>
              </div>
            </div>
          )}

          {state === "accepting" && (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground">
                {intl.formatMessage({ id: "partner.accept.processing" })}
              </p>
            </div>
          )}

          {state === "success" && (
            <div className="text-center space-y-3 py-4">
              <div className="text-4xl">🎉</div>
              <p className="text-lg font-medium text-emerald-600">
                {intl.formatMessage({ id: "partner.accept.success" })}
              </p>
              <p className="text-sm text-muted-foreground">
                {intl.formatMessage({ id: "partner.accept.redirecting" })}
              </p>
            </div>
          )}

          {state === "declined" && (
            <div className="text-center space-y-3 py-4">
              <p className="text-muted-foreground">
                {intl.formatMessage({ id: "partner.accept.declinedMessage" })}
              </p>
              <Button
                onClick={() => router.push("/dashboard")}
                variant="outline"
              >
                {intl.formatMessage({ id: "partner.accept.goToDashboard" })}
              </Button>
            </div>
          )}

          {state === "expired" && (
            <div className="text-center space-y-3 py-4">
              <p className="text-destructive font-medium">
                {intl.formatMessage({ id: "partner.accept.expired" })}
              </p>
            </div>
          )}

          {state === "already_linked" && (
            <div className="text-center space-y-3 py-4">
              <p className="text-amber-600 font-medium">
                {intl.formatMessage({ id: "partner.accept.alreadyLinked" })}
              </p>
              <Button
                onClick={() => router.push("/dashboard")}
                variant="outline"
              >
                {intl.formatMessage({ id: "partner.accept.goToDashboard" })}
              </Button>
            </div>
          )}

          {state === "error" && (
            <div className="text-center space-y-3 py-4">
              <p className="text-destructive font-medium">
                {errorMessage}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}