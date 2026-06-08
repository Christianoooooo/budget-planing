"use client";

import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, GERMAN_MONTHS } from "@/lib/constants";
import {
  TrendingUp, TrendingDown, CheckCircle2, XCircle,
  AlertTriangle, Save, Euro, ChevronDown, ChevronUp,
} from "lucide-react";

interface Category {
  slug: string;
  name: string;
  icon: string;
  color: string;
  budget: number;
}

interface Transaction {
  _id: string;
  amount: number;
  type: "income" | "expense" | "fixed";
  category: string;
}

interface CategoryPlan { slug: string; planned: number }

interface MonthPlan {
  plannedIncome: number;
  categoryPlans: CategoryPlan[];
}

interface Props { year: number; month: number }

// ── helpers ──────────────────────────────────────────────────────────────────
function parseNum(v: string): number {
  const n = parseFloat(v.replace(",", "."));
  return isNaN(n) || n < 0 ? 0 : n;
}

function StatusBanner({ balance, planned }: { balance: number; planned: number }) {
  if (planned === 0) return null;
  const ok = balance >= 0;
  const tight = balance >= 0 && balance < planned * 0.1;

  if (ok && !tight) return (
    <div className="flex items-center gap-3 rounded-xl bg-green-500/10 border border-green-500/30 p-4">
      <CheckCircle2 className="h-8 w-8 text-green-500 shrink-0" />
      <div>
        <p className="font-semibold text-green-500">Ja, das Geld reicht! 🎉</p>
        <p className="text-sm text-muted-foreground">
          Du hast noch <strong className="text-green-500">{formatCurrency(balance)}</strong> übrig — gut budgetiert.
        </p>
      </div>
    </div>
  );

  if (tight) return (
    <div className="flex items-center gap-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-4">
      <AlertTriangle className="h-8 w-8 text-yellow-500 shrink-0" />
      <div>
        <p className="font-semibold text-yellow-500">Knapp, aber es reicht noch.</p>
        <p className="text-sm text-muted-foreground">
          Nur noch <strong className="text-yellow-500">{formatCurrency(balance)}</strong> Puffer — wenig Spielraum.
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/30 p-4">
      <XCircle className="h-8 w-8 text-red-500 shrink-0" />
      <div>
        <p className="font-semibold text-red-500">Nein, das Geld reicht nicht! ⚠️</p>
        <p className="text-sm text-muted-foreground">
          Es fehlen <strong className="text-red-500">{formatCurrency(Math.abs(balance))}</strong> — bitte Ausgaben reduzieren oder Einnahmen erhöhen.
        </p>
      </div>
    </div>
  );
}

export default function PlannerClient({ year, month }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [plannedIncome, setPlannedIncome] = useState("0");
  const [categoryPlans, setCategoryPlans] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showActual, setShowActual] = useState(true);

  // ── fetch ─────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, txRes, planRes] = await Promise.all([
        fetch("/api/categories"),
        fetch(`/api/transactions?year=${year}&month=${month}`),
        fetch(`/api/plans?year=${year}&month=${month}`),
      ]);
      const [cats, txs, plan]: [Category[], Transaction[], MonthPlan] = await Promise.all([
        catRes.json(), txRes.json(), planRes.json(),
      ]);

      setCategories(cats);
      setTransactions(txs);
      setPlannedIncome(String(plan.plannedIncome || 0));

      // Merge saved plans with category budget defaults
      const planMap: Record<string, string> = {};
      cats.forEach((c) => {
        const saved = plan.categoryPlans.find((p) => p.slug === c.slug);
        planMap[c.slug] = String(saved ? saved.planned : c.budget || 0);
      });
      setCategoryPlans(planMap);
    } catch {
      toast.error("Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── calculations ──────────────────────────────────────────────────────────
  const income = parseNum(plannedIncome);
  const totalPlanned = Object.values(categoryPlans).reduce((s, v) => s + parseNum(v), 0);
  const balance = income - totalPlanned;

  // actual this month
  const actualIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const actualBySlug: Record<string, number> = {};
  transactions.filter(t => t.type !== "income").forEach(t => {
    actualBySlug[t.category] = (actualBySlug[t.category] || 0) + t.amount;
  });
  const actualTotal = Object.values(actualBySlug).reduce((s, v) => s + v, 0);

  // sort categories: highest planned first, then rest
  const sortedCats = [...categories].sort(
    (a, b) => parseNum(categoryPlans[b.slug] || "0") - parseNum(categoryPlans[a.slug] || "0")
  );

  // ── save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year, month,
          plannedIncome: parseNum(plannedIncome),
          categoryPlans: categories.map(c => ({ slug: c.slug, planned: parseNum(categoryPlans[c.slug] || "0") })),
        }),
      });
      if (res.ok) toast.success("Plan gespeichert");
      else toast.error("Speichern fehlgeschlagen");
    } catch { toast.error("Netzwerkfehler"); }
    finally { setSaving(false); }
  }

  // ── copy budget limits into plan ──────────────────────────────────────────
  function fillFromBudgets() {
    const filled: Record<string, string> = {};
    categories.forEach(c => { filled[c.slug] = String(c.budget || 0); });
    setCategoryPlans(filled);
    toast.info("Budgetlimits übernommen");
  }

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Planst du für <strong>{GERMAN_MONTHS[month - 1]} {year}</strong>
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fillFromBudgets}>
            Budgetlimits übernehmen
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
            <Save className="h-3.5 w-3.5" />
            {saving ? "Speichert…" : "Plan speichern"}
          </Button>
        </div>
      </div>

      {/* ── Status banner ─────────────────────────────────────────────────── */}
      <StatusBanner balance={balance} planned={totalPlanned} />

      {/* ── Income ────────────────────────────────────────────────────────── */}
      <Card className="border-green-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            Erwartete Einnahmen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Euro className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              type="number"
              min="0"
              step="50"
              value={plannedIncome}
              onChange={e => setPlannedIncome(e.target.value)}
              className="text-xl font-bold h-12 text-green-500"
              placeholder="0"
            />
          </div>
          {actualIncome > 0 && (
            <p className="text-xs text-muted-foreground">
              Tatsächlich bisher eingegangen:
              <strong className="text-green-500 ml-1">{formatCurrency(actualIncome)}</strong>
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Expenses ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
            Geplante Ausgaben
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedCats.map(cat => {
            const planned = parseNum(categoryPlans[cat.slug] || "0");
            const actual  = actualBySlug[cat.slug] || 0;
            const pct     = planned > 0 ? Math.min(100, (actual / planned) * 100) : 0;
            const over    = actual > planned && planned > 0;

            return (
              <div key={cat.slug} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-lg w-7 text-center">{cat.icon}</span>
                  <span className="flex-1 text-sm font-medium">{cat.name}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">€</span>
                    <Input
                      type="number"
                      min="0"
                      step="10"
                      value={categoryPlans[cat.slug] ?? "0"}
                      onChange={e => setCategoryPlans(p => ({ ...p, [cat.slug]: e.target.value }))}
                      className="w-28 h-8 text-right text-sm"
                    />
                  </div>
                </div>

                {showActual && (planned > 0 || actual > 0) && (
                  <div className="pl-9 space-y-1">
                    <Progress
                      value={pct}
                      className={`h-1.5 ${over ? "[&>div]:bg-red-500" : pct > 80 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-green-500"}`}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Ist: <span className={over ? "text-red-500 font-medium" : ""}>{formatCurrency(actual)}</span></span>
                      {over && <span className="text-red-500">+{formatCurrency(actual - planned)} über Plan</span>}
                      {!over && planned > 0 && <span>noch {formatCurrency(planned - actual)} frei</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── Running total ─────────────────────────────────────────────────── */}
      <Card className={balance >= 0 ? "border-green-500/30" : "border-red-500/30"}>
        <CardContent className="pt-4 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm">Geplante Einnahmen</span>
            <span className="font-semibold text-green-500">{formatCurrency(income)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Geplante Ausgaben gesamt</span>
            <span className="font-semibold text-red-500">{formatCurrency(totalPlanned)}</span>
          </div>
          <Separator />
          <div className="flex justify-between items-center">
            <span className="font-semibold">Verbleibend</span>
            <span className={`text-xl font-bold ${balance >= 0 ? "text-green-500" : "text-red-500"}`}>
              {balance >= 0 ? "+" : ""}{formatCurrency(balance)}
            </span>
          </div>

          {/* Actual comparison */}
          {(actualIncome > 0 || actualTotal > 0) && (
            <>
              <Separator />
              <button
                className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowActual(v => !v)}
              >
                <span>Tatsächliche Werte diesen Monat</span>
                {showActual ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {showActual && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ist-Einnahmen</span>
                    <span className="text-green-500">{formatCurrency(actualIncome)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ist-Ausgaben</span>
                    <span className="text-red-500">{formatCurrency(actualTotal)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="text-muted-foreground">Ist-Bilanz</span>
                    <span className={actualIncome - actualTotal >= 0 ? "text-green-500" : "text-red-500"}>
                      {formatCurrency(actualIncome - actualTotal)}
                    </span>
                  </div>

                  {/* Plan vs Ist progress */}
                  {income > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Ausgaben: {formatCurrency(actualTotal)} von {formatCurrency(totalPlanned)} geplant</span>
                        <span>{totalPlanned > 0 ? ((actualTotal / totalPlanned) * 100).toFixed(0) : 0} %</span>
                      </div>
                      <Progress
                        value={totalPlanned > 0 ? Math.min(100, (actualTotal / totalPlanned) * 100) : 0}
                        className={`h-2 ${actualTotal > totalPlanned ? "[&>div]:bg-red-500" : "[&>div]:bg-blue-500"}`}
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Tips ─────────────────────────────────────────────────────────── */}
      {balance < 0 && totalPlanned > 0 && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-500">💡 Sparvorschläge</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {sortedCats
                .filter(c => parseNum(categoryPlans[c.slug] || "0") > 0 && c.slug !== "housing" && c.slug !== "insurance")
                .slice(0, 3)
                .map(c => {
                  const planned = parseNum(categoryPlans[c.slug] || "0");
                  const reduction = Math.min(planned * 0.2, Math.abs(balance));
                  return (
                    <li key={c.slug} className="flex justify-between">
                      <span>{c.icon} {c.name} um 20 % kürzen</span>
                      <span className="text-green-500 font-medium">spart {formatCurrency(reduction)}</span>
                    </li>
                  );
                })}
              <li className="pt-1 text-xs">
                Gesamt zu kürzen: <strong className="text-red-500">{formatCurrency(Math.abs(balance))}</strong>
              </li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
