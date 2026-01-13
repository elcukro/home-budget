"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t bg-muted/30 py-4 px-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-sm text-muted-foreground">
        <div>
          &copy; {new Date().getFullYear()} FiredUp. Wszystkie prawa zastrzeżone.
        </div>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Polityka Prywatności
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Regulamin
          </Link>
          <a
            href="mailto:contact@firedup.app"
            className="hover:text-foreground transition-colors"
          >
            Kontakt
          </a>
        </div>
      </div>
    </footer>
  );
}
