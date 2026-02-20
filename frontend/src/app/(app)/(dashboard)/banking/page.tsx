"use client";

import { useState, useEffect } from "react";
import { fetchWithAuth } from "@/api/fetchWithAuth";
import PageTitle from "@/components/PageTitle";
import ProtectedPage from "@/components/ProtectedPage";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";

interface BankItem {
  id: string;
  name: string;
  bic?: string;
  logo?: string;
  country?: string;
  transaction_total_days?: string;
  provider: "gocardless" | "enablebanking";
}

export default function BankingPage() {
  const [banks, setBanks] = useState<BankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBanks();
  }, []);

  async function fetchBanks() {
    setLoading(true);
    setError(null);
    try {
      // Fetch from both providers in parallel
      const [gcRes, ebRes] = await Promise.allSettled([
        fetchWithAuth("/api/banking/institutions?country=pl"),
        fetch("/api/banking/enablebanking/aspsps?country=PL"),
      ]);

      const merged: BankItem[] = [];
      const seenNames = new Set<string>();

      // Enable Banking banks (preferred — direct PSD2, better history)
      if (ebRes.status === "fulfilled" && ebRes.value.ok) {
        const ebData = await ebRes.value.json();
        const aspsps = ebData.aspsps || [];
        for (const aspsp of aspsps) {
          const name = aspsp.name || "";
          const normalizedName = name.toLowerCase().replace(/\s+/g, " ").trim();
          if (!seenNames.has(normalizedName)) {
            seenNames.add(normalizedName);
            merged.push({
              id: `eb:${aspsp.name}:${aspsp.country || "PL"}`,
              name: aspsp.name,
              bic: aspsp.bic,
              logo: aspsp.logo,
              country: aspsp.country,
              transaction_total_days: aspsp.transaction_total_days,
              provider: "enablebanking",
            });
          }
        }
      }

      // GoCardless banks (fallback for banks not in Enable Banking)
      if (gcRes.status === "fulfilled" && gcRes.value.ok) {
        const gcData = await gcRes.value.json();
        const institutions = Array.isArray(gcData) ? gcData : [];
        for (const inst of institutions) {
          const name = inst.name || "";
          const normalizedName = name.toLowerCase().replace(/\s+/g, " ").trim();
          if (!seenNames.has(normalizedName)) {
            seenNames.add(normalizedName);
            merged.push({
              id: inst.id,
              name: inst.name,
              bic: inst.bic,
              logo: inst.logo,
              transaction_total_days: inst.transaction_total_days,
              provider: "gocardless",
            });
          }
        }
      }

      // Sort alphabetically
      merged.sort((a, b) => a.name.localeCompare(b.name));
      setBanks(merged);

      if (merged.length === 0) {
        setError("No banks available. Please try again later.");
      }
    } catch (err: any) {
      setError(err.message || "Could not load banks. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleBankClick(bank: BankItem) {
    setConnectingId(bank.id);
    setError(null);

    try {
      if (bank.provider === "enablebanking") {
        await handleEnableBankingAuth(bank);
      } else {
        await handleGoCardlessAuth(bank);
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to bank");
      setConnectingId(null);
    }
  }

  async function handleEnableBankingAuth(bank: BankItem) {
    const origin = window.location.origin;
    const redirectUrl = `${origin}/banking/callback/enablebanking`;

    const response = await fetch("/api/banking/enablebanking/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        aspsp_name: bank.name,
        aspsp_country: bank.country || "PL",
        redirect_url: redirectUrl,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || "Failed to start bank connection");
    }

    const result = await response.json();

    // Store state for callback verification
    localStorage.setItem("eb_state", result.state);

    // Redirect to bank auth page
    window.location.href = result.url;
  }

  async function handleGoCardlessAuth(bank: BankItem) {
    const origin = window.location.origin;
    const reference = Date.now().toString();
    const redirectUrl = `${origin}/banking/callback?ref=${reference}`;

    const response = await fetchWithAuth("/api/banking/requisitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        redirect: redirectUrl,
        institution_id: bank.id,
        reference,
        user_language: "PL",
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || "Failed to create bank connection");
    }

    const requisition = await response.json();

    localStorage.setItem("gc_requisition_id", requisition.id);
    localStorage.setItem(
      "gc_institution",
      JSON.stringify({ id: bank.id, name: bank.name })
    );

    window.location.href = requisition.link;
  }

  return (
    <ProtectedPage>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8 text-center">
          <PageTitle title="Connect Your Bank" />
          <p className="text-muted-foreground mt-2">
            Select your bank to securely link your account via Open Banking (PSD2)
          </p>
        </div>

        {error && (
          <div className="bg-destructive/15 border border-destructive text-destructive px-4 py-3 rounded-lg mb-6 text-center">
            <p>{error}</p>
            <button
              onClick={() => { setError(null); fetchBanks(); }}
              className="mt-2 text-sm underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Connecting overlay */}
        {connectingId && (
          <div className="flex flex-col items-center gap-3 py-12">
            <FontAwesomeIcon icon={faSpinner} className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">
              Connecting to{" "}
              <span className="font-medium text-foreground">
                {banks.find((b) => b.id === connectingId)?.name || "bank"}
              </span>
              ...
            </p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !connectingId && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 15 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-3 p-4 rounded-xl border bg-card animate-pulse"
              >
                <div className="w-12 h-12 rounded-lg bg-muted" />
                <div className="w-20 h-4 rounded bg-muted" />
              </div>
            ))}
          </div>
        )}

        {/* Bank grid */}
        {!loading && !connectingId && banks.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {banks.map((bank) => (
              <button
                key={bank.id}
                onClick={() => handleBankClick(bank)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-card
                           hover:border-primary hover:shadow-md transition-all cursor-pointer
                           focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                {bank.logo ? (
                  <img
                    src={bank.logo}
                    alt={bank.name}
                    className="w-12 h-12 object-contain"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground">
                    {bank.name.charAt(0)}
                  </div>
                )}
                <span className="text-sm text-center font-medium leading-tight">
                  {bank.name}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !connectingId && banks.length === 0 && !error && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No banks available. Please try again later.</p>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center mt-8">
          Bank connections are secured via PSD2 Open Banking. Your credentials are never stored.
        </p>
      </div>
    </ProtectedPage>
  );
}
