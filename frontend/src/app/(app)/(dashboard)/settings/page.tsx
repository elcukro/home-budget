"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useIntl } from "react-intl";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

import { useSettings } from "@/contexts/SettingsContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { logger } from "@/lib/logger";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCrown,
  faInfinity,
  faTriangleExclamation,
  faUser,
  faGlobe,
  faPiggyBank,
  faReceipt,
  faBuilding,
  faDatabase,
  faArrowsRotate,
  faCodeMerge,
  faTrashCanArrowUp,
} from "@fortawesome/free-solid-svg-icons";
import { signOut } from "next-auth/react";

// Use Next.js API proxy for all backend calls to ensure auth headers are added
const API_BASE_URL = "/api/backend";

interface ExportBackup {
  id: number;
  format: "json" | "csv" | "xlsx";
  filename: string;
  size_bytes: number | null;
  created_at: string;
}

interface TinkAccount {
  id: string;
  name?: string;
  iban?: string;
  currency?: string;
  type?: string;
}

interface TinkConnection {
  id: number;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  token_expires_at: string | null;
  accounts: TinkAccount[];
}

interface UserSettings {
  id: number;
  user_id: string;
  language: string;
  currency: string;
  ai?: {
    apiKey?: string;
  };
  emergency_fund_target: number;
  emergency_fund_months: number;
  // Polish tax profile
  employment_status?: string | null;
  tax_form?: string | null;
  birth_year?: number | null;
  use_authors_costs?: boolean;
  ppk_enrolled?: boolean | null;
  ppk_employee_rate?: number | null;
  ppk_employer_rate?: number | null;
  ppk_enrollment_date?: string | null;  // Date when user enrolled in PPK (employment contract start)
  employment_type?: string | null;      // Employment type: 'uop', 'b2b', 'jdg', etc.
  children_count?: number;
  // Life data
  include_partner_finances?: boolean;
  // Partner tax profile
  partner_name?: string | null;
  partner_employment_status?: string | null;
  partner_tax_form?: string | null;
  partner_birth_year?: number | null;
  partner_use_authors_costs?: boolean;
  partner_ppk_enrolled?: boolean | null;
  partner_ppk_employee_rate?: number | null;
  partner_ppk_employer_rate?: number | null;
  // Onboarding status
  onboarding_completed?: boolean;
  onboarding_completed_at?: string | null;
  created_at: string;
  updated_at: string | null;
}

const languages = [
  { code: "en", name: "settings.languages.en" },
  { code: "pl", name: "settings.languages.pl" },
  { code: "es", name: "settings.languages.es" },
];

const currencies = [
  { code: "USD", symbol: "$", name: "settings.currencies.USD" },
  { code: "PLN", symbol: "zł", name: "settings.currencies.PLN" },
  { code: "EUR", symbol: "€", name: "settings.currencies.EUR" },
  { code: "GBP", symbol: "£", name: "settings.currencies.GBP" },
  { code: "JPY", symbol: "¥", name: "settings.currencies.JPY" },
];

const employmentStatuses = [
  { code: "employee", name: "settings.taxProfile.employmentStatuses.employee" },
  { code: "b2b", name: "settings.taxProfile.employmentStatuses.b2b" },
  { code: "contract", name: "settings.taxProfile.employmentStatuses.contract" },
  { code: "freelancer", name: "settings.taxProfile.employmentStatuses.freelancer" },
  { code: "business", name: "settings.taxProfile.employmentStatuses.business" },
  { code: "unemployed", name: "settings.taxProfile.employmentStatuses.unemployed" },
];

// Auto-select tax form based on employment status (Polish tax rules)
const defaultTaxFormForStatus: Record<string, string> = {
  employee: "scale",    // UoP → skala podatkowa (12%/32%)
  b2b: "linear",        // JDG → podatek liniowy (19%)
  business: "linear",   // Firma → liniowy domyślnie
  contract: "scale",    // Zlecenie → skala
  freelancer: "scale",  // Freelancer → skala
  unemployed: "",
};

// PPK is only available for UoP employees
const hasPpk = (status: string | null | undefined) => status === "employee";

// KUP 50% applies to UoP, zlecenie, dzieło — NOT B2B/JDG
const hasAuthorsCosts = (status: string | null | undefined) =>
  ["employee", "contract", "freelancer"].includes(status ?? "");

const taxForms = [
  { code: "scale", name: "settings.taxProfile.taxForms.scale" },
  { code: "linear", name: "settings.taxProfile.taxForms.linear" },
  { code: "lumpsum", name: "settings.taxProfile.taxForms.lumpsum" },
  { code: "card", name: "settings.taxProfile.taxForms.card" },
];

export default function SettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const intl = useIntl();
  const { toast } = useToast();
  const { updateSettings: updateContextSettings } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('general');

  // Sync tab state with URL parameter (handles both initial load and navigation)
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    const onboardingRedirect = searchParams.get('onboarding');

    if (tabFromUrl === 'general') {
      setActiveTab('general');
    } else if (tabFromUrl === 'finance') {
      setActiveTab('finance');
    } else if (tabFromUrl === 'integrations') {
      setActiveTab('integrations');
    } else if (tabFromUrl === 'data') {
      setActiveTab('data');
    } else if (tabFromUrl === 'billing') {
      setActiveTab('billing');
    } else if (tabFromUrl === 'account') {
      setActiveTab('account');
    } else if (tabFromUrl === 'banking' || tabFromUrl === 'tax') {
      // Legacy support - redirect to appropriate tabs
      setActiveTab(tabFromUrl === 'banking' ? 'integrations' : 'general');
    }

    // Legacy: clean up old onboarding redirect parameter if present
    if (onboardingRedirect === 'redirect') {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('onboarding');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [searchParams]);

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tinkConnections, setTinkConnections] = useState<TinkConnection[]>([]);
  const [tinkConnecting, setTinkConnecting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [shouldClearBeforeImport, setShouldClearBeforeImport] = useState<boolean>(false);
  const [importing, setImporting] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [onboardingModeDialogOpen, setOnboardingModeDialogOpen] = useState(false);
  const [onboardingBackups, setOnboardingBackups] = useState<Array<{
    id: number;
    reason: string | null;
    created_at: string;
  }>>([]);
  const [_hasCompleteData, setHasCompleteData] = useState(false);
  const [exportBackups, setExportBackups] = useState<ExportBackup[]>([]);
  const [deletingBackupId, setDeletingBackupId] = useState<number | null>(null);
  const [partnerStatus, setPartnerStatus] = useState<{
    is_partner: boolean;
    has_partner: boolean;
    partner_name?: string;
    partner_email?: string;
    linked_since?: string;
    household_id?: string;
    primary_name?: string;
  } | null>(null);
  const [partnerInviteEmail, setPartnerInviteEmail] = useState("");
  const [partnerInviting, setPartnerInviting] = useState(false);
  const [partnerInviteLink, setPartnerInviteLink] = useState<string | null>(null);

  const isPartner = session?.user?.isPartner ?? false;
  const userEmail = session?.user?.email ?? null;

  const fetchSettings = async () => {
    if (!userEmail) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `/api/backend/users/${encodeURIComponent(userEmail)}/settings`,
        {
          headers: { Accept: "application/json" },
        },
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data: UserSettings = await response.json();
      setSettings(data);
    } catch (err) {
      logger.error("[Settings] Failed to fetch settings", err);
      setError(intl.formatMessage({ id: "settings.messages.error" }));
    } finally {
      setLoading(false);
    }
  };

  const fetchPartnerStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/partner/status`);
      if (response.ok) {
        const data = await response.json();
        setPartnerStatus(data);
      }
    } catch (err) {
      logger.error("[Settings] Failed to fetch partner status", err);
    }
  };

  const handlePartnerInvite = async () => {
    setPartnerInviting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/partner/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: partnerInviteEmail || undefined }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to send invitation");
      }
      const data = await response.json();
      setPartnerInviteLink(data.invite_url);
      toast({
        title: intl.formatMessage({ id: "partner.settings.inviteSent" }),
        description: partnerInviteEmail
          ? intl.formatMessage({ id: "partner.settings.inviteSentDescription" }, { email: partnerInviteEmail })
          : undefined,
      });
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setPartnerInviting(false);
    }
  };

  const handlePartnerUnlink = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/partner/link`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to unlink partner");
      }
      setPartnerStatus(null);
      toast({ title: "Partner unlinked successfully" });
      fetchPartnerStatus();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    }
  };

  const fetchTinkConnections = async () => {
    try {
      const response = await fetch("/api/banking/tink/connections");
      if (response.ok) {
        const data: TinkConnection[] = await response.json();
        setTinkConnections(data);
      }
    } catch (err) {
      logger.error("[Settings] Failed to fetch Tink connections", err);
    }
  };

  const handleTinkConnect = async () => {
    setTinkConnecting(true);
    try {
      const response = await fetch("/api/banking/tink/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: settings?.language === "pl" ? "pl_PL" : "en_US" }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to initiate bank connection");
      }

      const data = await response.json();

      // Redirect to Tink Link
      window.location.href = data.tink_link_url;
    } catch (err: any) {
      logger.error("[Settings] Tink connect failed", err);
      toast({
        title: err.message || "Failed to connect bank",
        variant: "destructive",
      });
    } finally {
      setTinkConnecting(false);
    }
  };

  const handleTinkDisconnect = async (connectionId: number) => {
    if (!confirm(intl.formatMessage({ id: "settings.messages.confirmBankDelete" }))) {
      return;
    }

    try {
      const response = await fetch(`/api/banking/tink/connections/${connectionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast({
        title: intl.formatMessage({ id: "settings.messages.bankDeleteSuccess" }),
      });
      setTinkConnections((prev) => prev.filter((conn) => conn.id !== connectionId));
    } catch (err) {
      logger.error("[Settings] Failed to delete Tink connection", err);
      toast({
        title: intl.formatMessage({ id: "settings.messages.bankDeleteError" }),
        variant: "destructive",
      });
    }
  };

  const fetchOnboardingBackups = async () => {
    if (!userEmail) return;
    try {
      const response = await fetch(
        `${API_BASE_URL}/users/me/onboarding-backups`
      );
      if (response.ok) {
        const data = await response.json();
        setOnboardingBackups(data);
      }
    } catch (err) {
      logger.error("[Settings] Failed to fetch onboarding backups", err);
    }
  };

  const checkUserHasCompleteData = async () => {
    if (!userEmail) return;
    try {
      // Check all main data sections in parallel
      const [incomeRes, expensesRes, loansRes, savingsRes] = await Promise.all([
        fetch('/api/income'),
        fetch(`${API_BASE_URL}/users/${encodeURIComponent(userEmail)}/expenses`),
        fetch(`${API_BASE_URL}/loans`),
        fetch('/api/savings'),
      ]);

      const hasIncome = incomeRes.ok && (await incomeRes.json()).length > 0;
      const hasExpenses = expensesRes.ok && (await expensesRes.json()).length > 0;
      const hasLoans = loansRes.ok && (await loansRes.json()).length > 0;
      const hasSavings = savingsRes.ok && (await savingsRes.json()).length > 0;

      // User has complete data if they have entries in ALL sections
      setHasCompleteData(hasIncome && hasExpenses && hasLoans && hasSavings);
    } catch (err) {
      logger.error("[Settings] Failed to check user data completeness", err);
    }
  };

  const handleDownloadBackup = async (backupId: number) => {
    if (!userEmail) return;
    try {
      const response = await fetch(
        `${API_BASE_URL}/users/me/onboarding-backups/${backupId}`
      );
      if (!response.ok) throw new Error("Failed to fetch backup");

      const backupData = await response.json();
      const blob = new Blob([JSON.stringify(backupData.data, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `firedup_backup_${new Date(backupData.created_at).toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      logger.error("[Settings] Failed to download backup", err);
      toast({
        title: intl.formatMessage({ id: "settings.messages.exportError" }),
        variant: "destructive",
      });
    }
  };

  const handleDeleteBackup = async (backupId: number) => {
    if (!userEmail) return;
    if (!confirm(intl.formatMessage({ id: "settings.backups.confirmDelete" }))) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/users/me/onboarding-backups/${backupId}`,
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Failed to delete backup");

      toast({
        title: intl.formatMessage({ id: "settings.backups.deleteSuccess" }),
      });
      setOnboardingBackups((prev) => prev.filter((b) => b.id !== backupId));
    } catch (err) {
      logger.error("[Settings] Failed to delete backup", err);
      toast({
        title: intl.formatMessage({ id: "settings.backups.deleteError" }),
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    void fetchSettings();
    void fetchTinkConnections();
    void fetchOnboardingBackups();
    void checkUserHasCompleteData();
    void fetchPartnerStatus();
  }, [userEmail]);

  // Refetch Tink connections when integrations tab becomes active (e.g., after returning from callback)
  useEffect(() => {
    if (activeTab === 'integrations') {
      void fetchTinkConnections();
    }
  }, [activeTab]);

  // Fetch export backups from server
  const fetchExportBackups = useCallback(async () => {
    if (!userEmail) return;
    try {
      const response = await fetch(
        `${API_BASE_URL}/users/${encodeURIComponent(userEmail)}/export-backups`
      );
      if (response.ok) {
        const backups = await response.json() as ExportBackup[];
        setExportBackups(backups);
      }
    } catch (err) {
      logger.warn('[Settings] Failed to load export backups', err);
    }
  }, [userEmail]);

  useEffect(() => {
    void fetchExportBackups();
  }, [fetchExportBackups]);

  // Auto-save function for simple settings (language, currency)
  const autoSaveSettings = useCallback(async (updates: Partial<UserSettings>) => {
    if (!userEmail || !settings) return;

    try {
      await updateContextSettings({
        language: updates.language ?? settings.language,
        currency: updates.currency ?? settings.currency,
        ai: settings.ai,
        emergency_fund_target: settings.emergency_fund_target,
        emergency_fund_months: settings.emergency_fund_months,
        base_currency: updates.currency ?? settings.currency,
        employment_status: settings.employment_status ?? undefined,
        tax_form: settings.tax_form ?? undefined,
        birth_year: settings.birth_year ?? undefined,
        use_authors_costs: settings.use_authors_costs ?? undefined,
        ppk_enrolled: settings.ppk_enrolled ?? undefined,
        ppk_employee_rate: settings.ppk_employee_rate ?? undefined,
        ppk_employer_rate: settings.ppk_employer_rate ?? undefined,
        ppk_enrollment_date: settings.ppk_enrollment_date ?? undefined,
        employment_type: settings.employment_type ?? undefined,
        children_count: settings.children_count ?? undefined,
        // Partner profile
        include_partner_finances: settings.include_partner_finances ?? undefined,
        partner_name: settings.partner_name ?? undefined,
        partner_employment_status: settings.partner_employment_status ?? undefined,
        partner_tax_form: settings.partner_tax_form ?? undefined,
        partner_birth_year: settings.partner_birth_year ?? undefined,
        partner_use_authors_costs: settings.partner_use_authors_costs ?? undefined,
        partner_ppk_enrolled: settings.partner_ppk_enrolled ?? undefined,
        partner_ppk_employee_rate: settings.partner_ppk_employee_rate ?? undefined,
        partner_ppk_employer_rate: settings.partner_ppk_employer_rate ?? undefined,
      });
      toast({
        title: intl.formatMessage({ id: "settings.messages.success" }),
      });
    } catch (err) {
      logger.error("[Settings] Auto-save failed", err);
      toast({
        title: intl.formatMessage({ id: "settings.messages.error" }),
        variant: "destructive",
      });
    }
  }, [userEmail, settings, updateContextSettings, toast, intl]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!userEmail || !settings) {
      toast({
        title: intl.formatMessage({ id: "settings.messages.notLoggedIn" }),
        variant: "destructive",
      });
      return;
    }

    try {
      await updateContextSettings({
        language: settings.language,
        currency: settings.currency,
        emergency_fund_target: settings.emergency_fund_target,
        emergency_fund_months: settings.emergency_fund_months,
        base_currency: settings.currency,
        // Polish tax profile (convert null to undefined for type compatibility)
        employment_status: settings.employment_status ?? undefined,
        tax_form: settings.tax_form ?? undefined,
        birth_year: settings.birth_year ?? undefined,
        use_authors_costs: settings.use_authors_costs ?? undefined,
        ppk_enrolled: settings.ppk_enrolled ?? undefined,
        ppk_employee_rate: settings.ppk_employee_rate ?? undefined,
        ppk_employer_rate: settings.ppk_employer_rate ?? undefined,
        ppk_enrollment_date: settings.ppk_enrollment_date ?? undefined,
        employment_type: settings.employment_type ?? undefined,
        children_count: settings.children_count ?? undefined,
        // Partner profile
        include_partner_finances: settings.include_partner_finances ?? undefined,
        partner_name: settings.partner_name ?? undefined,
        partner_employment_status: settings.partner_employment_status ?? undefined,
        partner_tax_form: settings.partner_tax_form ?? undefined,
        partner_birth_year: settings.partner_birth_year ?? undefined,
        partner_use_authors_costs: settings.partner_use_authors_costs ?? undefined,
        partner_ppk_enrolled: settings.partner_ppk_enrolled ?? undefined,
        partner_ppk_employee_rate: settings.partner_ppk_employee_rate ?? undefined,
        partner_ppk_employer_rate: settings.partner_ppk_employer_rate ?? undefined,
      });

      toast({
        title: intl.formatMessage({ id: "settings.messages.success" }),
      });
    } catch (err) {
      logger.error("[Settings] Failed to update settings", err);
      toast({
        title: intl.formatMessage({ id: "settings.messages.error" }),
        variant: "destructive",
      });
    }
  };

  const handleExport = async (format: "json" | "csv" | "xlsx", saveBackup: boolean = false) => {
    if (!userEmail) {
      toast({
        title: intl.formatMessage({ id: "settings.messages.notLoggedIn" }),
        variant: "destructive",
      });
      return;
    }

    try {
      // For JSON exports, also save a backup on the server
      const saveParam = format === "json" && saveBackup ? "&save_backup=true" : "";
      const response = await fetch(
        `/api/backend/users/${encodeURIComponent(userEmail)}/export?format=${format}${saveParam}`,
      );

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const filename = `home_budget_export_${userEmail}.${format}`;
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      // Refresh backups list if we saved a backup
      if (format === "json" && saveBackup) {
        void fetchExportBackups();
      }

      toast({
        title: intl.formatMessage({ id: "settings.messages.exportSuccess" }),
      });
    } catch (err) {
      logger.error("[Settings] Export failed", err);
      toast({
        title: intl.formatMessage({ id: "settings.messages.exportError" }),
        variant: "destructive",
      });
    }
  };

  const handleDownloadExportBackup = async (backupId: number, filename: string) => {
    if (!userEmail) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/users/${encodeURIComponent(userEmail)}/export-backups/${backupId}`
      );

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      logger.error("[Settings] Download backup failed", err);
      toast({
        title: intl.formatMessage({ id: "settings.messages.downloadError" }),
        variant: "destructive",
      });
    }
  };

  const handleDeleteExportBackup = async (backupId: number) => {
    if (!userEmail) return;

    setDeletingBackupId(backupId);
    try {
      const response = await fetch(
        `${API_BASE_URL}/users/${encodeURIComponent(userEmail)}/export-backups/${backupId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      // Refresh backups list
      void fetchExportBackups();
      toast({
        title: intl.formatMessage({ id: "settings.backups.deleteSuccess" }),
      });
    } catch (err) {
      logger.error("[Settings] Delete backup failed", err);
      toast({
        title: intl.formatMessage({ id: "settings.backups.deleteError" }),
        variant: "destructive",
      });
    } finally {
      setDeletingBackupId(null);
    }
  };

  const handleImport = async (confirmed = false) => {
    if (!importFile) {
      return;
    }

    // If clearing existing data, require confirmation first
    if (shouldClearBeforeImport && !confirmed) {
      setShowImportConfirm(true);
      return;
    }

    setShowImportConfirm(false);

    try {
      setImporting(true);

      const fileContent = await importFile.text();
      const payload = JSON.parse(fileContent);

      const response = await fetch('/api/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: payload,
          clearExisting: shouldClearBeforeImport,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || response.statusText);
      }
      setImportFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setShouldClearBeforeImport(false);
      // Refresh settings without triggering loading state (which unmounts UI and kills toast)
      try {
        const settingsRes = await fetch(
          `/api/backend/users/${encodeURIComponent(userEmail!)}/settings`,
          { headers: { Accept: "application/json" } },
        );
        if (settingsRes.ok) {
          setSettings(await settingsRes.json());
        }
      } catch { /* ignore, toast is more important */ }
      toast({
        title: intl.formatMessage({ id: 'settings.messages.importSuccess' }),
      });
    } catch (err) {
      logger.error("[Settings] Import failed", err);
      toast({
        title: intl.formatMessage({ id: 'settings.messages.importError' }),
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };
  if (loading) {
    return <div className="py-8 text-sm text-muted-foreground">{intl.formatMessage({ id: "settings.messages.loading" })}</div>;
  }

  if (error) {
    return (
      <div className="rounded border border-destructive/40 bg-destructive/10 px-4 py-2 text-destructive">
        {error}
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="py-8 text-sm text-muted-foreground">
        {intl.formatMessage({ id: "settings.messages.notLoggedIn" })}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{intl.formatMessage({ id: "settings.title" })}</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="general" className="gap-2">
            <FontAwesomeIcon icon={faGlobe} className="w-4 h-4" />
            <span className="hidden sm:inline">{intl.formatMessage({ id: "settings.tabs.general" })}</span>
          </TabsTrigger>
          <TabsTrigger value="finance" className="gap-2">
            <FontAwesomeIcon icon={faPiggyBank} className="w-4 h-4" />
            <span className="hidden sm:inline">{intl.formatMessage({ id: "settings.tabs.finance" })}</span>
          </TabsTrigger>
          {!isPartner && (
            <TabsTrigger value="integrations" className="gap-2">
              <FontAwesomeIcon icon={faBuilding} className="w-4 h-4" />
              <span className="hidden sm:inline">{intl.formatMessage({ id: "settings.tabs.integrations" })}</span>
            </TabsTrigger>
          )}
          {!isPartner && (
            <TabsTrigger value="data" className="gap-2">
              <FontAwesomeIcon icon={faDatabase} className="w-4 h-4" />
              <span className="hidden sm:inline">{intl.formatMessage({ id: "settings.tabs.data" })}</span>
            </TabsTrigger>
          )}
          {!isPartner && (
            <TabsTrigger value="billing" className="gap-2">
              <FontAwesomeIcon icon={faCrown} className="w-4 h-4" />
              <span className="hidden sm:inline">{intl.formatMessage({ id: "billing.title" })}</span>
            </TabsTrigger>
          )}
          {!isPartner && (
            <TabsTrigger value="account" className="gap-2">
              <FontAwesomeIcon icon={faUser} className="w-4 h-4" />
              <span className="hidden sm:inline">{intl.formatMessage({ id: "settings.tabs.account" })}</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* General Settings Tab */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FontAwesomeIcon icon={faGlobe} className="w-5 h-5 text-primary" />
                {intl.formatMessage({ id: "settings.tabs.general" })}
              </CardTitle>
              <CardDescription>
                {intl.formatMessage({ id: "settings.tabs.generalDescription" })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-6" onSubmit={handleSubmit}>
                {/* Language & Currency - auto-save */}
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="language">
                      {intl.formatMessage({ id: "settings.form.language" })}
                    </Label>
                    <Select
                      value={settings.language}
                      onValueChange={(value) => {
                        setSettings((prev) => prev && { ...prev, language: value });
                        void autoSaveSettings({ language: value });
                      }}
                    >
                      <SelectTrigger id="language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {languages.map((lang) => (
                          <SelectItem key={lang.code} value={lang.code}>
                            {intl.formatMessage({ id: lang.name })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {intl.formatMessage({ id: "settings.tooltips.language" })}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currency">
                      {intl.formatMessage({ id: "settings.form.currency" })}
                    </Label>
                    <Select
                      value={settings.currency}
                      onValueChange={(value) => {
                        setSettings((prev) => prev && { ...prev, currency: value });
                        void autoSaveSettings({ currency: value });
                      }}
                    >
                      <SelectTrigger id="currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            {`${currency.code} (${currency.symbol}) - ${intl.formatMessage({ id: currency.name })}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {intl.formatMessage({ id: "settings.tooltips.currency" })}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Tax Profile Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faReceipt} className="w-4 h-4 text-muted-foreground" />
                    <h4 className="font-medium">{intl.formatMessage({ id: "settings.taxProfile.title" })}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {intl.formatMessage({ id: "settings.taxProfile.description" })}
                  </p>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="birth_year">
                        {intl.formatMessage({ id: "settings.taxProfile.birthYear" })}
                      </Label>
                      <Input
                        id="birth_year"
                        type="number"
                        min={1940}
                        max={new Date().getFullYear()}
                        value={settings.birth_year ?? ""}
                        onChange={(event) =>
                          setSettings((prev) =>
                            prev && {
                              ...prev,
                              birth_year: event.target.value ? Number(event.target.value) : null,
                            },
                          )
                        }
                        placeholder="np. 1990"
                      />
                      <p className="text-xs text-muted-foreground">
                        {intl.formatMessage({ id: "settings.taxProfile.birthYearHint" })}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="children_count">
                        {intl.formatMessage({ id: "settings.taxProfile.childrenCount" })}
                      </Label>
                      <Input
                        id="children_count"
                        type="number"
                        min={0}
                        max={20}
                        value={settings.children_count ?? 0}
                        onChange={(event) =>
                          setSettings((prev) =>
                            prev && {
                              ...prev,
                              children_count: Number(event.target.value),
                            },
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="employment_status">
                        {intl.formatMessage({ id: "settings.taxProfile.employmentStatus" })}
                      </Label>
                      <Select
                        value={settings.employment_status ?? ""}
                        onValueChange={(value) =>
                          setSettings((prev) => prev && { ...prev, employment_status: value || null })
                        }
                      >
                        <SelectTrigger id="employment_status">
                          <SelectValue placeholder={intl.formatMessage({ id: "settings.taxProfile.selectEmployment" })} />
                        </SelectTrigger>
                        <SelectContent>
                          {employmentStatuses.map((status) => (
                            <SelectItem key={status.code} value={status.code}>
                              {intl.formatMessage({ id: status.name })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tax_form">
                        {intl.formatMessage({ id: "settings.taxProfile.taxForm" })}
                      </Label>
                      <Select
                        value={settings.tax_form ?? ""}
                        onValueChange={(value) =>
                          setSettings((prev) => prev && { ...prev, tax_form: value || null })
                        }
                      >
                        <SelectTrigger id="tax_form">
                          <SelectValue placeholder={intl.formatMessage({ id: "settings.taxProfile.selectTaxForm" })} />
                        </SelectTrigger>
                        <SelectContent>
                          {taxForms.map((form) => (
                            <SelectItem key={form.code} value={form.code}>
                              {intl.formatMessage({ id: form.name })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* PPK Section */}
                  <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                    <h4 className="font-medium">
                      {intl.formatMessage({ id: "settings.taxProfile.ppkSection" })}
                    </h4>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="ppk_enrolled">
                          {intl.formatMessage({ id: "settings.taxProfile.ppkEnrolled" })}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {intl.formatMessage({ id: "settings.taxProfile.ppkEnrolledHint" })}
                        </p>
                      </div>
                      <Select
                        value={settings.ppk_enrolled === true ? "yes" : settings.ppk_enrolled === false ? "no" : "unknown"}
                        onValueChange={(value) =>
                          setSettings((prev) => prev && {
                            ...prev,
                            ppk_enrolled: value === "yes" ? true : value === "no" ? false : null
                          })
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unknown">{intl.formatMessage({ id: "settings.taxProfile.ppkUnknown" })}</SelectItem>
                          <SelectItem value="yes">{intl.formatMessage({ id: "settings.taxProfile.ppkYes" })}</SelectItem>
                          <SelectItem value="no">{intl.formatMessage({ id: "settings.taxProfile.ppkNo" })}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {settings.ppk_enrolled === true && (
                      <div className="grid gap-4 md:grid-cols-2 pt-2">
                        <div className="space-y-2">
                          <Label htmlFor="ppk_employee_rate">
                            {intl.formatMessage({ id: "settings.taxProfile.ppkEmployeeRate" })}
                          </Label>
                          <Input
                            id="ppk_employee_rate"
                            type="number"
                            min={0.5}
                            max={4}
                            step={0.5}
                            value={settings.ppk_employee_rate ?? 2}
                            onChange={(event) =>
                              setSettings((prev) =>
                                prev && { ...prev, ppk_employee_rate: Number(event.target.value) }
                              )
                            }
                          />
                          <p className="text-xs text-muted-foreground">0.5% - 4%</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ppk_employer_rate">
                            {intl.formatMessage({ id: "settings.taxProfile.ppkEmployerRate" })}
                          </Label>
                          <Input
                            id="ppk_employer_rate"
                            type="number"
                            min={1.5}
                            max={4}
                            step={0.5}
                            value={settings.ppk_employer_rate ?? 1.5}
                            onChange={(event) =>
                              setSettings((prev) =>
                                prev && { ...prev, ppk_employer_rate: Number(event.target.value) }
                              )
                            }
                          />
                          <p className="text-xs text-muted-foreground">1.5% - 4%</p>
                        </div>
                      </div>
                    )}

                    {/* Employment Type */}
                    {settings.ppk_enrolled === true && (
                      <div className="space-y-2 pt-2">
                        <Label htmlFor="employment_type">
                          {intl.formatMessage({ id: "settings.taxProfile.employmentType" })}
                        </Label>
                        <Select
                          value={settings.employment_type ?? ""}
                          onValueChange={(value) =>
                            setSettings((prev) => prev && { ...prev, employment_type: value || null })
                          }
                        >
                          <SelectTrigger id="employment_type">
                            <SelectValue placeholder={intl.formatMessage({ id: "settings.taxProfile.selectEmploymentType" })} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="uop">{intl.formatMessage({ id: "settings.taxProfile.employmentTypes.uop" })}</SelectItem>
                            <SelectItem value="b2b">{intl.formatMessage({ id: "settings.taxProfile.employmentTypes.b2b" })}</SelectItem>
                            <SelectItem value="jdg">{intl.formatMessage({ id: "settings.taxProfile.employmentTypes.jdg" })}</SelectItem>
                            <SelectItem value="other">{intl.formatMessage({ id: "settings.taxProfile.employmentTypes.other" })}</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {intl.formatMessage({ id: "settings.taxProfile.employmentTypeHint" })}
                        </p>
                      </div>
                    )}

                    {/* PPK Enrollment Date */}
                    {settings.ppk_enrolled === true && (
                      <div className="space-y-2">
                        <Label htmlFor="ppk_enrollment_date">
                          {intl.formatMessage({ id: "settings.taxProfile.ppkEnrollmentDate" })}
                        </Label>
                        <Input
                          id="ppk_enrollment_date"
                          type="date"
                          value={settings.ppk_enrollment_date ?? ""}
                          onChange={(event) =>
                            setSettings((prev) =>
                              prev && { ...prev, ppk_enrollment_date: event.target.value || null }
                            )
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          {intl.formatMessage({ id: "settings.taxProfile.ppkEnrollmentDateHint" })}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Author's Costs Section */}
                  <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
                    <div className="space-y-0.5">
                      <Label htmlFor="use_authors_costs">
                        {intl.formatMessage({ id: "settings.taxProfile.authorsCosts" })}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {intl.formatMessage({ id: "settings.taxProfile.authorsCostsHint" })}
                      </p>
                    </div>
                    <Switch
                      id="use_authors_costs"
                      checked={settings.use_authors_costs ?? false}
                      onCheckedChange={(checked) =>
                        setSettings((prev) =>
                          prev && { ...prev, use_authors_costs: checked }
                        )
                      }
                    />
                  </div>

                  {/* Partner Budgeting Toggle */}
                  <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
                    <div className="space-y-0.5">
                      <Label htmlFor="include_partner_finances">
                        {intl.formatMessage({ id: "settings.taxProfile.includePartner" })}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {intl.formatMessage({ id: "settings.taxProfile.includePartnerHint" })}
                      </p>
                    </div>
                    <Switch
                      id="include_partner_finances"
                      checked={settings.include_partner_finances ?? false}
                      onCheckedChange={(checked) =>
                        setSettings((prev) =>
                          prev && { ...prev, include_partner_finances: checked }
                        )
                      }
                    />
                  </div>

                  {/* Partner Tax Profile Section */}
                  {settings.include_partner_finances && (
                    <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                      <h4 className="font-medium">
                        {intl.formatMessage({ id: "settings.taxProfile.partnerSection" })}
                      </h4>

                      <div className="space-y-2">
                        <Label htmlFor="partner_name">
                          {intl.formatMessage({ id: "settings.taxProfile.partnerName" })}
                        </Label>
                        <Input
                          id="partner_name"
                          value={settings.partner_name ?? ""}
                          onChange={(event) =>
                            setSettings((prev) =>
                              prev && { ...prev, partner_name: event.target.value || null }
                            )
                          }
                          placeholder="np. Julita"
                        />
                        <p className="text-xs text-muted-foreground">
                          {intl.formatMessage({ id: "settings.taxProfile.partnerNameHint" })}
                        </p>
                      </div>

                      <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="partner_employment_status">
                            {intl.formatMessage({ id: "settings.taxProfile.incomeSource" })}
                          </Label>
                          <Select
                            value={settings.partner_employment_status ?? ""}
                            onValueChange={(value) => {
                              const taxForm = defaultTaxFormForStatus[value] ?? "";
                              setSettings((prev) => prev && {
                                ...prev,
                                partner_employment_status: value || null,
                                partner_tax_form: taxForm || null,
                                // Reset PPK if not UoP
                                ...(!hasPpk(value) ? { partner_ppk_enrolled: null, partner_ppk_employee_rate: null, partner_ppk_employer_rate: null } : {}),
                                // Reset author's costs if not applicable
                                ...(!hasAuthorsCosts(value) ? { partner_use_authors_costs: false } : {}),
                              });
                            }}
                          >
                            <SelectTrigger id="partner_employment_status">
                              <SelectValue placeholder={intl.formatMessage({ id: "settings.taxProfile.selectIncomeSource" })} />
                            </SelectTrigger>
                            <SelectContent>
                              {employmentStatuses.filter(s => s.code !== "unemployed").map((status) => (
                                <SelectItem key={status.code} value={status.code}>
                                  {intl.formatMessage({ id: status.name })}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="partner_tax_form">
                            {intl.formatMessage({ id: "settings.taxProfile.taxForm" })}
                          </Label>
                          <Select
                            value={settings.partner_tax_form ?? ""}
                            onValueChange={(value) =>
                              setSettings((prev) => prev && { ...prev, partner_tax_form: value || null })
                            }
                          >
                            <SelectTrigger id="partner_tax_form">
                              <SelectValue placeholder={intl.formatMessage({ id: "settings.taxProfile.selectTaxForm" })} />
                            </SelectTrigger>
                            <SelectContent>
                              {taxForms.map((form) => (
                                <SelectItem key={form.code} value={form.code}>
                                  {intl.formatMessage({ id: form.name })}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="partner_birth_year">
                          {intl.formatMessage({ id: "settings.taxProfile.birthYear" })}
                        </Label>
                        <Input
                          id="partner_birth_year"
                          type="number"
                          min={1940}
                          max={new Date().getFullYear()}
                          value={settings.partner_birth_year ?? ""}
                          onChange={(event) =>
                            setSettings((prev) =>
                              prev && {
                                ...prev,
                                partner_birth_year: event.target.value ? Number(event.target.value) : null,
                              }
                            )
                          }
                          placeholder="np. 1992"
                        />
                      </div>

                      {/* Partner Author's Costs — only for UoP/zlecenie/dzieło */}
                      {hasAuthorsCosts(settings.partner_employment_status) && (
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="partner_use_authors_costs">
                              {intl.formatMessage({ id: "settings.taxProfile.authorsCosts" })}
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              {intl.formatMessage({ id: "settings.taxProfile.authorsCostsHint" })}
                            </p>
                          </div>
                          <Switch
                            id="partner_use_authors_costs"
                            checked={settings.partner_use_authors_costs ?? false}
                            onCheckedChange={(checked) =>
                              setSettings((prev) =>
                                prev && { ...prev, partner_use_authors_costs: checked }
                              )
                            }
                          />
                        </div>
                      )}

                      {/* Partner PPK — only for UoP employees */}
                      {hasPpk(settings.partner_employment_status) && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label htmlFor="partner_ppk_enrolled">
                                {intl.formatMessage({ id: "settings.taxProfile.ppkEnrolled" })}
                              </Label>
                            </div>
                            <Select
                              value={settings.partner_ppk_enrolled === true ? "yes" : settings.partner_ppk_enrolled === false ? "no" : "unknown"}
                              onValueChange={(value) =>
                                setSettings((prev) => prev && {
                                  ...prev,
                                  partner_ppk_enrolled: value === "yes" ? true : value === "no" ? false : null
                                })
                              }
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unknown">{intl.formatMessage({ id: "settings.taxProfile.ppkUnknown" })}</SelectItem>
                                <SelectItem value="yes">{intl.formatMessage({ id: "settings.taxProfile.ppkYes" })}</SelectItem>
                                <SelectItem value="no">{intl.formatMessage({ id: "settings.taxProfile.ppkNo" })}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {settings.partner_ppk_enrolled === true && (
                            <div className="grid gap-4 md:grid-cols-2 pt-2">
                              <div className="space-y-2">
                                <Label htmlFor="partner_ppk_employee_rate">
                                  {intl.formatMessage({ id: "settings.taxProfile.ppkEmployeeRate" })}
                                </Label>
                                <Input
                                  id="partner_ppk_employee_rate"
                                  type="number"
                                  min={0.5}
                                  max={4}
                                  step={0.5}
                                  value={settings.partner_ppk_employee_rate ?? 2}
                                  onChange={(event) =>
                                    setSettings((prev) =>
                                      prev && { ...prev, partner_ppk_employee_rate: Number(event.target.value) }
                                    )
                                  }
                                />
                                <p className="text-xs text-muted-foreground">0.5% - 4%</p>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="partner_ppk_employer_rate">
                                  {intl.formatMessage({ id: "settings.taxProfile.ppkEmployerRate" })}
                                </Label>
                                <Input
                                  id="partner_ppk_employer_rate"
                                  type="number"
                                  min={1.5}
                                  max={4}
                                  step={0.5}
                                  value={settings.partner_ppk_employer_rate ?? 1.5}
                                  onChange={(event) =>
                                    setSettings((prev) =>
                                      prev && { ...prev, partner_ppk_employer_rate: Number(event.target.value) }
                                    )
                                  }
                                />
                                <p className="text-xs text-muted-foreground">1.5% - 4%</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Button type="submit">
                  {intl.formatMessage({ id: "settings.form.submit" })}
                </Button>
              </form>

              {/* Re-run Setup Wizard - for existing users to update/reset their data */}
              <Separator className="my-6" />

              <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <FontAwesomeIcon icon={faArrowsRotate} className="w-4 h-4 text-muted-foreground" />
                      <h4 className="font-medium">{intl.formatMessage({ id: "settings.onboarding.title" })}</h4>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {intl.formatMessage({ id: "settings.onboarding.description" })}
                    </p>

                    <AlertDialog open={onboardingModeDialogOpen} onOpenChange={setOnboardingModeDialogOpen}>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline">
                          <FontAwesomeIcon icon={faArrowsRotate} className="w-4 h-4 mr-2" />
                          {intl.formatMessage({ id: "settings.onboarding.runButton" })}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {intl.formatMessage({ id: "settings.onboarding.modeDialog.title" })}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {intl.formatMessage({ id: "settings.onboarding.modeDialog.description" })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="space-y-4 py-4">
                          <div
                            className="flex items-start gap-4 p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => {
                              setOnboardingModeDialogOpen(false);
                              router.push('/onboarding?force=true&mode=merge');
                            }}
                          >
                            <FontAwesomeIcon icon={faCodeMerge} className="w-5 h-5 mt-0.5 text-primary" />
                            <div className="flex-1">
                              <p className="font-medium">{intl.formatMessage({ id: "settings.onboarding.modeDialog.mergeMode" })}</p>
                              <p className="text-sm text-muted-foreground">
                                {intl.formatMessage({ id: "settings.onboarding.modeDialog.mergeModeDescription" })}
                              </p>
                            </div>
                          </div>
                          <div
                            className="flex items-start gap-4 p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => {
                              setOnboardingModeDialogOpen(false);
                              router.push('/onboarding?force=true&mode=fresh');
                            }}
                          >
                            <FontAwesomeIcon icon={faTrashCanArrowUp} className="w-5 h-5 mt-0.5 text-orange-500" />
                            <div className="flex-1">
                              <p className="font-medium">{intl.formatMessage({ id: "settings.onboarding.modeDialog.freshStartMode" })}</p>
                              <p className="text-sm text-muted-foreground">
                                {intl.formatMessage({ id: "settings.onboarding.modeDialog.freshStartModeDescription" })}
                              </p>
                            </div>
                          </div>
                        </div>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            {intl.formatMessage({ id: "settings.onboarding.modeDialog.cancel" })}
                          </AlertDialogCancel>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
            </CardContent>
          </Card>

          {/* Partner Section */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FontAwesomeIcon icon={faUser} className="w-5 h-5 text-violet-500" />
                {intl.formatMessage({ id: "partner.settings.title" })}
              </CardTitle>
              <CardDescription>
                {isPartner
                  ? intl.formatMessage({ id: "partner.settings.asPartnerDescription" }, {
                      name: partnerStatus?.primary_name || "—"
                    })
                  : intl.formatMessage({ id: "partner.settings.inviteDescription" })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isPartner ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-violet-50 border border-violet-200">
                  <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                    <FontAwesomeIcon icon={faUser} className="w-4 h-4 text-violet-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {intl.formatMessage({ id: "partner.settings.asPartner" })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {intl.formatMessage({ id: "partner.settings.asPartnerDescription" }, {
                        name: partnerStatus?.primary_name || "—"
                      })}
                    </p>
                  </div>
                </div>
              ) : partnerStatus?.has_partner ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                      <FontAwesomeIcon icon={faUser} className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {intl.formatMessage({ id: "partner.settings.linked" }, {
                          name: partnerStatus.partner_name || partnerStatus.partner_email || "—"
                        })}
                      </p>
                      {partnerStatus.partner_email && (
                        <p className="text-xs text-muted-foreground">
                          {partnerStatus.partner_email}
                        </p>
                      )}
                      {partnerStatus.linked_since && (
                        <p className="text-xs text-muted-foreground">
                          {intl.formatMessage({ id: "partner.settings.linkedSince" }, {
                            date: new Date(partnerStatus.linked_since).toLocaleDateString()
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive">
                        {intl.formatMessage({ id: "partner.settings.removeLink" })}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {intl.formatMessage({ id: "partner.settings.removeLink" })}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {intl.formatMessage({ id: "partner.settings.removeLinkConfirm" })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>
                          {intl.formatMessage({ id: "settings.account.deleteDialog.cancel" })}
                        </AlertDialogCancel>
                        <Button variant="destructive" onClick={handlePartnerUnlink}>
                          {intl.formatMessage({ id: "partner.settings.removeLink" })}
                        </Button>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder={intl.formatMessage({ id: "partner.settings.emailPlaceholder" })}
                      value={partnerInviteEmail}
                      onChange={(e) => setPartnerInviteEmail(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={handlePartnerInvite}
                      disabled={partnerInviting}
                    >
                      {partnerInviting ? "..." : intl.formatMessage({ id: "partner.settings.sendInvite" })}
                    </Button>
                  </div>
                  {partnerInviteLink && (
                    <div className="p-3 rounded-lg bg-muted text-sm">
                      <p className="font-medium mb-1">
                        {intl.formatMessage({ id: "partner.settings.inviteSent" })}
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs flex-1 truncate">{partnerInviteLink}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(partnerInviteLink);
                            toast({ title: intl.formatMessage({ id: "partner.settings.inviteCopied" }) });
                          }}
                        >
                          Copy
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Finance Settings Tab */}
        <TabsContent value="finance">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faPiggyBank} className="w-5 h-5 text-primary" />
                  {intl.formatMessage({ id: "settings.financialFreedom.title" })}
                </CardTitle>
                <CardDescription>
                  {intl.formatMessage({ id: "settings.tabs.financeDescription" })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-6" onSubmit={handleSubmit}>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="emergency_fund_target">
                        {intl.formatMessage({ id: "settings.financialFreedom.emergencyFundTarget" })}
                      </Label>
                      <CurrencyInput
                        id="emergency_fund_target"
                        value={settings.emergency_fund_target}
                        onValueChange={(val) =>
                          setSettings((prev) =>
                            prev && {
                              ...prev,
                              emergency_fund_target: val,
                            },
                          )
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        {intl.formatMessage({ id: "settings.tooltips.emergencyFundTarget" })}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emergency_fund_months">
                        {intl.formatMessage({ id: "settings.financialFreedom.emergencyFundMonths" })}
                      </Label>
                      <Input
                        id="emergency_fund_months"
                        type="number"
                        min={1}
                        max={12}
                        value={settings.emergency_fund_months}
                        onChange={(event) =>
                          setSettings((prev) =>
                            prev && {
                              ...prev,
                              emergency_fund_months: Number(event.target.value),
                            },
                          )
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        {intl.formatMessage({ id: "settings.tooltips.emergencyFundMonths" })}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <Button type="submit">
                    {intl.formatMessage({ id: "settings.form.submit" })}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Integrations Tab (Banking) */}
        <TabsContent value="integrations">
          <div className="space-y-6">
            {/* Tink Connections - Primary bank integration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faBuilding} className="w-5 h-5 text-primary" />
                  {intl.formatMessage({ id: "settings.tabs.integrations" })}
                </CardTitle>
                <CardDescription>
                  {intl.formatMessage({ id: "settings.tabs.integrationsDescription" })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Connect your bank account to automatically import transactions. Supports most Polish banks including ING, PKO BP, and mBank.
                </p>

                {tinkConnections.length === 0 ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      No bank accounts connected yet.
                    </p>
                    <Button
                      onClick={() => void handleTinkConnect()}
                      disabled={tinkConnecting}
                    >
                      {tinkConnecting ? "Connecting..." : "Connect Bank Account"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tinkConnections.map((connection) => (
                      <div
                        key={connection.id}
                        className="flex flex-col gap-2 rounded-lg border p-4"
                      >
                        {(() => {
                          const isExpired = connection.token_expires_at
                            ? new Date(connection.token_expires_at) < new Date()
                            : false;

                          return (
                            <>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className={`h-2 w-2 rounded-full ${isExpired ? 'bg-amber-500' : 'bg-green-500'}`} />
                                  <span className="font-medium">
                                    {isExpired ? 'Expired - Needs Reconnection' : 'Connected'}
                                  </span>
                                </div>
                                {isExpired ? (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => void handleTinkConnect()}
                                    disabled={tinkConnecting}
                                  >
                                    {tinkConnecting ? 'Connecting...' : 'Reconnect'}
                                  </Button>
                                ) : (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => void handleTinkDisconnect(connection.id)}
                                  >
                                    Disconnect
                                  </Button>
                                )}
                              </div>
                              {isExpired && connection.token_expires_at && (
                                <p className="text-xs text-amber-600">
                                  Token expired: {new Date(connection.token_expires_at).toLocaleString()}
                                </p>
                              )}
                            </>
                          );
                        })()}
                        {connection.accounts.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Connected accounts:
                            </p>
                            <ul className="text-sm space-y-1">
                              {connection.accounts.map((account) => (
                                <li key={account.id} className="flex items-center gap-2">
                                  <span>{account.name || "Account"}</span>
                                  {account.iban && (
                                    <span className="text-muted-foreground">
                                      (...{account.iban.slice(-4)})
                                    </span>
                                  )}
                                  {account.currency && (
                                    <span className="text-xs text-muted-foreground">
                                      {account.currency}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {connection.last_sync_at && (
                          <p className="text-xs text-muted-foreground">
                            Last synced: {new Date(connection.last_sync_at).toLocaleString()}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Connected: {new Date(connection.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        onClick={() => void handleTinkConnect()}
                        disabled={tinkConnecting}
                      >
                        {tinkConnecting ? "Connecting..." : "Connect Another Account"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => router.push('/banking/tink/test')}
                      >
                        View API Data
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Data Tab (Import/Export) */}
        <TabsContent value="data">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FontAwesomeIcon icon={faDatabase} className="w-5 h-5 text-primary" />
                {intl.formatMessage({ id: "settings.tabs.data" })}
              </CardTitle>
              <CardDescription>
                {intl.formatMessage({ id: "settings.tabs.dataDescription" })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Export Section */}
              <div className="space-y-4">
                <h4 className="font-medium">{intl.formatMessage({ id: "settings.export.title" })}</h4>

                {/* Primary Export - JSON with backup */}
                <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-primary/10 p-2">
                      <FontAwesomeIcon icon={faDatabase} className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h5 className="font-medium text-primary">
                        {intl.formatMessage({ id: "settings.export.jsonPrimary.title" })}
                      </h5>
                      <p className="text-sm text-muted-foreground mt-1">
                        {intl.formatMessage({ id: "settings.export.jsonPrimary.description" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pl-11">
                    <Button onClick={() => void handleExport("json", true)}>
                      {intl.formatMessage({ id: "settings.export.jsonPrimary.exportWithBackup" })}
                    </Button>
                    <Button variant="outline" onClick={() => void handleExport("json", false)}>
                      {intl.formatMessage({ id: "settings.export.jsonPrimary.exportOnly" })}
                    </Button>
                  </div>
                </div>

                {/* Secondary Exports - CSV/XLSX */}
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div>
                    <h5 className="font-medium text-secondary">
                      {intl.formatMessage({ id: "settings.export.secondary.title" })}
                    </h5>
                    <p className="text-sm text-muted-foreground mt-1">
                      {intl.formatMessage({ id: "settings.export.secondary.description" })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => void handleExport("csv")}>
                      {intl.formatMessage({ id: "settings.export.csv" })}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void handleExport("xlsx")}>
                      {intl.formatMessage({ id: "settings.export.xlsx" })}
                    </Button>
                  </div>
                </div>

                {/* Server Backups */}
                {exportBackups.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <h5 className="text-sm font-medium">
                      {intl.formatMessage({ id: "settings.export.backups.title" })}
                    </h5>
                    <p className="text-xs text-muted-foreground">
                      {intl.formatMessage({ id: "settings.export.backups.description" })}
                    </p>
                    <div className="space-y-2">
                      {exportBackups.map((backup) => (
                        <div
                          key={backup.id}
                          className="flex items-center justify-between text-sm py-2 px-3 rounded-lg border bg-background"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="font-medium block truncate">{backup.filename}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(backup.created_at).toLocaleString(settings?.language === 'pl' ? 'pl-PL' : 'en-US', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              {backup.size_bytes && (
                                <> · {(backup.size_bytes / 1024).toFixed(1)} KB</>
                              )}
                            </span>
                          </div>
                          <div className="flex gap-1 ml-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void handleDownloadExportBackup(backup.id, backup.filename)}
                            >
                              {intl.formatMessage({ id: "settings.backups.download" })}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => void handleDeleteExportBackup(backup.id)}
                              disabled={deletingBackupId === backup.id}
                            >
                              {deletingBackupId === backup.id
                                ? "..."
                                : intl.formatMessage({ id: "settings.backups.delete" })}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Import Section */}
              <div className="space-y-4">
                <h4 className="font-medium">{intl.formatMessage({ id: "settings.import.title" })}</h4>
                <p className="text-sm text-muted-foreground">
                  {intl.formatMessage({ id: "settings.import.description" })}
                </p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="import_file">
                      {intl.formatMessage({ id: "settings.import.title" })}
                    </Label>
                    <Input
                      id="import_file"
                      ref={fileInputRef}
                      type="file"
                      accept="application/json"
                      onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="import_clear_existing"
                      checked={shouldClearBeforeImport}
                      onCheckedChange={setShouldClearBeforeImport}
                    />
                    <Label
                      htmlFor="import_clear_existing"
                      className="text-sm font-normal cursor-pointer"
                    >
                      {intl.formatMessage({ id: "settings.import.clearExistingLabel" })}
                    </Label>
                  </div>
                  {showImportConfirm ? (
                    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-destructive">
                        <FontAwesomeIcon icon={faTriangleExclamation} className="h-4 w-4" />
                        <p className="font-medium text-sm">
                          {intl.formatMessage({ id: "settings.import.confirmClearPrimary" })}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {intl.formatMessage({ id: "settings.import.confirmClearSecondary" })}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          disabled={importing}
                          onClick={() => void handleImport(true)}
                        >
                          {importing
                            ? intl.formatMessage({ id: "settings.messages.loading" })
                            : intl.formatMessage({ id: "settings.import.upload" })}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowImportConfirm(false)}
                        >
                          {intl.formatMessage({ id: "common.cancel" })}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button disabled={!importFile || importing} onClick={() => void handleImport()}>
                        {importing ? intl.formatMessage({ id: "settings.messages.loading" }) : intl.formatMessage({ id: "settings.import.upload" })}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setImportFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                      >
                        {intl.formatMessage({ id: "common.cancel" })}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {onboardingBackups.length > 0 && (
                <>
                  <Separator />

                  {/* Backups Section */}
                  <div className="space-y-4">
                    <h4 className="font-medium">{intl.formatMessage({ id: "settings.backups.title" })}</h4>
                    <p className="text-sm text-muted-foreground">
                      {intl.formatMessage({ id: "settings.backups.description" })}
                    </p>
                    <div className="space-y-2">
                      {onboardingBackups.map((backup) => (
                        <div
                          key={backup.id}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <div>
                            <p className="font-medium text-sm">
                              {new Date(backup.created_at).toLocaleDateString(settings?.language, {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {backup.reason && intl.formatMessage({ id: `settings.backups.reason.${backup.reason}` })}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleDownloadBackup(backup.id)}
                            >
                              {intl.formatMessage({ id: "settings.backups.download" })}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void handleDeleteBackup(backup.id)}
                            >
                              {intl.formatMessage({ id: "settings.backups.delete" })}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <BillingTabContent />
        <AccountTabContent />
      </Tabs>
    </div>
  );
}

function BillingTabContent() {
  const intl = useIntl();
  const router = useRouter();
  const { subscription, usage, isPremium, isTrial, trialDaysLeft, openPortal, isLoading } = useSubscription();
  const { toast } = useToast();
  const [portalLoading, setPortalLoading] = useState(false);

  const handleManageSubscription = async () => {
    try {
      setPortalLoading(true);
      const portalUrl = await openPortal();
      window.location.href = portalUrl;
    } catch (error) {
      toast({
        title: intl.formatMessage({ id: "billing.error" }),
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const getPlanDisplayName = (planType: string | undefined) => {
    if (!planType) return intl.formatMessage({ id: "billing.free_plan" });
    const key = `billing.${planType}_plan`;
    return intl.formatMessage({ id: key });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <TabsContent value="billing">
        <Card>
          <CardContent className="py-8">
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    );
  }

  return (
    <TabsContent value="billing">
      <div className="space-y-6">
        {/* Subscription Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FontAwesomeIcon icon={faCrown} className="w-5 h-5 text-primary" />
              {intl.formatMessage({ id: "billing.status" })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Trial Banner */}
            {isTrial && trialDaysLeft !== null && trialDaysLeft > 0 && (
              <div className="bg-primary/10 border border-primary rounded-lg p-4">
                <p className="text-primary font-medium">
                  {intl.formatMessage({ id: "pricing.trial_banner" }, { days: trialDaysLeft })}
                </p>
              </div>
            )}

            {/* Current Plan */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{intl.formatMessage({ id: "billing.current_plan" })}</p>
                <p className="text-lg font-semibold flex items-center gap-2">
                  {isPremium && <FontAwesomeIcon icon={faCrown} className="w-4 h-4 text-primary" />}
                  {getPlanDisplayName(subscription?.plan_type)}
                </p>
              </div>
              {subscription?.is_lifetime ? (
                <div>
                  <p className="text-sm text-muted-foreground">{intl.formatMessage({ id: "billing.status" })}</p>
                  <p className="text-lg font-semibold text-success">Lifetime</p>
                </div>
              ) : isTrial && subscription?.trial_ends_at ? (
                <div>
                  <p className="text-sm text-muted-foreground">{intl.formatMessage({ id: "billing.trial_ends" })}</p>
                  <p className="text-lg font-semibold">{formatDate(subscription.trial_ends_at)}</p>
                </div>
              ) : subscription?.current_period_end ? (
                <div>
                  <p className="text-sm text-muted-foreground">{intl.formatMessage({ id: "billing.period_ends" })}</p>
                  <p className="text-lg font-semibold">{formatDate(subscription.current_period_end)}</p>
                </div>
              ) : null}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              {isPremium && !subscription?.is_lifetime && (
                <Button
                  variant="outline"
                  onClick={() => void handleManageSubscription()}
                  disabled={portalLoading}
                >
                  {portalLoading ? intl.formatMessage({ id: "pricing.loading" }) : intl.formatMessage({ id: "billing.manage_subscription" })}
                </Button>
              )}
              {!isPremium && (
                <Button onClick={() => router.push("/pricing")}>
                  {intl.formatMessage({ id: "billing.upgrade" })}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Usage Stats Card (only for free users) */}
        {!isPremium && usage && (
          <Card>
            <CardHeader>
              <CardTitle>{intl.formatMessage({ id: "billing.usage.title" })}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Expenses */}
                <div className="flex justify-between items-center">
                  <span className="text-sm">{intl.formatMessage({ id: "billing.usage.expenses" })}</span>
                  <span className="text-sm font-medium">
                    {usage.expenses.unlimited ? (
                      <FontAwesomeIcon icon={faInfinity} className="w-4 h-4 text-success" />
                    ) : (
                      `${usage.expenses.used} / ${usage.expenses.limit}`
                    )}
                  </span>
                </div>
                {!usage.expenses.unlimited && usage.expenses.limit && (
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (usage.expenses.used / usage.expenses.limit) * 100)}%` }}
                    />
                  </div>
                )}

                {/* Incomes */}
                <div className="flex justify-between items-center">
                  <span className="text-sm">{intl.formatMessage({ id: "billing.usage.incomes" })}</span>
                  <span className="text-sm font-medium">
                    {usage.incomes.unlimited ? (
                      <FontAwesomeIcon icon={faInfinity} className="w-4 h-4 text-success" />
                    ) : (
                      `${usage.incomes.used} / ${usage.incomes.limit}`
                    )}
                  </span>
                </div>
                {!usage.incomes.unlimited && usage.incomes.limit && (
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (usage.incomes.used / usage.incomes.limit) * 100)}%` }}
                    />
                  </div>
                )}

                {/* Loans */}
                <div className="flex justify-between items-center">
                  <span className="text-sm">{intl.formatMessage({ id: "billing.usage.loans" })}</span>
                  <span className="text-sm font-medium">
                    {usage.loans.unlimited ? (
                      <FontAwesomeIcon icon={faInfinity} className="w-4 h-4 text-success" />
                    ) : (
                      `${usage.loans.used} / ${usage.loans.limit}`
                    )}
                  </span>
                </div>
                {!usage.loans.unlimited && usage.loans.limit && (
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (usage.loans.used / usage.loans.limit) * 100)}%` }}
                    />
                  </div>
                )}

                {/* Savings Goals */}
                <div className="flex justify-between items-center">
                  <span className="text-sm">{intl.formatMessage({ id: "billing.usage.savings" })}</span>
                  <span className="text-sm font-medium">
                    {usage.savings_goals.unlimited ? (
                      <FontAwesomeIcon icon={faInfinity} className="w-4 h-4 text-success" />
                    ) : (
                      `${usage.savings_goals.used} / ${usage.savings_goals.limit}`
                    )}
                  </span>
                </div>
                {!usage.savings_goals.unlimited && usage.savings_goals.limit && (
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (usage.savings_goals.used / usage.savings_goals.limit) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TabsContent>
  );
}

function AccountTabContent() {
  const intl = useIntl();
  const { data: session } = useSession();
  const { toast } = useToast();
  const { subscription } = useSubscription();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const userEmail = session?.user?.email ?? null;

  // Get the confirmation phrase based on language
  const requiredPhrase = intl.formatMessage({ id: "settings.account.deleteDialog.confirmPhrase" });
  const isConfirmPhraseValid = confirmPhrase === requiredPhrase;

  // Determine subscription info for the dialog
  const hasActiveSubscription = subscription?.status === "active" || subscription?.status === "trialing";
  const isLifetime = subscription?.is_lifetime;
  const planType = subscription?.plan_type;

  const handleDeleteAccount = async () => {
    if (!userEmail || !isConfirmPhraseValid) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/users/me/account`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            confirmation_phrase: confirmPhrase,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to delete account");
      }

      toast({
        title: intl.formatMessage({ id: "settings.messages.deleteSuccess" }),
      });

      // Sign out and redirect to home
      await signOut({ callbackUrl: "/" });
    } catch (error) {
      logger.error("[Settings] Failed to delete account", error);
      toast({
        title: intl.formatMessage({ id: "settings.messages.deleteError" }),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setConfirmPhrase("");
    }
  };

  return (
    <TabsContent value="account">
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <FontAwesomeIcon icon={faTriangleExclamation} className="w-5 h-5" />
            {intl.formatMessage({ id: "settings.account.dangerZone.title" })}
          </CardTitle>
          <CardDescription>
            {intl.formatMessage({ id: "settings.account.dangerZone.description" })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                {intl.formatMessage({ id: "settings.account.dangerZone.deleteButton" })}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                  <FontAwesomeIcon icon={faTriangleExclamation} className="w-5 h-5" />
                  {intl.formatMessage({ id: "settings.account.deleteDialog.title" })}
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-4 text-left">
                    <p className="font-semibold text-destructive">
                      {intl.formatMessage({ id: "settings.account.deleteDialog.warning" })}
                    </p>

                    <div>
                      <p className="font-medium mb-2">
                        {intl.formatMessage({ id: "settings.account.deleteDialog.whatDeleted" })}
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>{intl.formatMessage({ id: "settings.account.deleteDialog.items.financial" })}</li>
                        <li>{intl.formatMessage({ id: "settings.account.deleteDialog.items.banking" })}</li>
                        <li>{intl.formatMessage({ id: "settings.account.deleteDialog.items.progress" })}</li>
                      </ul>
                    </div>

                    <div>
                      <p className="font-medium mb-1">
                        {intl.formatMessage({ id: "settings.account.deleteDialog.subscription" })}
                      </p>
                      <p className="text-sm">
                        {isLifetime ? (
                          intl.formatMessage({ id: "settings.account.deleteDialog.subscriptionLifetime" })
                        ) : hasActiveSubscription ? (
                          intl.formatMessage(
                            { id: "settings.account.deleteDialog.subscriptionActive" },
                            { planType: planType || "monthly" }
                          )
                        ) : (
                          intl.formatMessage({ id: "settings.account.deleteDialog.subscriptionNone" })
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="font-medium mb-1">
                        {intl.formatMessage({ id: "settings.account.deleteDialog.gdpr" })}
                      </p>
                      <p className="text-sm">
                        {intl.formatMessage({ id: "settings.account.deleteDialog.gdprText" })}
                      </p>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label htmlFor="confirm-phrase">
                        {intl.formatMessage(
                          { id: "settings.account.deleteDialog.confirmLabel" },
                          { phrase: requiredPhrase }
                        )}
                      </Label>
                      <Input
                        id="confirm-phrase"
                        value={confirmPhrase}
                        onChange={(e) => setConfirmPhrase(e.target.value)}
                        placeholder={intl.formatMessage({ id: "settings.account.deleteDialog.confirmPlaceholder" })}
                        className="font-mono"
                      />
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfirmPhrase("")}>
                  {intl.formatMessage({ id: "settings.account.deleteDialog.cancel" })}
                </AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={!isConfirmPhraseValid || isDeleting}
                >
                  {isDeleting
                    ? intl.formatMessage({ id: "settings.account.deleteDialog.deleting" })
                    : intl.formatMessage({ id: "settings.account.deleteDialog.delete" })}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
