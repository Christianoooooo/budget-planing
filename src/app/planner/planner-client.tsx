"use client";

import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, GERMAN_MONTHS } from "@/lib/constants";
import { Save, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface Category {
  slug: string;
  name: string;
  icon: string;
  budget: number;
}

interface CategoryPlan { slug: string; planned: number }
interface MonthPlan { plannedIncome: number; categoryPlans: CategoryPlan[] }
interface Props { year: number; month: number }

function num(v: string): number {
  const n = parseFloat(v.replace(",", "."));
  return isNaN(n) || n < 0 ? 0 : n;
}

export default function PlannerClient({ year, month }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [income, setIncome] = useState("0");
  const [plans, setPlans] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, planRes] = await Promise.all([
        fetch("/api/categories"),
        fetch(`/api/plans?year=${year}&month=${month}`),
      ]);
      const [cats, plan]: [Category[], MonthPlan] = await Promise.all([
        catRes.json(), planRes.json(),
      ]);
      setCategories(cats);
      setIncome(String(plan.plannedIncome || 0));
      const m: Record<string, string> = {};
      cats.forEach(c => {
        const saved = plan.categoryPlans.find(p => p.slug === c.slug);
        m[c.slug] = String(saved ? saved.planned : c.budget || 0);
      });
      setPlans(m);
    } catch { toast.error("Fehler beim Laden"); }
    finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const totalExpenses = Object.values(plans).reduce((s, v) => s + num(v), 0);
  const balance = num(income) - totalExpenses;

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year, month,
          plannedIncome: num(income),
          categoryPlans: categories.map(c => ({ slug: c.slug, planned: num(plans[c.slug] || "0") })),
        }),
      });
      if (res.ok) toast.success("Gespeichert");
      else toast.error("Fehler beim Speichern");
    } catch { toast.error("Netzwerkfehler"); }
    finally { setSaving(false); }
  }

  if (loading) return <Skeleton className="h-96 rounded-xl" />;

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{GERMAN_MONTHS[month - 1]} {year}</p>
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
          <Save className="h-3.5 w-3.5" />
          {saving ? "…" : "Speichern"}
        </Button>
      </div>

      {/* Ergebnis */}
      {totalExpenses > 0 && (
        <div className={`flex items-center gap-3 rounded-lg p-4 ${
          balance > 0
            ? "bg-green-500/10 border border-green-500/30"
            : balance === 0
              ? "bg-yellow-500/10 border border-yellow-500/30"
              : "bg-red-500/10 border border-red-500/30"
        }`}>
          {balance > 0 && <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />}
          {balance === 0 && <AlertTriangle className="h-6 w-6 text-yellow-500 shrink-0" />}
          {balance < 0 && <XCircle className="h-6 w-6 text-red-500 shrink-0" />}
          <p className="text-sm">
            {balance > 0 && <><strong className="text-green-500">Reicht.</strong> {formatCurrency(balance)} übrig.</>}
            {balance === 0 && <><strong className="text-yellow-500">Geht genau auf.</strong> Kein Puffer.</>}
            {balance < 0 && <><strong className="text-red-500">Reicht nicht.</strong> {formatCurrency(Math.abs(balance))} zu wenig.</>}
          </p>
        </div>
      )}

      {/* Einnahmen */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Einnahmen</span>
            <Input
              type="number" min="0" step="50"
              value={income}
              onChange={e => setIncome(e.target.value)}
              className="w-32 h-8 text-right text-sm font-semibold text-green-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Ausgaben */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          {categories.map(cat => (
            <div key={cat.slug} className="flex items-center justify-between">
              <span className="text-sm">{cat.icon} {cat.name}</span>
              <Input
                type="number" min="0" step="10"
                value={plans[cat.slug] ?? "0"}
                onChange={e => setPlans(p => ({ ...p, [cat.slug]: e.target.value }))}
                className="w-32 h-8 text-right text-sm"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Summe */}
      <Card className={balance >= 0 ? "border-green-500/30" : "border-red-500/30"}>
        <CardContent className="pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Einnahmen</span>
            <span className="text-green-500">{formatCurrency(num(income))}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Ausgaben</span>
            <span className="text-red-500">−{formatCurrency(totalExpenses)}</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="font-semibold text-sm">Übrig</span>
            <span className={`text-lg font-bold ${balance >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatCurrency(balance)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
