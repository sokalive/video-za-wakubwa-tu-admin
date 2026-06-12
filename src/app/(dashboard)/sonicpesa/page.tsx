"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Wifi, XCircle, Zap } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/client";
import type { SonicpesaSettings } from "@/types";

const defaultSettings: SonicpesaSettings = {
  enabled: false,
  environment: "sandbox",
  apiEndpoint: "",
  accountId: "",
  apiKey: "",
  webhookUrl: "",
  hasApiKey: false,
  apiKeyMasked: "",
  isActiveCheckoutProvider: false,
  payment_provider: "legacy",
  lastTestAt: null,
  lastTestOk: null,
  lastTestMessage: "",
  lastWebhookAt: null,
  lastWebhookEvent: "",
  lastWebhookOrderId: "",
  setAsActiveCheckoutProvider: false,
  envOverrideAny: false,
};

function inputClass() {
  return "bg-white/5 border-white/10";
}

export default function SonicPesaSettingsPage() {
  const [cfg, setCfg] = useState<SonicpesaSettings>(defaultSettings);
  const [draft, setDraft] = useState<SonicpesaSettings>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [flash, setFlash] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const defaultWebhook =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/payments/sonicpesa/webhook`
      : "https://video-za-wakubwa-tu-admin.vercel.app/api/payments/sonicpesa/webhook";

  const loadSettings = useCallback(async () => {
    try {
      const res = await api.sonicpesa.get();
      const s = res.data;
      const merged: SonicpesaSettings = {
        ...defaultSettings,
        ...s,
        enabled: Boolean(s?.enabled),
        environment: String(s?.environment || "sandbox").toLowerCase() === "live" ? "live" : "sandbox",
        apiEndpoint: s?.apiEndpoint ?? s?.api_endpoint ?? "",
        accountId: s?.accountId ?? s?.account_id ?? "",
        webhookUrl: s?.webhookUrl ?? s?.webhook_url ?? defaultWebhook,
        hasApiKey: Boolean(s?.hasApiKey),
        apiKeyMasked: String(s?.apiKeyMasked || "******"),
        isActiveCheckoutProvider: Boolean(s?.isActiveCheckoutProvider),
        payment_provider: String(s?.payment_provider || "legacy"),
        lastWebhookAt: s?.lastWebhookAt ?? s?.last_webhook_at ?? null,
        lastWebhookEvent: String(s?.lastWebhookEvent ?? s?.last_webhook_event ?? ""),
        lastWebhookOrderId: String(s?.lastWebhookOrderId ?? s?.last_webhook_order_id ?? ""),
        setAsActiveCheckoutProvider: Boolean(s?.isActiveCheckoutProvider),
        envOverrideAny: Boolean(s?.envOverrideAny),
      };
      setCfg(merged);
      setDraft({ ...merged, apiKey: "" });
    } catch (e) {
      setFlash({ type: "error", message: e instanceof Error ? e.message : "Could not load settings" });
    }
  }, [defaultWebhook]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const dirty = useMemo(
    () =>
      draft.enabled !== cfg.enabled ||
      draft.environment !== cfg.environment ||
      draft.apiEndpoint !== cfg.apiEndpoint ||
      draft.accountId !== cfg.accountId ||
      draft.webhookUrl !== cfg.webhookUrl ||
      (draft.apiKey ?? "").trim() !== "" ||
      draft.setAsActiveCheckoutProvider !== cfg.setAsActiveCheckoutProvider,
    [draft, cfg]
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (draft.enabled && !draft.apiEndpoint.trim() && !cfg.hasApiKey) {
        setFlash({ type: "error", message: "API endpoint is required when SonicPesa is enabled" });
        return;
      }
      const payload: Record<string, unknown> = {
        enabled: draft.enabled,
        environment: draft.environment,
        apiEndpoint: draft.apiEndpoint.trim() || "https://api.sonicpesa.com/api/v1",
        accountId: draft.accountId.trim(),
        webhookUrl: draft.webhookUrl.trim() || defaultWebhook,
        setAsActiveCheckoutProvider: draft.setAsActiveCheckoutProvider,
        payment_provider: draft.setAsActiveCheckoutProvider ? "sonicpesa" : undefined,
      };
      if ((draft.apiKey ?? "").trim()) payload.apiKey = draft.apiKey!.trim();
      const saved = await api.sonicpesa.update(payload);
      setCfg(saved.data);
      setDraft({ ...saved.data, apiKey: "" });
      setFlash({ type: "success", message: "SonicPesa settings saved." });
    } catch (err) {
      setFlash({ type: "error", message: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    try {
      const result = await api.sonicpesa.test();
      const ok = result.success === true;
      const msg = String(result.message || (ok ? "OK" : "Failed"));
      setFlash({ type: ok ? "success" : "error", message: msg });
      await loadSettings();
    } catch (err) {
      setFlash({ type: "error", message: err instanceof Error ? err.message : "Test failed" });
    } finally {
      setTesting(false);
    }
  }

  const connected = cfg.lastTestOk === true;
  const failed = cfg.lastTestOk === false;

  return (
    <DashboardShell title="SonicPesa Settings">
      <div className="space-y-6">
        {flash ? (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              flash.type === "success"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                : "border-red-500/40 bg-red-500/10 text-red-200"
            }`}
          >
            {flash.message}
          </div>
        ) : null}

        {cfg.envOverrideAny ? (
          <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <p className="font-semibold text-amber-200">SONICPESA_* environment overrides active</p>
            <p className="mt-1 text-amber-100/90">
              The form shows PostgreSQL values. Live requests may use process.env when set.
            </p>
          </div>
        ) : null}

        <header>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Zap className="h-7 w-7 text-amber-400" />
              SonicPesa Settings
            </h1>
            {cfg.isActiveCheckoutProvider ? (
              <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-200 ring-1 ring-emerald-400/40">
                Active checkout provider
              </span>
            ) : (
              <span className="rounded-lg bg-white/5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-gray-400 ring-1 ring-white/10">
                Not active provider
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-400">
            Mobile money checkout via SonicPesa. Existing legacy VIP pay remains available when not selected as active provider.
          </p>
        </header>

        <form onSubmit={handleSave} className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="space-y-5 rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-400/90">Connection</h2>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
                className="h-4 w-4 rounded"
              />
              <div>
                <p className="text-sm font-semibold text-white">Enable SonicPesa at checkout</p>
                <p className="text-xs text-gray-500">When off, SonicPesa is hidden from the payment method list.</p>
              </div>
            </label>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
              <input
                type="checkbox"
                checked={draft.setAsActiveCheckoutProvider}
                onChange={(e) => setDraft((d) => ({ ...d, setAsActiveCheckoutProvider: e.target.checked }))}
                className="h-4 w-4 rounded"
              />
              <div>
                <p className="text-sm font-semibold text-white">Use SonicPesa as active app checkout provider</p>
                <p className="text-xs text-gray-500">Website routes VIP payments here when enabled.</p>
              </div>
            </label>

            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <Wifi className="h-5 w-5 shrink-0 text-gray-400" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase text-gray-500">Connection status</p>
                <p className="mt-0.5 flex items-center gap-2 text-sm font-medium">
                  {cfg.lastTestOk == null ? (
                    <span className="text-gray-400">Not tested yet</span>
                  ) : connected ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span className="text-emerald-300">Connected</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-400" />
                      <span className="text-red-300">Failed</span>
                    </>
                  )}
                </p>
                {cfg.lastTestAt ? (
                  <p className="mt-1 text-xs text-gray-500">Last check: {new Date(cfg.lastTestAt).toLocaleString()}</p>
                ) : null}
                {failed && cfg.lastTestMessage ? (
                  <p className="mt-1 text-xs text-red-400/90">{cfg.lastTestMessage}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Environment</Label>
              <select
                value={draft.environment}
                onChange={(e) => setDraft((d) => ({ ...d, environment: e.target.value as "live" | "sandbox" }))}
                className={`w-full rounded-md px-3 py-2 text-sm ${inputClass()}`}
              >
                <option value="live">Live</option>
                <option value="sandbox">Sandbox</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>API endpoint</Label>
              <Input
                value={draft.apiEndpoint}
                onChange={(e) => setDraft((d) => ({ ...d, apiEndpoint: e.target.value }))}
                placeholder="https://api.sonicpesa.com/api/v1"
                className={inputClass()}
              />
            </div>

            <div className="space-y-2">
              <Label>Account / Merchant ID</Label>
              <Input
                value={draft.accountId}
                onChange={(e) => setDraft((d) => ({ ...d, accountId: e.target.value }))}
                placeholder="Merchant identifier"
                className={inputClass()}
              />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing}
              className="w-full border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
            >
              {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Test connection
            </Button>
          </div>

          <div className="space-y-5 rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-400/90">Credentials</h2>

            <div className="space-y-2">
              <Label>API key (masked when saved)</Label>
              <Input
                type="password"
                autoComplete="off"
                value={draft.apiKey ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, apiKey: e.target.value }))}
                placeholder="Enter API key"
                className={inputClass()}
              />
              <p className="text-xs text-gray-500">
                Stored preview: <span className="font-mono text-gray-400">{cfg.hasApiKey ? cfg.apiKeyMasked : "—"}</span>
                {cfg.hasApiKey ? (
                  <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">
                    Saved
                  </span>
                ) : null}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Webhook URL (configure in SonicPesa dashboard)</Label>
              <Input
                value={draft.webhookUrl || defaultWebhook}
                onChange={(e) => setDraft((d) => ({ ...d, webhookUrl: e.target.value }))}
                className={inputClass()}
              />
              <p className="text-xs text-gray-500">
                Optional HMAC: set SONICPESA_WEBHOOK_SECRET and send x-sonicpesa-signature header.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs font-semibold uppercase text-gray-500">Last webhook status</p>
              {cfg.lastWebhookAt ? (
                <>
                  <p className="mt-1 text-sm text-white">
                    Last event: <span className="font-medium text-emerald-300">{cfg.lastWebhookEvent || "received"}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {new Date(cfg.lastWebhookAt).toLocaleString()}
                    {cfg.lastWebhookOrderId ? (
                      <>
                        {" "}
                        · order <span className="font-mono text-gray-400">{cfg.lastWebhookOrderId}</span>
                      </>
                    ) : null}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-gray-400">No webhook received yet</p>
              )}
            </div>
          </div>

          <div className="xl:col-span-2 flex justify-end gap-3">
            <Button type="button" variant="outline" disabled={!dirty || saving || testing} onClick={() => setDraft({ ...cfg, apiKey: "" })}>
              Reset
            </Button>
            <Button type="submit" disabled={!dirty || saving || testing} className="bg-amber-500 text-black hover:bg-amber-400">
              {saving ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}
