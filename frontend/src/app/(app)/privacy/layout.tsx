import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Polityka Prywatności - Ochrona danych osobowych i RODO",
  description:
    "Dowiedz się jak FiredUp chroni Twoje dane osobowe i finansowe. Polityka prywatności zgodna z RODO, informacje o Tink i bezpieczeństwie danych bankowych.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
