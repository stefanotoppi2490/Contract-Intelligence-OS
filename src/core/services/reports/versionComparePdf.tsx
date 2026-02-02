/**
 * PDF report for version compare. Uses @react-pdf/renderer. Content matches HTML report structure.
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
import type { VersionCompareResult } from "@/core/services/compare/versionCompare";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10 },
  title: { fontSize: 16, marginBottom: 12 },
  subtitle: { marginBottom: 4 },
  sectionTitle: { fontSize: 12, marginTop: 16, marginBottom: 8 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e0e0e0", paddingVertical: 4 },
  rowHeader: { flexDirection: "row", backgroundColor: "#f0f0f0", paddingVertical: 6, paddingHorizontal: 4, marginBottom: 2 },
  col1: { width: "25%" },
  col2: { width: "25%" },
  col3: { width: "25%" },
  col4: { width: "25%" },
  col5: { width: "20%" },
  deltaBadge: { marginLeft: 6, paddingHorizontal: 4, paddingVertical: 2 },
  footer: { marginTop: 24, fontSize: 8, color: "#666" },
});

function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string" || typeof v === "number") return String(v);
  return JSON.stringify(v);
}

type PdfDocProps = {
  result: VersionCompareResult;
  contractTitle: string;
  policyName: string;
  workspaceName?: string;
};

function CompareReportDocument({
  result,
  contractTitle,
  policyName,
  workspaceName = "",
}: PdfDocProps) {
  const { from, to, delta, changes, topDrivers } = result;
  const changedItems = changes.filter((c) => c.changeType !== "UNCHANGED");
  const date = new Date().toISOString().slice(0, 10);

  return (
    <Document title={`Version Compare: ${contractTitle}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Version Compare Report</Text>
        <Text style={styles.subtitle}>Contract: {contractTitle}</Text>
        <Text style={styles.subtitle}>Policy: {policyName}</Text>
        {workspaceName ? (
          <Text style={styles.subtitle}>Workspace: {workspaceName}</Text>
        ) : null}
        <Text style={styles.subtitle}>Date: {date}</Text>

        <Text style={styles.sectionTitle}>Score Summary</Text>
        <View style={styles.rowHeader}>
          <Text style={styles.col1}>Version</Text>
          <Text style={styles.col2}>Raw Score</Text>
          <Text style={styles.col3}>Effective Score</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.col1}>v{from.versionNumber}</Text>
          <Text style={styles.col2}>{from.rawScore}</Text>
          <Text style={styles.col3}>{from.effectiveScore}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.col1}>v{to.versionNumber}</Text>
          <Text style={styles.col2}>{to.rawScore}</Text>
          <Text style={styles.col3}>{to.effectiveScore}</Text>
        </View>
        <Text style={[styles.subtitle, { marginTop: 8 }]}>
          Delta: {delta.raw} (raw), {delta.effective} (effective) — {delta.label}
        </Text>

        {topDrivers.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Top Drivers</Text>
            <View style={styles.rowHeader}>
              <Text style={styles.col1}>Clause Type</Text>
              <Text style={styles.col2}>Key</Text>
              <Text style={styles.col3}>Delta Impact</Text>
              <Text style={styles.col4}>Reason</Text>
            </View>
            {topDrivers.map((d, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.col1}>{d.clauseType}</Text>
                <Text style={styles.col2}>{d.key}</Text>
                <Text style={styles.col3}>{d.deltaImpact}</Text>
                <Text style={styles.col4}>{d.reason}</Text>
              </View>
            ))}
          </>
        ) : null}

        <Text style={styles.sectionTitle}>
          Changes {changedItems.length > 0 ? `(${changedItems.length})` : ""}
        </Text>
        {changedItems.length > 0 ? (
          <>
            <View style={styles.rowHeader}>
              <Text style={styles.col1}>Clause</Text>
              <Text style={styles.col2}>Type</Text>
              <Text style={styles.col3}>From (v{from.versionNumber})</Text>
              <Text style={styles.col4}>To (v{to.versionNumber})</Text>
              <Text style={styles.col5}>Why</Text>
            </View>
            {changedItems.map((c, i) => {
              const fromStatus = c.from
                ? `${c.from.status}${c.from.overridden ? " (overridden)" : ""}`
                : "—";
              const toStatus = c.to
                ? `${c.to.status}${c.to.overridden ? " (overridden)" : ""}`
                : "—";
              const fromVal =
                c.from?.foundValue != null
                  ? formatValue(c.from.foundValue).slice(0, 40)
                  : "—";
              const toVal =
                c.to?.foundValue != null
                  ? formatValue(c.to.foundValue).slice(0, 40)
                  : "—";
              return (
                <View key={i} style={styles.row}>
                  <Text style={styles.col1}>{c.clauseType}</Text>
                  <Text style={styles.col2}>{c.changeType}</Text>
                  <Text style={styles.col3}>{fromStatus} / {fromVal}</Text>
                  <Text style={styles.col4}>{toStatus} / {toVal}</Text>
                  <Text style={styles.col5}>{c.why ?? "—"}</Text>
                </View>
              );
            })}
          </>
        ) : (
          <Text style={styles.subtitle}>No changes between versions for this policy.</Text>
        )}

        <Text style={styles.footer}>
          Generated by Contract Intelligence OS
          {workspaceName ? ` · ${workspaceName}` : ""}
        </Text>
      </Page>
    </Document>
  );
}

export type BuildComparePdfOptions = {
  contractTitle: string;
  policyName: string;
  workspaceName?: string;
};

/**
 * Build version compare report as PDF. Returns binary PDF as Uint8Array.
 */
export async function buildComparePdf(
  result: VersionCompareResult,
  options: BuildComparePdfOptions
): Promise<Uint8Array> {
  const element = React.createElement(CompareReportDocument, {
    result,
    contractTitle: options.contractTitle,
    policyName: options.policyName,
    workspaceName: options.workspaceName,
  });
  const buffer = await renderToBuffer(
    element as React.ReactElement<React.ComponentProps<typeof Document>>
  );
  return new Uint8Array(buffer);
}
