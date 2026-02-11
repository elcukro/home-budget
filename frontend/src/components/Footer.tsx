"use client";

import { useState } from "react";
import LegalOverlay from "@/components/landing/LegalOverlay";

export default function Footer() {
  const [legalOverlay, setLegalOverlay] = useState<'privacy' | 'terms' | null>(null);

  return (
    <>
      <footer className="border-t bg-muted/30 py-4 px-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-sm text-muted-foreground">
          <div>
            &copy; {new Date().getFullYear()} FiredUp. Wszystkie prawa zastrzeżone.
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setLegalOverlay('privacy')}
              className="hover:text-foreground transition-colors"
            >
              Polityka Prywatności
            </button>
            <button
              onClick={() => setLegalOverlay('terms')}
              className="hover:text-foreground transition-colors"
            >
              Regulamin
            </button>
            <a
              href="mailto:contact@firedup.app"
              className="hover:text-foreground transition-colors"
            >
              Kontakt
            </a>
          </div>
        </div>
      </footer>
      {legalOverlay && (
        <LegalOverlay
          type={legalOverlay}
          onClose={() => setLegalOverlay(null)}
        />
      )}
    </>
  );
}
