import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { useNaturals } from "../../context";
import { Badge, Body, Button, Card, Display, EmptyState, Eyebrow, Field, LoadingBlock } from "../../ui";

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AuditScreen() {
  const { t, bp, auditLogs, auditLogsLoading, loadAuditLogs } = useNaturals();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return auditLogs;
    return auditLogs.filter((log) =>
      `${log.actor_name ?? ""} ${log.actor_email ?? ""} ${log.actor_role ?? ""} ${log.action} ${log.entity} ${log.entity_id} ${log.detail ?? ""}`
        .toLowerCase()
        .includes(text),
    );
  }, [auditLogs, query]);

  return (
    <View style={{ paddingTop: 24 }}>
      <Eyebrow>Server-side accountability</Eyebrow>
      <Display size={bp.isMobile ? 30 : 40} style={{ marginTop: 4 }}>
        Audit log
      </Display>
      <Body size={12.5} color={t.muted} style={{ marginTop: 8 }}>
        Every privileged action is recorded with the actor, action, entity and timestamp.
      </Body>

      <View style={{ marginTop: 18, flexDirection: bp.isDesktop ? "row" : "column", gap: 12, alignItems: bp.isDesktop ? "center" : "stretch" }}>
        <Field
          label="Search audit entries"
          value={query}
          onChangeText={setQuery}
          placeholder="Actor, action, entity or detail"
          icon="search-outline"
          style={{ flex: 1, marginBottom: 0 }}
        />
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Button title="Refresh" small kind="outline" onPress={() => void loadAuditLogs()} icon="refresh-outline" />
          <Body size={11} color={t.muted}>{filtered.length} entries</Body>
        </View>
      </View>

      <View style={{ marginTop: 14 }}>
        {auditLogsLoading && auditLogs.length === 0 ? (
          <LoadingBlock label="Loading audit log…" />
        ) : filtered.length === 0 ? (
          <EmptyState icon="document-outline" title="No audit entries" message="Privileged actions will appear here as soon as they happen." />
        ) : (
          <View style={{ gap: 8 }}>
            {filtered.map((log) => (
              <Card key={log.id} padded={false}>
                <View style={{ padding: 14, flexDirection: bp.isMobile ? "column" : "row", gap: 10, alignItems: bp.isMobile ? "stretch" : "center" }}>
                  <View style={{ flex: 1.4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Body size={12} weight="700" color={t.ink}>{log.actor_name ?? `User #${log.actor_id}`}</Body>
                      {log.actor_role ? <Badge label={log.actor_role} tone={log.actor_role === "developer" ? "primary" : "muted"} /> : null}
                    </View>
                    <Body size={10} color={t.muted}>{log.actor_email ?? "no email recorded"}</Body>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Badge label={log.action} tone="primary" />
                      <Body size={11} weight="600" color={t.ink}>{log.entity}</Body>
                      <Body size={10} color={t.muted}>#{log.entity_id}</Body>
                    </View>
                    {log.detail ? <Body size={10} color={t.muted} numberOfLines={2} style={{ marginTop: 3 }}>{log.detail}</Body> : null}
                  </View>
                  <View style={{ flex: bp.isMobile ? undefined : 0.8, alignItems: bp.isMobile ? "flex-start" : "flex-end" }}>
                    <Body size={10} color={t.muted}>{formatTimestamp(log.created_at)}</Body>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
