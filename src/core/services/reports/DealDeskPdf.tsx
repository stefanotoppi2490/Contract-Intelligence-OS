/**
 * STEP 11: Deal Desk PDF report. @react-pdf/renderer. Management-ready.
 */

import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { DealDeskReportPayload } from "./dealDeskReport";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10 },
  title: { fontSize: 16, marginBottom: 4 },
  subtitle: { fontSize: 9, marginBottom: 2, color: "#444" },
  sectionTitle: { fontSize: 12, marginTop: 14, marginBottom: 6, fontWeight: "bold" },
  decision: { fontSize: 12, marginTop: 8, marginBottom: 4, fontWeight: "bold" },
  score: { marginBottom: 8 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e0e0e0", paddingVertical: 4 },
  rowHeader: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  col1: { width: "40%" },
  col2: { width: "30%" },
  col3: { width: "30%" },
  bullet: { marginLeft: 8, marginBottom: 2 },
  narrative: { marginTop: 8, padding: 8, backgroundColor: "#f8f8f8", fontSize: 9 },
  narrativeLabel: { fontSize: 8, color: "#666", marginBottom: 4 },
  footer: { marginTop: 24, fontSize: 8, color: "#666" },
});

function DealDeskDocument({ payload }: { payload: DealDeskReportPayload }) {
  const date = new Date(payload.generatedAt).toISOString().slice(0, 19).replace("T", " ");

  return (
    <Document title={`Deal Desk: ${payload.contractTitle}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Deal Desk Report</Text>
        <Text style={styles.subtitle}>{payload.contractTitle}</Text>
        <Text style={styles.subtitle}>
          {payload.counterpartyName} · v{payload.versionNumber} · {payload.policyName}
        </Text>
        <Text style={styles.decision}>Decision: {payload.outcome}</Text>
        <Text style={styles.subtitle}>
          Status: {payload.status}
          {payload.finalizedAt ? ` · Finalized: ${payload.finalizedAt.slice(0, 10)}` : ""}
        </Text>
        <Text style={styles.score}>
          Score: {payload.effectiveScore}/100 (raw {payload.rawScore})
        </Text>
        <Text style={styles.sectionTitle}>Counts</Text>
        <Text style={styles.subtitle}>
          Violations: {payload.counts.violations} · Critical: {payload.counts.criticalViolations} · Unclear:{" "}
          {payload.counts.unclear} · Overridden: {payload.counts.overridden} · Open: {payload.counts.openExceptions} ·
          Approved: {payload.counts.approvedExceptions}
        </Text>
        <Text style={styles.sectionTitle}>Rationale</Text>
        <Text style={styles.subtitle}>{payload.rationale}</Text>
        {payload.riskByType.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Risk by type</Text>
            <View style={styles.rowHeader}>
              <Text style={styles.col1}>Risk type</Text>
              <Text style={styles.col2}>Violations</Text>
              <Text style={styles.col3}>Unclear</Text>
            </View>
            {payload.riskByType.map((r, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.col1}>{r.riskType}</Text>
                <Text style={styles.col2}>{r.violations}</Text>
                <Text style={styles.col3}>{r.unclear}</Text>
              </View>
            ))}
          </>
        ) : null}
        {payload.topDrivers.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Key risks</Text>
            {payload.topDrivers.map((d, i) => (
              <Text key={i} style={styles.bullet}>
                • {d.clauseType} ({d.riskType ?? "—"}): {d.recommendation ?? "—"}
              </Text>
            ))}
          </>
        ) : null}
        {payload.approvedExceptions.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Approved exceptions</Text>
            {payload.approvedExceptions.map((e) => (
              <Text key={e.id} style={styles.bullet}>
                • {e.title}
              </Text>
            ))}
          </>
        ) : null}
        {payload.openExceptions.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Open exception requests</Text>
            {payload.openExceptions.map((e) => (
              <Text key={e.id} style={styles.bullet}>
                • {e.title}
              </Text>
            ))}
          </>
        ) : null}
        {payload.narrative ? (
          <View style={styles.narrative}>
            <Text style={styles.narrativeLabel}>Executive narrative (AI-generated from structured data)</Text>
            <Text>{payload.narrative}</Text>
          </View>
        ) : null}
        <Text style={styles.footer}>
          Generated: {date} · {payload.workspaceName}
        </Text>
      </Page>
    </Document>
  );
}

export async function buildDealDeskPdfBuffer(payload: DealDeskReportPayload): Promise<Uint8Array> {
  const element = React.createElement(DealDeskDocument, { payload });
  const buffer = await renderToBuffer(
    element as React.ReactElement<React.ComponentProps<typeof Document>>
  );
  return new Uint8Array(buffer);
}
