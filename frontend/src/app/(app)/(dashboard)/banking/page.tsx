"use client";

import { useState, useEffect } from "react";
import { fetchWithAuth } from "@/api/fetchWithAuth";
import PageTitle from "@/components/PageTitle";
import ProtectedPage from "@/components/ProtectedPage";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";

interface Institution {
  id: string;
  name: string;
  bic: string;
  logo: string;
  countries: string[];
  transaction_total_days: string;
  max_access_valid_for_days: string;
}

export default function BankingPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  useEffect(() => {
    fetchInstitutions();
  }, []);

  async function fetchInstitutions() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWithAuth("/api/banking/institutions?country=pl");
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to fetch institutions");
      }
      const data: Institution[] = await response.json();
      setInstitutions(data);
    } catch (err: any) {
      setError(err.message || "Could not load banks. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleBankClick(institution: Institution) {
    setConnectingId(institution.id);
    setError(null);

    try {
      const origin = window.location.origin;
      const reference = Date.now().toString();
      const redirectUrl = `${origin}/banking/callback?ref=${reference}`;

      const response = await fetchWithAuth("/api/banking/requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect: redirectUrl,
          institution_id: institution.id,
          reference,
          user_language: "PL",
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to create bank connection");
      }

      const requisition = await response.json();

      // Store for callback page
      localStorage.setItem("gc_requisition_id", requisition.id);
      localStorage.setItem(
        "gc_institution",
        JSON.stringify({ id: institution.id, name: institution.name })
      );

      // Redirect to GoCardless bank auth
      window.location.href = requisition.link;
    } catch (err: any) {
      setError(err.message || "Failed to connect to bank");
      setConnectingId(null);
    }
  }

  return (
    <ProtectedPage>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8 text-center">
          <PageTitle title="Connect Your Bank" />
          <p className="text-muted-foreground mt-2">
            Select your bank to securely link your account via GoCardless
          </p>
        </div>

        {error && (
          <div className="bg-destructive/15 border border-destructive text-destructive px-4 py-3 rounded-lg mb-6 text-center">
            <p>{error}</p>
            <button
              onClick={() => { setError(null); fetchInstitutions(); }}
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
                {institutions.find((i) => i.id === connectingId)?.name || "bank"}
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
        {!loading && !connectingId && institutions.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {institutions.map((bank) => (
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
        {!loading && !connectingId && institutions.length === 0 && !error && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No banks available. Please try again later.</p>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center mt-8">
          Bank connections are secured by GoCardless (Nordigen). Your credentials are never stored.
        </p>
      </div>
    </ProtectedPage>
  );
}
