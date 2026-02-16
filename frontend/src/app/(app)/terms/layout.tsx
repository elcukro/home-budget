import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Regulamin Usługi - Warunki korzystania z aplikacji",
  description:
    "Regulamin korzystania z aplikacji FiredUp do zarządzania budżetem domowym. Zasady rejestracji, połączenia z bankiem przez Tink, ochrona danych i prawa użytkownika.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
