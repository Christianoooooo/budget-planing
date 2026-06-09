"use client";

import React, { useState, useRef } from "react";
import { Upload, Trash2, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Transaction {
  date: string;       // YYYY-MM-DD
  partner: string;
  amount: number;     // positive = income, negative = expense
  category: string;
  reference: string;
}

// ── Category detection ────────────────────────────────────────────────────────
const CATS: Record<string, { name: string; icon: string; color: string }> = {
  housing:    { name: "Wohnen",        icon: "🏠", color: "#6366f1" },
  food:       { name: "Lebensmittel",  icon: "🛒", color: "#22c55e" },
  transport:  { name: "Transport",     icon: "🚗", color: "#f97316" },
  leisure:    { name: "Freizeit",      icon: "🎮", color: "#a855f7" },
  health:     { name: "Gesundheit",    icon: "💊", color: "#ec4899" },
  insurance:  { name: "Versicherung",  icon: "🛡️", color: "#eab308" },
  savings:    { name: "Sparen",        icon: "💰", color: "#14b8a6" },
  income:     { name: "Einnahmen",     icon: "💵", color: "#22c55e" },
  fees:       { name: "Gebühren",      icon: "🏦", color: "#64748b" },
  other:      { name: "Sonstiges",     icon: "📦", color: "#94a3b8" },
};

const KEYWORDS: [string, string][] = [
  // income
  ["gehalt", "income"], ["lohn", "income"], ["rente", "income"],
  ["familienkasse", "income"], ["kindergeld", "income"],
  ["credit transfer", "income"],
  // housing
  ["miete", "housing"], ["wohnungsbau", "housing"], ["hausverwaltung", "housing"],
  ["nebenkosten", "housing"], ["palasch", "housing"],
  // food
  ["edeka", "food"], ["rewe", "food"], ["lidl", "food"], ["aldi", "food"],
  ["netto", "food"], ["penny", "food"], ["kaufland", "food"], ["e center", "food"],
  ["metzgerei", "food"], ["backstube", "food"], ["bäckerei", "food"],
  ["wuensche", "food"], ["schnellers", "food"], ["papperts", "food"],
  ["transgourmet", "food"], ["lekkerland", "food"],
  ["lieferando", "food"], ["wolt", "food"], ["uber eats", "food"],
  ["mcdonalds", "food"], ["kfc", "food"], ["inter kebap", "food"],
  ["burgerheart", "food"], ["viet nam", "food"], ["anymy", "food"],
  ["bravo nepol", "food"], ["hotel", "food"], ["restaurant", "food"],
  ["willibald", "food"],
  // transport
  ["aral", "transport"], ["shell", "transport"], ["agip", "transport"],
  ["bft", "transport"], ["westfalen tank", "transport"],
  ["tank", "transport"], ["parkhaus", "transport"], ["parking", "transport"],
  ["cologne park", "transport"],
  ["db ", "transport"], ["bahn", "transport"], ["flixbus", "transport"],
  ["uber", "transport"],
  // insurance & utilities
  ["versicherung", "insurance"], ["getsafe", "insurance"],
  ["da deutsche allgemeine", "insurance"], ["hanseatic bank", "insurance"],
  ["vodafone", "insurance"], ["octopus energy", "insurance"], ["energie", "insurance"],
  // savings
  ["sparplan", "savings"], ["depot", "savings"], ["trade republic", "savings"],
  // fees
  ["n26", "fees"], ["fee", "fees"],
  // leisure
  ["netflix", "leisure"], ["spotify", "leisure"], ["apple.com", "leisure"],
  ["amazon", "leisure"], ["discord", "leisure"], ["steam", "leisure"],
  ["google workspace", "leisure"], ["hetzner", "leisure"],
  ["spk ", "leisure"],
];

function categorize(partner: string, reference: string, type: string, amount: number): string {
  if (amount > 0 && (type === "Credit Transfer" || type === "MoneyBeam")) return "income";
  const text = (partner + " " + reference + " " + type).toLowerCase();
  for (const [kw, cat] of KEYWORDS) {
    if (text.includes(kw)) return cat;
  }
  return "other";
}

// ── CSV parser ────────────────────────────────────────────────────────────────
// N26 format: "Booking Date","Value Date","Partner Name","Partner Iban",Type,
//             "Payment Reference","Account Name","Amount (EUR)","Original Amount",
//             "Original Currency","Exchange Rate"
function parseCSV(text: string): Transaction[] {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return [];

  // Parse a single CSV line respecting quoted fields
  function parseLine(line: string): string[] {
    const fields: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === "," && !inQuote) { fields.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    fields.push(cur.trim());
    return fields;
  }

  const header = parseLine(lines[0]).map(h => h.toLowerCase());
  const idx = (name: string) => header.findIndex(h => h.includes(name));

  const iDate    = idx("booking date");
  const iPartner = idx("partner name");
  const iAmount  = idx("amount (eur)");
  const iRef     = idx("payment reference");
  const iType    = idx("type");

  if (iDate === -1 || iPartner === -1 || iAmount === -1) return [];

  const result: Transaction[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const amount = parseFloat(cols[iAmount]);
    if (isNaN(amount)) continue;

    const partner   = cols[iPartner] || "";
    const reference = iRef >= 0 ? cols[iRef] : "";
    const type      = iType >= 0 ? cols[iType] : "";
    const date      = cols[iDate];

    result.push({
      date,
      partner,
      amount,
      reference,
      category: categorize(partner, reference, type, amount),
    });
  }
  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
function fmtDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}
function getCat(slug: string) {
  return CATS[slug] ?? CATS.other;
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [view, setView] = useState<"overview" | "list">("overview");
  const fileRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();

  const expenses = transactions.filter(t => t.amount < 0);
  const incomes  = transactions.filter(t => t.amount > 0);
  const totalOut = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalIn  = incomes.reduce((s, t) => s + t.amount, 0);
  const balance  = totalIn - totalOut;

  // Group expenses by category
  const byCategory: Record<string, { total: number; items: Transaction[] }> = {};
  expenses.forEach(t => {
    const slug = t.category === "income" ? "other" : t.category;
    if (!byCategory[slug]) byCategory[slug] = { total: 0, items: [] };
    byCategory[slug].total += Math.abs(t.amount);
    byCategory[slug].items.push(t);
  });
  const sortedCats = Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total);

  function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      alert("Bitte eine CSV-Datei hochladen");
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const txs = parseCSV(text);
      setTransactions(txs);
      setView("overview");
    };
    reader.readAsText(file, "utf-8");
    if (fileRef.current) fileRef.current.value = "";
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
          <p className="text-sm text-muted-foreground">CSV exportieren → hier hochladen → sehen wo das Geld bleibt</p>
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
        <input
          ref={fileRef} type="file" accept=".csv" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Upload className="h-8 w-8" />
          <span className="text-sm font-medium">N26 CSV-Export ablegen oder klicken</span>
          <span className="text-xs">In der N26 App: Konto → Export → CSV</span>
        </div>
      </div>

      {/* Results */}
      {transactions.length > 0 && (
        <div className="space-y-4">

          {/* Totals */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-green-500/10 p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Einnahmen</p>
              <p className="font-bold text-green-500 text-sm">{fmt(totalIn)}</p>
            </div>
            <div className="rounded-lg bg-red-500/10 p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Ausgaben</p>
              <p className="font-bold text-red-500 text-sm">{fmt(totalOut)}</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${balance >= 0 ? "bg-blue-500/10" : "bg-red-500/10"}`}>
              <p className="text-xs text-muted-foreground mb-1">Übrig</p>
              <p className={`font-bold text-sm ${balance >= 0 ? "text-blue-500" : "text-red-500"}`}>
                {fmt(balance)}
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
              {sortedCats.map(([slug, { total, items }]) => {
                const c = getCat(slug);
                const pct = totalOut > 0 ? (total / totalOut) * 100 : 0;
                return (
                  <div key={slug} className="rounded-lg border bg-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{c.icon}</span>
                        <span className="font-medium text-sm">{c.name}</span>
                        <span className="text-xs text-muted-foreground">{items.length}×</span>
                      </div>
                      <span className="font-bold text-sm">{fmt(total)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{pct.toFixed(0)} % der Ausgaben</p>
                    {items
                      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                      .slice(0, 3)
                      .map((tx, i) => (
                        <div key={i} className="flex justify-between text-xs text-muted-foreground">
                          <span className="truncate max-w-[220px]">{tx.partner}</span>
                          <span className="shrink-0 ml-2">{fmt(Math.abs(tx.amount))}</span>
                        </div>
                      ))}
                    {items.length > 3 && (
                      <p className="text-xs text-muted-foreground mt-0.5">+{items.length - 3} weitere</p>
                    )}
                  </div>
                );
              })}

              {/* Incomes summary */}
              {incomes.length > 0 && (
                <div className="rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">💵</span>
                      <span className="font-medium text-sm">Einnahmen</span>
                      <span className="text-xs text-muted-foreground">{incomes.length}×</span>
                    </div>
                    <span className="font-bold text-sm text-green-500">{fmt(totalIn)}</span>
                  </div>
                  {incomes
                    .sort((a, b) => b.amount - a.amount)
                    .map((tx, i) => (
                      <div key={i} className="flex justify-between text-xs text-muted-foreground">
                        <span className="truncate max-w-[220px]">{tx.partner}</span>
                        <span className="shrink-0 ml-2 text-green-500">{fmt(tx.amount)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Full list */}
          {view === "list" && (
            <div className="space-y-1">
              {[...transactions]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((tx, i) => {
                  const c = tx.amount > 0 ? getCat("income") : getCat(tx.category);
                  return (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <span>{c.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{tx.partner}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(tx.date)} · {c.name}</p>
                      </div>
                      <span className={`text-sm font-semibold shrink-0 ${tx.amount >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {tx.amount >= 0 ? "+" : "−"}{fmt(Math.abs(tx.amount))}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}

          <button
            onClick={() => setTransactions([])}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors pt-1"
          >
            <Trash2 className="h-3.5 w-3.5" /> Zurücksetzen
          </button>
        </div>
      )}
    </div>
  );
}
