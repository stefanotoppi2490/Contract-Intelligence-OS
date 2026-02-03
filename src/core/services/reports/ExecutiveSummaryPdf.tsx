/**
 * STEP 9C: PDF report for Executive Summary. Uses @react-pdf/renderer. Board-ready, 1–2 pages.
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
import type { ExecutiveExportModel } from "./executiveSummaryReport";

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
  col1: { width: "25%" },
  col2: { width: "20%" },
  col3: { width: "20%" },
  col4: { width: "20%" },
  bullet: { marginLeft: 8, marginBottom: 2 },
  narrative: { marginTop: 8, padding: 8, backgroundColor: "#f8f8f8", fontSize: 9 },
  narrativeLabel: { fontSize: 8, color: "#666", marginBottom: 4 },
  footer: { marginTop: 24, fontSize: 8, color: "#666" },
});

type PdfDocProps = { model: ExecutiveExportModel };

function ExecutiveSummaryDocument({ model }: PdfDocProps) {
  const date = new Date(model.generatedAt).toISOString().slice(0, 10);

  return (
    <Document title={`Executive Summary: ${model.contractTitle}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Executive Risk Summary</Text>
        <Text style={styles.subtitle}>{model.contractTitle}</Text>
        <Text style={styles.subtitle}>
          {model.counterpartyName}
          {model.contractType ? ` · ${model.contractType}` : ""} · v{model.versionNumber}
        </Text>
        <Text style={styles.subtitle}>Policy: {model.policyName}</Text>
        {model.startDate || model.endDate ? (
          <Text style={styles.subtitle}>
            {model.startDate ?? "—"} – {model.endDate ?? "—"}
          </Text>
        ) : null}

        <Text style={styles.decision}>{model.decision}</Text>
        <Text style={styles.score}>
          Score: {model.effectiveScore}/100 (raw {model.rawScore})
        </Text>

        <Text style={styles.sectionTitle}>Risk clusters</Text>
        <View style={styles.rowHeader}>
          <Text style={styles.col1}>Risk type</Text>
          <Text style={styles.col2}>Level</Text>
          <Text style={styles.col3}>Violations</Text>
          <Text style={styles.col4}>Unclear</Text>
        </View>
        {model.clusters.map((c, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.col1}>{c.riskType}</Text>
            <Text style={styles.col2}>{c.level}</Text>
            <Text style={styles.col3}>{c.violations}</Text>
            <Text style={styles.col4}>{c.unclear}</Text>
          </View>
        ))}

        {model.keyRisks.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Key risks</Text>
            {model.keyRisks.map((k, i) => (
              <Text key={i} style={styles.bullet}>
                • {k}
              </Text>
            ))}
          </>
        ) : null}

        {model.exceptions.count > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Approved exceptions ({model.exceptions.count})</Text>
            {model.exceptions.items.map((e) => (
              <Text key={e.id} style={styles.bullet}>
                • {e.title}
              </Text>
            ))}
          </>
        ) : null}

        {model.narrative ? (
          <View style={styles.narrative}>
            <Text style={styles.narrativeLabel}>AI-generated narrative (from structured risk data)</Text>
            <Text>{model.narrative}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>
          Generated: {date} · {model.workspaceName} · {model.policyName}
        </Text>
      </Page>
    </Document>
  );
}

export async function buildExecutivePdfBuffer(model: ExecutiveExportModel): Promise<Uint8Array> {
  const element = React.createElement(ExecutiveSummaryDocument, { model });
  const buffer = await renderToBuffer(
    element as React.ReactElement<React.ComponentProps<typeof Document>>
  );
  return new Uint8Array(buffer);
}
