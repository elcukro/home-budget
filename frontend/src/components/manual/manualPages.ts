import {
  LayoutDashboard,
  TrendingUp,
  Receipt,
  Landmark,
  Target,
  Footprints,
  Building2,
  BarChart3,
  Sparkles,
  Settings,
  Crown,
  type LucideIcon,
} from 'lucide-react';

export interface ManualPage {
  slug: string;
  title: string;
  icon: LucideIcon;
}

export const manualPages: ManualPage[] = [
  { slug: 'dashboard', title: 'Panel główny', icon: LayoutDashboard },
  { slug: 'income', title: 'Przychody', icon: TrendingUp },
  { slug: 'expenses', title: 'Wydatki', icon: Receipt },
  { slug: 'loans', title: 'Kredyty i dług', icon: Landmark },
  { slug: 'savings', title: 'Cele oszczędnościowe', icon: Target },
  { slug: 'financial-freedom', title: 'Wolność finansowa', icon: Footprints },
  { slug: 'bank-transactions', title: 'Transakcje bankowe', icon: Building2 },
  { slug: 'reports', title: 'Raporty', icon: BarChart3 },
  { slug: 'ai-analysis', title: 'Analiza AI', icon: Sparkles },
  { slug: 'settings', title: 'Ustawienia', icon: Settings },
  { slug: 'premium', title: 'Pakiet Premium', icon: Crown },
];
