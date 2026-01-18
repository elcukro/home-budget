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
  faKey,
} from "@fortawesome/free-solid-svg-icons";
import { signOut } from "next-auth/react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface BankingConnection {
  id: number;
  institution_id: string;
  institution_name: string;
  requisition_id: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  accounts: string[] | null;
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
  banking?: {
    connections?: BankingConnection[];
  };
  // Polish tax profile
  employment_status?: string | null;
  tax_form?: string | null;
  birth_year?: number | null;
  use_authors_costs?: boolean;
  ppk_enrolled?: boolean | null;
  ppk_employee_rate?: number | null;
  ppk_employer_rate?: number | null;
  children_count?: number;
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
  }, [searchParams]);

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bankingConnections, setBankingConnections] = useState<BankingConnection[]>([]);
  const [tinkConnections, setTinkConnections] = useState<TinkConnection[]>([]);
  const [tinkConnecting, setTinkConnecting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [shouldClearBeforeImport, setShouldClearBeforeImport] = useState<boolean>(false);

  const userEmail = session?.user?.email ?? null;

  const fetchSettings = async () => {
    if (!userEmail) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/users/${encodeURIComponent(userEmail)}/settings`,
        {
          headers: { Accept: "application/json" },
        },
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data: UserSettings = await response.json();
      setSettings(data);
      setBankingConnections(data.banking?.connections ?? []);
    } catch (err) {
      logger.error("[Settings] Failed to fetch settings", err);
      setError(intl.formatMessage({ id: "settings.messages.error" }));
    } finally {
      setLoading(false);
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

  useEffect(() => {
    void fetchSettings();
    void fetchTinkConnections();
  }, [userEmail]);

  // Refetch Tink connections when integrations tab becomes active (e.g., after returning from callback)
  useEffect(() => {
    if (activeTab === 'integrations') {
      void fetchTinkConnections();
    }
  }, [activeTab]);

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
        children_count: settings.children_count ?? undefined,
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
        ai: {
          apiKey: settings.ai?.apiKey,
        },
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
        children_count: settings.children_count ?? undefined,
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

  const handleExport = async (format: "json" | "csv" | "xlsx") => {
    if (!userEmail) {
      toast({
        title: intl.formatMessage({ id: "settings.messages.notLoggedIn" }),
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/users/${encodeURIComponent(userEmail)}/export/?format=${format}`,
      );

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `home_budget_export_${userEmail}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

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

  const handleImport = async () => {
    if (!importFile) {
      return;
    }

    try {
      if (shouldClearBeforeImport) {
        const confirmPrimary = window.confirm(
          intl.formatMessage({ id: "settings.import.confirmClearPrimary" }),
        );
        if (!confirmPrimary) {
          return;
        }
        const confirmSecondary = window.confirm(
          intl.formatMessage({ id: "settings.import.confirmClearSecondary" }),
        );
        if (!confirmSecondary) {
          return;
        }
      }

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
        throw new Error(await response.text());
      }

      toast({
        title: intl.formatMessage({ id: 'settings.messages.importSuccess' }),
      });
      setImportFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setShouldClearBeforeImport(false);
      void fetchSettings();
    } catch (err) {
      logger.error("[Settings] Import failed", err);
      toast({
        title: intl.formatMessage({ id: 'settings.messages.importError' }),
        variant: 'destructive',
      });
    }
  };

  const handleDeleteConnection = async (connectionId: number) => {
    if (!confirm(intl.formatMessage({ id: "settings.messages.confirmBankDelete" }))) {
      return;
    }

    try {
      const response = await fetch(`/api/banking/connections/${connectionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast({
        title: intl.formatMessage({ id: "settings.messages.bankDeleteSuccess" }),
      });
      setBankingConnections((prev) => prev.filter((conn) => conn.id !== connectionId));
    } catch (err) {
      logger.error("[Settings] Failed to delete banking connection", err);
      toast({
        title: intl.formatMessage({ id: "settings.messages.bankDeleteError" }),
        variant: "destructive",
      });
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
          <TabsTrigger value="integrations" className="gap-2">
            <FontAwesomeIcon icon={faBuilding} className="w-4 h-4" />
            <span className="hidden sm:inline">{intl.formatMessage({ id: "settings.tabs.integrations" })}</span>
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-2">
            <FontAwesomeIcon icon={faDatabase} className="w-4 h-4" />
            <span className="hidden sm:inline">{intl.formatMessage({ id: "settings.tabs.data" })}</span>
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2">
            <FontAwesomeIcon icon={faCrown} className="w-4 h-4" />
            <span className="hidden sm:inline">{intl.formatMessage({ id: "billing.title" })}</span>
          </TabsTrigger>
          <TabsTrigger value="account" className="gap-2">
            <FontAwesomeIcon icon={faUser} className="w-4 h-4" />
            <span className="hidden sm:inline">{intl.formatMessage({ id: "settings.tabs.account" })}</span>
          </TabsTrigger>
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
                </div>

                <Button type="submit">
                  {intl.formatMessage({ id: "settings.form.submit" })}
                </Button>
              </form>
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
                      <Input
                        id="emergency_fund_target"
                        type="number"
                        min={1000}
                        step={50}
                        value={settings.emergency_fund_target}
                        onChange={(event) =>
                          setSettings((prev) =>
                            prev && {
                              ...prev,
                              emergency_fund_target: Number(event.target.value),
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

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <FontAwesomeIcon icon={faKey} className="w-4 h-4 text-muted-foreground" />
                      <h4 className="font-medium">{intl.formatMessage({ id: "settings.ai.title" })}</h4>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ai_api_key">
                        {intl.formatMessage({ id: "settings.form.claudeApiKey" })}
                      </Label>
                      <Input
                        id="ai_api_key"
                        type="password"
                        value={settings.ai?.apiKey ?? ""}
                        onChange={(event) =>
                          setSettings((prev) =>
                            prev && {
                              ...prev,
                              ai: {
                                ...(prev.ai ?? {}),
                                apiKey: event.target.value,
                              },
                            },
                          )
                        }
                        placeholder={intl.formatMessage({ id: "settings.form.claudeApiKeyPlaceholder" })}
                      />
                      <p className="text-xs text-muted-foreground">
                        {intl.formatMessage({ id: "settings.tooltips.claudeApiKey" })}
                      </p>
                    </div>
                  </div>

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
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-green-500" />
                            <span className="font-medium">Connected</span>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => void handleTinkDisconnect(connection.id)}
                          >
                            Disconnect
                          </Button>
                        </div>
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

            {/* GoCardless Connections - Legacy */}
            <Card>
              <CardHeader>
                <CardTitle>{intl.formatMessage({ id: "settings.banking.title" })} (GoCardless)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {bankingConnections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {intl.formatMessage({ id: "settings.banking.noConnections" })}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {bankingConnections.map((connection) => (
                      <div
                        key={connection.id}
                        className="flex flex-col gap-1 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-medium text-primary">
                            {connection.institution_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {intl.formatMessage({ id: "settings.banking.requisition" })}: {connection.requisition_id}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {intl.formatMessage({ id: "settings.banking.expires" })}: {new Date(connection.expires_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => void handleDeleteConnection(connection.id)}
                        >
                          {intl.formatMessage({ id: "settings.banking.remove" })}
                        </Button>
                      </div>
                    ))}
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
                <p className="text-sm text-muted-foreground">
                  {intl.formatMessage({ id: "settings.export.description" })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void handleExport("json")}>
                    {intl.formatMessage({ id: "settings.export.json" })}
                  </Button>
                  <Button variant="outline" onClick={() => void handleExport("csv")}>
                    {intl.formatMessage({ id: "settings.export.csv" })}
                  </Button>
                  <Button variant="outline" onClick={() => void handleExport("xlsx")}>
                    {intl.formatMessage({ id: "settings.export.xlsx" })}
                  </Button>
                </div>
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
                  <div className="flex gap-2">
                    <Button disabled={!importFile} onClick={() => void handleImport()}>
                      {intl.formatMessage({ id: "settings.import.upload" })}
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
                </div>
              </div>
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
        `${API_BASE_URL}/users/me/account?user_id=${encodeURIComponent(userEmail)}`,
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
