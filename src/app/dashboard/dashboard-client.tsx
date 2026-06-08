"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, GERMAN_MONTHS } from "@/lib/constants";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Wallet, PiggyBank } from "lucide-react";

interface Transaction {
  _id: string;
  description: string;
  amount: number;
  type: "income" | "expense" | "fixed";
  category: string;
  date: string;
}

interface Category {
  _id: string;
  slug: string;
  name: string;
  icon: string;
  color: string;
  budget: number;
}

interface Props {
  year: number;
  month: number;
}

const SHORT_MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export default function DashboardClient({ year, month }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [savingsGoal, setSavingsGoal] = useState(500);
  const [loading, setLoading] = useState(true);
  const [historicalData, setHistoricalData] = useState<{ month: string; income: number; expenses: number }[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [txRes, catRes, settingsRes] = await Promise.all([
        fetch(`/api/transactions?year=${year}&month=${month}`),
        fetch("/api/categories"),
        fetch("/api/settings"),
      ]);
      const [txData, catData, settingsData] = await Promise.all([
        txRes.json(),
        catRes.json(),
        settingsRes.json(),
      ]);
      setTransactions(txData);
      setCategories(catData);
      if (settingsData.savingsGoal) setSavingsGoal(Number(settingsData.savingsGoal));

      // Fetch historical data for last 6 months
      const hist = [];
      for (let i = 5; i >= 0; i--) {
        let hMonth = month - i;
        let hYear = year;
        while (hMonth <= 0) { hMonth += 12; hYear--; }
        while (hMonth > 12) { hMonth -= 12; hYear++; }
        const res = await fetch(`/api/transactions?year=${hYear}&month=${hMonth}`);
        const data: Transaction[] = await res.json();
        const income = data.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
        const expenses = data.filter(t => t.type !== "income").reduce((s, t) => s + t.amount, 0);
        hist.push({ month: SHORT_MONTHS[hMonth - 1], income, expenses });
      }
      setHistoricalData(hist);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Trigger seed on first load if no transactions
  useEffect(() => {
    async function checkAndSeed() {
      const res = await fetch("/api/transactions");
      const data = await res.json();
      if (data.length === 0) {
        await fetch("/api/seed", { method: "POST" });
        fetchData();
      }
    }
    checkAndSeed();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const income = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = transactions.filter(t => t.type !== "income").reduce((s, t) => s + t.amount, 0);
  const balance = income - expenses;
  const savingsRate = income > 0 ? ((balance / income) * 100) : 0;

  // Category spending
  const catMap = new Map(categories.map(c => [c.slug, c]));
  const expenseByCategory: Record<string, number> = {};
  transactions.filter(t => t.type !== "income").forEach(t => {
    expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount;
  });

  const pieData = Object.entries(expenseByCategory)
    .map(([slug, value]) => ({
      name: catMap.get(slug)?.name || slug,
      value,
      color: catMap.get(slug)?.color || "#64748b",
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const budgetTrafficLights = categories
    .filter(c => c.budget > 0 && expenseByCategory[c.slug] !== undefined)
    .map(c => ({
      ...c,
      spent: expenseByCategory[c.slug] || 0,
      pct: Math.min(100, ((expenseByCategory[c.slug] || 0) / c.budget) * 100),
    }))
    .sort((a, b) => b.pct - a.pct);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Übersicht für {GERMAN_MONTHS[month - 1]} {year}
      </p>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Einnahmen"
          value={formatCurrency(income)}
          icon={<TrendingUp className="h-4 w-4 text-green-500" />}
          valueClass="text-green-500"
        />
        <StatCard
          title="Ausgaben"
          value={formatCurrency(expenses)}
          icon={<TrendingDown className="h-4 w-4 text-red-500" />}
          valueClass="text-red-500"
        />
        <StatCard
          title="Bilanz"
          value={formatCurrency(balance)}
          icon={<Wallet className="h-4 w-4 text-blue-500" />}
          valueClass={balance >= 0 ? "text-green-500" : "text-red-500"}
        />
        <StatCard
          title="Sparquote"
          value={`${savingsRate.toFixed(1)} %`}
          icon={<PiggyBank className="h-4 w-4 text-purple-500" />}
          valueClass="text-purple-500"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Donut chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ausgaben nach Kategorie</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                Keine Ausgaben in diesem Monat
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Bar chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Einnahmen vs. Ausgaben (6 Monate)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={historicalData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}€`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="income" name="Einnahmen" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Ausgaben" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Savings Goal + Budget Traffic Lights */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sparziel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Gespart: <strong>{formatCurrency(Math.max(0, balance))}</strong></span>
              <span>Ziel: <strong>{formatCurrency(savingsGoal)}</strong></span>
            </div>
            <Progress value={Math.min(100, savingsGoal > 0 ? (Math.max(0, balance) / savingsGoal) * 100 : 0)} className="h-3" />
            <p className="text-xs text-muted-foreground">
              {savingsGoal > 0
                ? `${Math.min(100, ((Math.max(0, balance) / savingsGoal) * 100)).toFixed(1)}% des Sparziels erreicht`
                : "Kein Sparziel gesetzt"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Budget Ampeln</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {budgetTrafficLights.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Budgets mit Ausgaben</p>
            ) : (
              budgetTrafficLights.slice(0, 5).map((cat) => (
                <div key={cat.slug} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="flex items-center gap-1">
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {formatCurrency(cat.spent)} / {formatCurrency(cat.budget)}
                      </span>
                      <TrafficLight pct={cat.pct} />
                    </span>
                  </div>
                  <Progress
                    value={cat.pct}
                    className={`h-1.5 ${cat.pct >= 100 ? "[&>div]:bg-red-500" : cat.pct >= 80 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-green-500"}`}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  valueClass,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function TrafficLight({ pct }: { pct: number }) {
  if (pct >= 100) return <Badge className="bg-red-500 text-white text-xs px-1 py-0">Überzogen</Badge>;
  if (pct >= 80) return <Badge className="bg-yellow-500 text-white text-xs px-1 py-0">Achtung</Badge>;
  return <Badge className="bg-green-500 text-white text-xs px-1 py-0">OK</Badge>;
}
