import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import * as api from "@/lib/api";
import { setAnalyticsEnabled } from "@/lib/sentry";
import { ensureNotificationPermission } from "@/lib/notifications";
import type { NotificationLevel } from "@openhelm/shared";

export function ApplicationSection() {
  const [launchAtLogin, setLaunchAtLogin] = useState(false);
  const [launchLoading, setLaunchLoading] = useState(true);
  const [analyticsEnabled, setAnalyticsEnabledState] = useState(true);
  const [notifLevel, setNotifLevel] = useState<NotificationLevel>("alerts_only");
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [emailEditing, setEmailEditing] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSaving, setEmailSaving] = useState(false);

  useEffect(() => {
    invoke<boolean>("plugin:autostart|is_enabled")
      .then(setLaunchAtLogin)
      .catch(() => setLaunchAtLogin(false))
      .finally(() => setLaunchLoading(false));

    api
      .getSetting("analytics_enabled")
      .then((s) => setAnalyticsEnabledState(s?.value !== "false"))
      .catch(() => {});

    api
      .getSetting("notification_level")
      .then((s) => {
        const v = s?.value;
        if (v === "never" || v === "on_finish" || v === "alerts_only") {
          setNotifLevel(v);
        }
      })
      .catch(() => {});

    api
      .getSetting("newsletter_email")
      .then((s) => {
        if (s?.value) setNewsletterEmail(s.value);
      })
      .catch(() => {});
  }, []);

  const toggleLaunchAtLogin = async (enabled: boolean) => {
    try {
      if (enabled) {
        await invoke("plugin:autostart|enable");
      } else {
        await invoke("plugin:autostart|disable");
      }
      setLaunchAtLogin(enabled);
    } catch (err) {
      console.error("Failed to toggle launch at login:", err);
    }
  };

  const toggleAnalytics = (checked: boolean) => {
    setAnalyticsEnabledState(checked);
    setAnalyticsEnabled(checked);
    api
      .setSetting({ key: "analytics_enabled", value: String(checked) })
      .catch(() => {});
  };

  const changeNotifLevel = async (value: string) => {
    const level = value as NotificationLevel;
    setNotifLevel(level);
    await api.setSetting({ key: "notification_level", value: level }).catch(() => {});
    if (level !== "never") {
      await ensureNotificationPermission();
    }
  };

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const saveNewsletterEmail = async () => {
    if (!isValidEmail(emailInput.trim())) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailSaving(true);
    setEmailError(null);
    try {
      await api.setSetting({ key: "newsletter_email", value: emailInput.trim() });
      setNewsletterEmail(emailInput.trim());
      setEmailEditing(false);
    } catch {
      setEmailError("Failed to save — please try again.");
    } finally {
      setEmailSaving(false);
    }
  };

  const removeNewsletterEmail = async () => {
    try {
      await api.deleteSetting("newsletter_email");
      setNewsletterEmail("");
      setEmailInput("");
      setEmailEditing(false);
    } catch {
      // Silently ignore — worst case email remains stored locally
    }
  };

  const startEditing = () => {
    setEmailInput(newsletterEmail);
    setEmailError(null);
    setEmailEditing(true);
  };

  return (
    <div>
      <h3 className="mb-3 font-medium">Application</h3>
      <div className="space-y-4 text-sm text-muted-foreground">
        <p>Version: 0.1.0</p>
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm text-foreground">Launch at login</Label>
            <p className="text-xs text-muted-foreground">
              Start OpenHelm automatically when you log in.
            </p>
          </div>
          <Switch
            checked={launchAtLogin}
            onCheckedChange={toggleLaunchAtLogin}
            disabled={launchLoading}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-sm text-foreground">
              Share anonymous error reports
            </Label>
            <p className="text-xs text-muted-foreground">
              Send crash reports to help improve OpenHelm. No code,
              prompts, or file paths included.
            </p>
          </div>
          <Switch checked={analyticsEnabled} onCheckedChange={toggleAnalytics} />
        </div>
        <div>
          <Label className="text-sm text-foreground">Notifications</Label>
          <p className="mb-2 text-xs text-muted-foreground">
            Choose when to receive native notifications.
          </p>
          <RadioGroup
            value={notifLevel}
            onValueChange={changeNotifLevel}
            className="space-y-1"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="alerts_only" id="notif-alerts" />
              <Label htmlFor="notif-alerts" className="text-sm font-normal cursor-pointer">
                Alerts only (default) — when something needs attention
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="on_finish" id="notif-finish" />
              <Label htmlFor="notif-finish" className="text-sm font-normal cursor-pointer">
                When any job finishes
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="never" id="notif-never" />
              <Label htmlFor="notif-never" className="text-sm font-normal cursor-pointer">
                Never
              </Label>
            </div>
          </RadioGroup>
        </div>
        <div>
          <Label className="text-sm text-foreground">Newsletter</Label>
          <p className="mb-2 text-xs text-muted-foreground">
            Receive occasional updates on new features and releases.
          </p>
          {newsletterEmail && !emailEditing ? (
            <div className="flex items-center gap-2">
              <span className="text-sm">{newsletterEmail}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-0.5 text-xs"
                onClick={startEditing}
              >
                Change
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-0.5 text-xs text-destructive hover:text-destructive"
                onClick={removeNewsletterEmail}
              >
                Remove
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    setEmailError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveNewsletterEmail();
                    if (e.key === "Escape" && emailEditing) setEmailEditing(false);
                  }}
                  disabled={emailSaving}
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  className="h-8"
                  onClick={saveNewsletterEmail}
                  disabled={emailSaving || emailInput.trim() === ""}
                >
                  {emailSaving ? "Saving…" : "Subscribe"}
                </Button>
                {emailEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => setEmailEditing(false)}
                    disabled={emailSaving}
                  >
                    Cancel
                  </Button>
                )}
              </div>
              {emailError && (
                <p className="text-xs text-destructive">{emailError}</p>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-4">
          <a
            href="https://openhelm.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-foreground"
          >
            OpenHelm.ai <ExternalLink className="size-3" />
          </a>
          <a
            href="https://github.com/openhelm/openhelm"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-foreground"
          >
            GitHub <ExternalLink className="size-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
