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
  thumbnail?: string;
}

export const manualPages: ManualPage[] = [
  { slug: 'dashboard', title: 'Panel główny', icon: LayoutDashboard, thumbnail: '/images/manual/dashboard-overview.png' },
  { slug: 'income', title: 'Przychody', icon: TrendingUp, thumbnail: '/images/manual/income-sources.png' },
  { slug: 'expenses', title: 'Wydatki', icon: Receipt, thumbnail: '/images/manual/expenses-list.png' },
  { slug: 'loans', title: 'Kredyty i dług', icon: Landmark, thumbnail: '/images/manual/loans-list.png' },
  { slug: 'savings', title: 'Cele oszczędnościowe', icon: Target, thumbnail: '/images/manual/savings-goals.png' },
  { slug: 'financial-freedom', title: 'Wolność finansowa', icon: Footprints, thumbnail: '/images/manual/financial-freedom-steps.png' },
  { slug: 'bank-transactions', title: 'Transakcje bankowe', icon: Building2, thumbnail: '/images/manual/bank-transactions-list.png' },
  { slug: 'reports', title: 'Raporty', icon: BarChart3, thumbnail: '/images/manual/reports-breakdown.png' },
  { slug: 'ai-analysis', title: 'Analiza AI', icon: Sparkles, thumbnail: '/images/manual/ai-analysis-insights.png' },
  { slug: 'settings', title: 'Ustawienia', icon: Settings, thumbnail: '/images/manual/settings-profile.png' },
  { slug: 'premium', title: 'Pakiet Premium', icon: Crown },
];
