import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useNaturals } from "../../context";
import { Badge, Body, Button, Card, Chip, Display, EmptyState, Eyebrow, Field, LoadingBlock } from "../../ui";

const ROLES = ["customer", "admin", "developer"];

function formatTimestamp(value: string | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatUptime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

export function DeveloperScreen() {
  const {
    t,
    bp,
    user,
    users,
    usersLoading,
    loadUsers,
    setUserRole,
    diagnostics,
    diagnosticsLoading,
    loadDiagnostics,
    developerModeEnabled,
    developerSettings,
    setDeveloperSettings,
    loadDeveloperSettings,
    setDeveloperMode,
    saveDeveloperSettings,
    ask,
    busy,
  } = useNaturals();

  const [query, setQuery] = useState("");

  useEffect(() => {
    void loadUsers();
    void loadDiagnostics();
    void loadDeveloperSettings();
  }, [loadUsers, loadDiagnostics, loadDeveloperSettings]);

  const filtered = users.filter((item) => {
    const text = query.trim().toLowerCase();
    if (!text) return true;
    return `${item.name} ${item.email} ${item.role}`.toLowerCase().includes(text);
  });

  const changeRole = (userId: number, role: string) => {
    if (userId === user?.id && role !== user?.role) {
      ask({
        title: "Change your own role?",
        message: "Changing your own role may remove developer access immediately. Continue?",
        confirmLabel: "Change role",
        cancelLabel: "Cancel",
        destructive: true,
        onConfirm: () => {
          void setUserRole(userId, role);
        },
      });
      return;
    }
    void setUserRole(userId, role);
  };

  return (
    <View style={{ paddingTop: 24 }}>
      <Eyebrow>Operations, diagnostics & access control</Eyebrow>
      <Display size={bp.isMobile ? 30 : 40} style={{ marginTop: 4 }}>
        Developer
      </Display>
      <Body size={12.5} color={t.muted} style={{ marginTop: 8 }}>
        Runtime diagnostics, developer-mode controls and staff role management. Secrets are never exposed.
      </Body>

      <Card style={{ marginTop: 18 }}>
        <View style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <View>
              <Eyebrow>Runtime diagnostics</Eyebrow>
              <Display size={22} style={{ marginTop: 4 }}>System status</Display>
            </View>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              {diagnostics ? <Badge label={diagnostics.status} tone="success" /> : null}
              <Button title="Refresh" small kind="outline" onPress={() => void loadDiagnostics()} loading={diagnosticsLoading} icon="refresh-outline" />
            </View>
          </View>

          {!diagnostics ? (
            diagnosticsLoading ? <LoadingBlock label="Loading diagnostics…" /> : <Body size={11} color={t.muted}>No diagnostics loaded.</Body>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {[
                { label: "Version", value: diagnostics.version },
                { label: "Database", value: diagnostics.database_dialect },
                { label: "Uptime", value: formatUptime(diagnostics.uptime_seconds) },
                { label: "Server time", value: formatTimestamp(diagnostics.server_time) },
                { label: "Started", value: formatTimestamp(diagnostics.started_at) },
                { label: "Developer mode", value: diagnostics.developer_mode ? "enabled" : "disabled" },
                { label: "CORS origins", value: diagnostics.config.cors_origins || "—" },
                { label: "Token lifetime", value: `${diagnostics.config.access_token_minutes} min` },
                { label: "Admin seeded", value: diagnostics.config.admin_seed_configured ? "yes" : "no" },
                { label: "Developer seeded", value: diagnostics.config.developer_seed_configured ? "yes" : "no" },
              ].map((item) => (
                <View key={item.label} style={{ flexGrow: 1, flexBasis: bp.isMobile ? "100%" : "30%", minWidth: 160, borderWidth: 1, borderColor: t.border, borderRadius: 12, padding: 12 }}>
                  <Body size={9.5} weight="700" color={t.muted} style={{ textTransform: "uppercase", letterSpacing: 0.8 }}>{item.label}</Body>
                  <Body size={12} weight="600" color={t.ink} style={{ marginTop: 3 }} numberOfLines={2}>{item.value}</Body>
                </View>
              ))}
            </View>
          )}

          {diagnostics ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {Object.entries(diagnostics.counts).map(([label, value]) => (
                <View key={label} style={{ flexGrow: 1, flexBasis: bp.isMobile ? "45%" : "15%", minWidth: 110, borderRadius: 12, backgroundColor: t.surfaceAlt, padding: 12 }}>
                  <Body size={9.5} weight="700" color={t.muted} style={{ textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</Body>
                  <Display size={22} color={t.primary} style={{ marginTop: 2 }}>{value}</Display>
                </View>
              ))}
              <View style={{ flexGrow: 1, flexBasis: bp.isMobile ? "100%" : "30%", minWidth: 160, borderRadius: 12, backgroundColor: t.surfaceAlt, padding: 12 }}>
                <Body size={9.5} weight="700" color={t.muted} style={{ textTransform: "uppercase", letterSpacing: 0.8 }}>Uploads</Body>
                <Body size={12} weight="600" color={t.ink} style={{ marginTop: 3 }}>
                  {diagnostics.uploads.files} files · {(diagnostics.uploads.bytes / (1024 * 1024)).toFixed(2)} MB
                </Body>
              </View>
            </View>
          ) : null}
        </View>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <View style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <View>
              <Eyebrow>Developer mode & app settings</Eyebrow>
              <Display size={22} style={{ marginTop: 4 }}>Global controls</Display>
            </View>
            <Badge label={developerModeEnabled ? "developer mode on" : "developer mode off"} tone={developerModeEnabled ? "success" : "muted"} />
          </View>

          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Button title="Enable developer mode" small kind={developerModeEnabled ? "outline" : "primary"} onPress={() => void setDeveloperMode(true)} disabled={developerModeEnabled} icon="construct-outline" />
            <Button title="Disable developer mode" small kind="ghost" onPress={() => void setDeveloperMode(false)} disabled={!developerModeEnabled} icon="power-outline" />
          </View>

          <Field
            label="Promo banner title"
            value={developerSettings.promo_banner_title}
            onChangeText={(value) => setDeveloperSettings({ ...developerSettings, promo_banner_title: value })}
            placeholder="Announcement title"
          />
          <Field
            label="Promo banner message"
            value={developerSettings.promo_banner_message}
            onChangeText={(value) => setDeveloperSettings({ ...developerSettings, promo_banner_message: value })}
            placeholder="Announcement message"
            multiline
          />
          <Field
            label="Promo banner CTA"
            value={developerSettings.promo_banner_cta}
            onChangeText={(value) => setDeveloperSettings({ ...developerSettings, promo_banner_cta: value })}
            placeholder="Book now"
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip label="Banner enabled" selected={developerSettings.promo_banner_enabled === "true"} onPress={() => setDeveloperSettings({ ...developerSettings, promo_banner_enabled: "true" })} />
            <Chip label="Banner disabled" selected={developerSettings.promo_banner_enabled !== "true"} onPress={() => setDeveloperSettings({ ...developerSettings, promo_banner_enabled: "false" })} />
          </View>

          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Button title="Save global settings" small onPress={() => void saveDeveloperSettings()} loading={busy} disabled={!developerModeEnabled} icon="save-outline" />
            <Button title="Reload" small kind="outline" onPress={() => void loadDeveloperSettings()} icon="refresh-outline" />
          </View>
        </View>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <View style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <View>
              <Eyebrow>Access control</Eyebrow>
              <Display size={22} style={{ marginTop: 4 }}>Staff accounts</Display>
            </View>
            <Button title="Refresh users" small kind="outline" onPress={() => void loadUsers()} loading={usersLoading} icon="refresh-outline" />
          </View>

          <Field
            label="Search accounts"
            value={query}
            onChangeText={setQuery}
            placeholder="Name, email or role"
            icon="search-outline"
          />

          {usersLoading && users.length === 0 ? (
            <LoadingBlock label="Loading accounts…" />
          ) : filtered.length === 0 ? (
            <EmptyState icon="people-outline" title="No accounts" message="No staff accounts match this search." />
          ) : (
            <View style={{ gap: 10 }}>
              {filtered.map((account) => (
                <View key={account.id} style={{ borderWidth: 1, borderColor: t.border, borderRadius: 14, padding: 12, gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Body size={12} weight="700" color={t.ink}>{account.name}</Body>
                    <Badge label={account.role} tone={account.role === "developer" ? "primary" : account.role === "admin" ? "success" : "muted"} />
                    {!account.is_active ? <Badge label="inactive" tone="danger" /> : null}
                    {account.id === user?.id ? <Badge label="you" tone="outline" /> : null}
                  </View>
                  <Body size={10} color={t.muted}>{account.email} · joined {formatTimestamp(account.created_at)}</Body>
                  <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                    {ROLES.map((role) => (
                      <Chip key={role} label={role} selected={account.role === role} onPress={() => changeRole(account.id, role)} />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </Card>
    </View>
  );
}
