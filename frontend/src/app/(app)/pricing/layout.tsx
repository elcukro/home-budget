import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cennik - Darmowy plan i Premium od 19,99 zł/mies.",
  description:
    "Porównaj plany FiredUp: darmowy z podstawowymi funkcjami budżetowania i Premium z integracją bankową, analizą AI i nieograniczonymi wpisami. Oszczędź 17% z planem rocznym.",
  alternates: {
    canonical: "/pricing",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
