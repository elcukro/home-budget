"use client";

import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useSession } from "next-auth/react";

import { useSettings } from "@/contexts/SettingsContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

export default function SettingsPage() {
  const { data: session } = useSession();
  const intl = useIntl();
  const { toast } = useToast();
  const { updateSettings: updateContextSettings } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bankingConnections, setBankingConnections] = useState<BankingConnection[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);

  const userEmail = session?.user?.email ?? null;

  const fetchSettings = async () => {
    if (!userEmail) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/users/${encodeURIComponent(userEmail)}/settings/`,
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
      console.error("[Settings] Failed to fetch settings", err);
      setError(intl.formatMessage({ id: "settings.messages.error" }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSettings();
  }, [userEmail]);

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
      });

      toast({
        title: intl.formatMessage({ id: "settings.messages.success" }),
      });
    } catch (err) {
      console.error("[Settings] Failed to update settings", err);
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
      console.error("[Settings] Export failed", err);
      toast({
        title: intl.formatMessage({ id: "settings.messages.exportError" }),
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (!userEmail || !importFile) {
      return;
    }

    const formData = new FormData();
    formData.append("file", importFile);

    try {
      const response = await fetch(
        `${API_BASE_URL}/users/${encodeURIComponent(userEmail)}/import`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast({
        title: intl.formatMessage({ id: "settings.messages.importSuccess" }),
      });
      setImportFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      void fetchSettings();
    } catch (err) {
      console.error("[Settings] Import failed", err);
      toast({
        title: intl.formatMessage({ id: "settings.messages.importError" }),
        variant: "destructive",
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
      console.error("[Settings] Failed to delete banking connection", err);
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
      <Card>
        <CardHeader>
          <CardTitle>{intl.formatMessage({ id: "settings.title" })}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="language">
                  {intl.formatMessage({ id: "settings.form.language" })}
                </Label>
                <Select
                  value={settings.language}
                  onValueChange={(value) =>
                    setSettings((prev) => prev && { ...prev, language: value })
                  }
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">
                  {intl.formatMessage({ id: "settings.form.currency" })}
                </Label>
                <Select
                  value={settings.currency}
                  onValueChange={(value) =>
                    setSettings((prev) => prev && { ...prev, currency: value })
                  }
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
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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
              </div>
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
            </div>

            <Button type="submit">
              {intl.formatMessage({ id: "settings.form.submit" })}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Tabs defaultValue="import-export">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="import-export">
            {intl.formatMessage({ id: "settings.tabs.importExport" })}
          </TabsTrigger>
          <TabsTrigger value="banking">
            {intl.formatMessage({ id: "settings.tabs.banking" })}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="import-export">
          <Card>
            <CardHeader>
              <CardTitle>{intl.formatMessage({ id: "settings.export.title" })}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {intl.formatMessage({ id: "settings.export.description" })}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void handleExport("json")}>{intl.formatMessage({ id: "settings.export.json" })}</Button>
                <Button variant="outline" onClick={() => void handleExport("csv")}>{intl.formatMessage({ id: "settings.export.csv" })}</Button>
                <Button variant="outline" onClick={() => void handleExport("xlsx")}>{intl.formatMessage({ id: "settings.export.xlsx" })}</Button>
              </div>

              <Separator />

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
                  <p className="text-sm text-muted-foreground">
                    {intl.formatMessage({ id: "settings.import.description" })}
                  </p>
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
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="banking">
          <Card>
            <CardHeader>
              <CardTitle>{intl.formatMessage({ id: "settings.banking.title" })}</CardTitle>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
