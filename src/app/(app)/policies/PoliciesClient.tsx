"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CLAUSE_TYPES = [
  "TERMINATION",
  "LIABILITY",
  "INTELLECTUAL_PROPERTY",
  "PAYMENT_TERMS",
  "DATA_PRIVACY",
  "CONFIDENTIALITY",
  "GOVERNING_LAW",
  "SLA",
  "SCOPE",
  "OTHER",
] as const;
const RULE_TYPES = ["REQUIRED", "FORBIDDEN", "MIN_VALUE", "MAX_VALUE", "ALLOWED_VALUES"] as const;
const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const RISK_TYPES = ["LEGAL", "FINANCIAL", "OPERATIONAL", "DATA", "SECURITY"] as const;

type PolicyRule = {
  id: string;
  clauseType: string;
  ruleType: string;
  expectedValue: unknown;
  severity: string | null;
  riskType: string | null;
  weight: number;
  recommendation: string;
};

type Policy = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  rules: PolicyRule[];
};

const emptyRuleForm = () => ({
  clauseType: "TERMINATION",
  ruleType: "REQUIRED",
  expectedValue: "",
  severity: "MEDIUM",
  riskType: "LEGAL",
  weight: 1,
  recommendation: "",
});

export function PoliciesClient({
  policies,
  canManage,
}: {
  policies: Policy[];
  canManage: boolean;
}) {
  const [policyName, setPolicyName] = useState("");
  const [policyDescription, setPolicyDescription] = useState("");
  const [seedDefaults, setSeedDefaults] = useState(true);
  const [creatingPolicy, setCreatingPolicy] = useState(false);
  const [addingRulePolicyId, setAddingRulePolicyId] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState(emptyRuleForm());
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyRuleForm());
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleCreatePolicy(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage || !policyName.trim()) return;
    setError(null);
    setCreatingPolicy(true);
    try {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: policyName.trim(),
          description: policyDescription.trim() || undefined,
          seedDefaults,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create policy");
        return;
      }
      setPolicyName("");
      setPolicyDescription("");
      setSeedDefaults(true);
      router.refresh();
    } catch {
      setError("Failed to create policy");
    } finally {
      setCreatingPolicy(false);
    }
  }

  async function handleAddRule(policyId: string) {
    if (!canManage) return;
    setError(null);
    try {
      const res = await fetch(`/api/policies/${policyId}/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clauseType: ruleForm.clauseType,
          ruleType: ruleForm.ruleType,
          expectedValue: ruleForm.expectedValue || null,
          severity: ruleForm.severity,
          riskType: ruleForm.riskType,
          weight: Number(ruleForm.weight) || 1,
          recommendation: ruleForm.recommendation.trim() || "Clause required.",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add rule");
        return;
      }
      setAddingRulePolicyId(null);
      setRuleForm(emptyRuleForm());
      router.refresh();
    } catch {
      setError("Failed to add rule");
    }
  }

  async function handleUpdateRule(policyId: string, ruleId: string) {
    if (!canManage) return;
    setError(null);
    try {
      const res = await fetch(`/api/policies/${policyId}/rules/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clauseType: editForm.clauseType,
          ruleType: editForm.ruleType,
          expectedValue: editForm.expectedValue || null,
          severity: editForm.severity,
          riskType: editForm.riskType,
          weight: Number(editForm.weight) || 1,
          recommendation: editForm.recommendation.trim() || "Clause required.",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to update rule");
        return;
      }
      setEditingRuleId(null);
      router.refresh();
    } catch {
      setError("Failed to update rule");
    }
  }

  async function handleDeleteRule(policyId: string, ruleId: string) {
    if (!canManage) return;
    if (!confirm("Remove this rule?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/policies/${policyId}/rules/${ruleId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to delete rule");
        return;
      }
      router.refresh();
    } catch {
      setError("Failed to delete rule");
    }
  }

  function formatExpected(v: unknown): string {
    if (v == null) return "—";
    if (typeof v === "string") return v;
    if (typeof v === "number") return String(v);
    return JSON.stringify(v);
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {!canManage && (
        <div className="rounded-md border border-amber-500/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          Ask an admin to manage policies.
        </div>
      )}

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Create policy</CardTitle>
            <p className="text-sm text-muted-foreground">
              Optionally seed with 7 default rules (Liability, Data Privacy, Governing Law, IP, Termination, Confidentiality, Payment Terms).
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreatePolicy} className="space-y-4">
              <div>
                <Label htmlFor="policy-name">Name</Label>
                <Input
                  id="policy-name"
                  className="mt-1 max-w-md"
                  value={policyName}
                  onChange={(e) => setPolicyName(e.target.value)}
                  placeholder="e.g. Company Standard"
                  disabled={creatingPolicy}
                />
              </div>
              <div>
                <Label htmlFor="policy-desc">Description (optional)</Label>
                <Input
                  id="policy-desc"
                  className="mt-1 max-w-md"
                  value={policyDescription}
                  onChange={(e) => setPolicyDescription(e.target.value)}
                  placeholder="Short description"
                  disabled={creatingPolicy}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="seed-defaults"
                  checked={seedDefaults}
                  onChange={(e) => setSeedDefaults(e.target.checked)}
                  disabled={creatingPolicy}
                />
                <Label htmlFor="seed-defaults">Seed default rules</Label>
              </div>
              <Button type="submit" disabled={creatingPolicy || !policyName.trim()}>
                {creatingPolicy ? "Creating…" : "Create policy"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {policies.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              No policies yet. {canManage ? "Create one above." : "Ask an admin to create a policy."}
            </p>
          </CardContent>
        </Card>
      ) : (
        policies.map((policy) => (
          <Card key={policy.id}>
            <CardHeader>
              <CardTitle>{policy.name}</CardTitle>
              {policy.description && (
                <p className="text-sm text-muted-foreground">{policy.description}</p>
              )}
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Clause Type</th>
                    <th className="text-left p-2">Rule Type</th>
                    <th className="text-left p-2">Expected Value</th>
                    <th className="text-left p-2">Severity</th>
                    <th className="text-left p-2">Risk</th>
                    <th className="text-left p-2">Weight</th>
                    <th className="text-left p-2">Recommendation</th>
                    {canManage && <th className="text-left p-2">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {policy.rules.map((rule) =>
                    editingRuleId === rule.id ? (
                      <tr key={rule.id} className="border-b">
                        <td className="p-2">
                          <select
                            className="w-full rounded border bg-background text-sm"
                            value={editForm.clauseType}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, clauseType: e.target.value }))
                            }
                          >
                            {CLAUSE_TYPES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <select
                            className="w-full rounded border bg-background text-sm"
                            value={editForm.ruleType}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, ruleType: e.target.value }))
                            }
                          >
                            {RULE_TYPES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <Input
                            className="min-w-[80px]"
                            value={
                              typeof editForm.expectedValue === "string"
                                ? editForm.expectedValue
                                : ""
                            }
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, expectedValue: e.target.value }))
                            }
                            placeholder="—"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            className="rounded border bg-background text-sm"
                            value={editForm.severity}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, severity: e.target.value }))
                            }
                          >
                            {SEVERITIES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <select
                            className="rounded border bg-background text-sm"
                            value={editForm.riskType}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, riskType: e.target.value }))
                            }
                          >
                            {RISK_TYPES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            className="w-16"
                            min={0}
                            max={100}
                            value={editForm.weight}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, weight: Number(e.target.value) || 0 }))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            className="min-w-[120px]"
                            value={editForm.recommendation}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, recommendation: e.target.value }))
                            }
                            placeholder="Recommendation"
                          />
                        </td>
                        <td className="p-2 flex gap-1">
                          <Button
                            size="sm"
                            onClick={() => handleUpdateRule(policy.id, rule.id)}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingRuleId(null)}
                          >
                            Cancel
                          </Button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={rule.id} className="border-b">
                        <td className="p-2 font-mono text-xs">{rule.clauseType}</td>
                        <td className="p-2">{rule.ruleType}</td>
                        <td className="p-2 text-muted-foreground max-w-[120px] truncate">
                          {formatExpected(rule.expectedValue)}
                        </td>
                        <td className="p-2">{rule.severity ?? "—"}</td>
                        <td className="p-2">{rule.riskType ?? "—"}</td>
                        <td className="p-2">{rule.weight}</td>
                        <td className="p-2 max-w-[200px] truncate" title={rule.recommendation}>
                          {rule.recommendation}
                        </td>
                        {canManage && (
                          <td className="p-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingRuleId(rule.id);
                                setEditForm({
                                  clauseType: rule.clauseType,
                                  ruleType: rule.ruleType,
                                  expectedValue:
                                    typeof rule.expectedValue === "string"
                                      ? rule.expectedValue
                                      : rule.expectedValue != null
                                        ? JSON.stringify(rule.expectedValue)
                                        : "",
                                  severity: rule.severity ?? "MEDIUM",
                                  riskType: rule.riskType ?? "LEGAL",
                                  weight: rule.weight,
                                  recommendation: rule.recommendation,
                                });
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => handleDeleteRule(policy.id, rule.id)}
                            >
                              Delete
                            </Button>
                          </td>
                        )}
                      </tr>
                    )
                  )}
                  {addingRulePolicyId === policy.id && (
                    <tr className="border-b bg-muted/20">
                      <td className="p-2">
                        <select
                          className="w-full rounded border bg-background text-sm"
                          value={ruleForm.clauseType}
                          onChange={(e) =>
                            setRuleForm((f) => ({ ...f, clauseType: e.target.value }))
                          }
                        >
                          {CLAUSE_TYPES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <select
                          className="w-full rounded border bg-background text-sm"
                          value={ruleForm.ruleType}
                          onChange={(e) =>
                            setRuleForm((f) => ({ ...f, ruleType: e.target.value }))
                          }
                        >
                          {RULE_TYPES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <Input
                          className="min-w-[80px]"
                          value={
                            typeof ruleForm.expectedValue === "string"
                              ? ruleForm.expectedValue
                              : ""
                          }
                          onChange={(e) =>
                            setRuleForm((f) => ({ ...f, expectedValue: e.target.value }))
                          }
                          placeholder="—"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          className="rounded border bg-background text-sm"
                          value={ruleForm.severity}
                          onChange={(e) =>
                            setRuleForm((f) => ({ ...f, severity: e.target.value }))
                          }
                        >
                          {SEVERITIES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <select
                          className="rounded border bg-background text-sm"
                          value={ruleForm.riskType}
                          onChange={(e) =>
                            setRuleForm((f) => ({ ...f, riskType: e.target.value }))
                          }
                        >
                          {RISK_TYPES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          className="w-16"
                          min={0}
                          max={100}
                          value={ruleForm.weight}
                          onChange={(e) =>
                            setRuleForm((f) => ({
                              ...f,
                              weight: Number(e.target.value) || 0,
                            }))
                          }
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          className="min-w-[120px]"
                          value={ruleForm.recommendation}
                          onChange={(e) =>
                            setRuleForm((f) => ({ ...f, recommendation: e.target.value }))
                          }
                          placeholder="Recommendation (required)"
                        />
                      </td>
                      <td className="p-2">
                        <Button
                          size="sm"
                          onClick={() => handleAddRule(policy.id)}
                          disabled={!ruleForm.recommendation.trim()}
                        >
                          Add
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setAddingRulePolicyId(null);
                            setRuleForm(emptyRuleForm());
                          }}
                        >
                          Cancel
                        </Button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {canManage && addingRulePolicyId !== policy.id && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => setAddingRulePolicyId(policy.id)}
                >
                  Add rule
                </Button>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                <Link href="/contracts">Use in contract</Link>
              </p>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
