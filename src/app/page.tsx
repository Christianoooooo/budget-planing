"use client";

import React, { useState, useRef } from "react";
import { toast } from "sonner";
import { Upload, Loader2, Trash2, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { formatCurrency } from "@/lib/constants";

interface Transaction {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense" | "fixed";
  category: string;
}

const CATS: Record<string, { name: string; icon: string; color: string }> = {
  housing:   { name: "Wohnen",       icon: "🏠", color: "#6366f1" },
  food:      { name: "Lebensmittel", icon: "🛒", color: "#22c55e" },
  transport: { name: "Transport",    icon: "🚗", color: "#f97316" },
  leisure:   { name: "Freizeit",     icon: "🎮", color: "#a855f7" },
  health:    { name: "Gesundheit",   icon: "💊", color: "#ec4899" },
  insurance: { name: "Versicherung", icon: "🛡️", color: "#eab308" },
  savings:   { name: "Sparen",       icon: "💰", color: "#14b8a6" },
  other:     { name: "Sonstiges",    icon: "📦", color: "#94a3b8" },
};

function cat(slug: string) {
  return CATS[slug] ?? { name: slug, icon: "📦", color: "#94a3b8" };
}

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [uploading, setUploading] = useState(false);
  const [view, setView] = useState<"overview" | "list">("overview");
  const fileRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();

  const expenses = transactions.filter(t => t.type !== "income");
  const totalOut = expenses.reduce((s, t) => s + t.amount, 0);
  const totalIn  = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);

  const byCategory: Record<string, { total: number; items: Transaction[] }> = {};
  expenses.forEach(t => {
    if (!byCategory[t.category]) byCategory[t.category] = { total: 0, items: [] };
    byCategory[t.category].total += t.amount;
    byCategory[t.category].items.push(t);
  });
  const sorted = Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total);

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) { toast.error("Nur PDF-Dateien"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("dryRun", "true");
      const res = await fetch("/api/import/n26", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Fehler beim Parsen"); return; }
      setTransactions(data.transactions);
      setView("overview");
      toast.success(`${data.transactions.length} Transaktionen geladen`);
    } catch { toast.error("Netzwerkfehler"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  return (
    <div className="min-h-screen p-4 sm:p-8 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold">N26 Auswertung</h1>
          <p className="text-sm text-muted-foreground">PDF importieren · sehen wo das Geld bleibt</p>
        </div>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      {/* Upload */}
      <div
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors mb-6"
      >
        <input ref={fileRef} type="file" accept=".pdf" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {uploading
          ? <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm">Wird ausgewertet…</span>
            </div>
          : <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Upload className="h-8 w-8" />
              <span className="text-sm font-medium">N26 Kontoauszug (PDF) ablegen oder klicken</span>
            </div>
        }
      </div>

      {/* Results */}
      {transactions.length > 0 && (
        <div className="space-y-4">

          {/* Totals */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-green-500/10 p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Einnahmen</p>
              <p className="font-bold text-green-500 text-sm">{formatCurrency(totalIn)}</p>
            </div>
            <div className="rounded-lg bg-red-500/10 p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Ausgaben</p>
              <p className="font-bold text-red-500 text-sm">{formatCurrency(totalOut)}</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${totalIn - totalOut >= 0 ? "bg-blue-500/10" : "bg-red-500/10"}`}>
              <p className="text-xs text-muted-foreground mb-1">Übrig</p>
              <p className={`font-bold text-sm ${totalIn - totalOut >= 0 ? "text-blue-500" : "text-red-500"}`}>
                {formatCurrency(totalIn - totalOut)}
              </p>
            </div>
          </div>

          {/* Toggle */}
          <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
            {(["overview", "list"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`text-xs px-3 py-1.5 rounded-md transition-colors ${view === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {v === "overview" ? "Kategorien" : "Alle"}
              </button>
            ))}
          </div>

          {/* Category overview */}
          {view === "overview" && (
            <div className="space-y-2">
              {sorted.map(([slug, { total, items }]) => {
                const c = cat(slug);
                const pct = totalOut > 0 ? (total / totalOut) * 100 : 0;
                return (
                  <div key={slug} className="rounded-lg border bg-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{c.icon}</span>
                        <span className="font-medium text-sm">{c.name}</span>
                        <span className="text-xs text-muted-foreground">{items.length}×</span>
                      </div>
                      <span className="font-bold text-sm">{formatCurrency(total)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{pct.toFixed(0)} % der Ausgaben</p>
                    {items.sort((a, b) => b.amount - a.amount).slice(0, 3).map((tx, i) => (
                      <div key={i} className="flex justify-between text-xs text-muted-foreground">
                        <span className="truncate max-w-[220px]">{tx.description}</span>
                        <span className="shrink-0 ml-2">{formatCurrency(tx.amount)}</span>
                      </div>
                    ))}
                    {items.length > 3 && <p className="text-xs text-muted-foreground mt-0.5">+{items.length - 3} weitere</p>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Full list */}
          {view === "list" && (
            <div className="space-y-1">
              {[...transactions].sort((a, b) => b.date.localeCompare(a.date)).map((tx, i) => {
                const c = cat(tx.category);
                return (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                    <span>{c.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(tx.date)} · {c.name}</p>
                    </div>
                    <span className={`text-sm font-semibold shrink-0 ${tx.type === "income" ? "text-green-500" : "text-red-500"}`}>
                      {tx.type === "income" ? "+" : "−"}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <button onClick={() => setTransactions([])}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors pt-1">
            <Trash2 className="h-3.5 w-3.5" /> Zurücksetzen
          </button>
        </div>
      )}
    </div>
  );
}
