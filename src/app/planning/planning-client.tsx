"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, GERMAN_MONTHS } from "@/lib/constants";

interface Transaction {
  _id: string;
  amount: number;
  type: "income" | "expense" | "fixed";
  category: string;
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

export default function PlanningClient({ year, month }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [txRes, catRes] = await Promise.all([
        fetch(`/api/transactions?year=${year}&month=${month}`),
        fetch("/api/categories"),
      ]);
      const [txData, catData] = await Promise.all([txRes.json(), catRes.json()]);
      setTransactions(txData);
      setCategories(catData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Actual spending per category
  const actualSpending: Record<string, number> = {};
  transactions.filter(t => t.type !== "income").forEach(t => {
    actualSpending[t.category] = (actualSpending[t.category] || 0) + t.amount;
  });

  const totalIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type !== "income").reduce((s, t) => s + t.amount, 0);
  const totalBudget = categories.reduce((s, c) => s + c.budget, 0);
  const balance = totalIncome - totalExpenses;

  // Chart data - planned vs actual per category
  const chartData = categories
    .filter(c => c.budget > 0 || actualSpending[c.slug] > 0)
    .map(c => ({
      name: `${c.icon} ${c.name}`,
      geplant: c.budget,
      tatsächlich: actualSpending[c.slug] || 0,
    }))
    .sort((a, b) => b.geplant - a.geplant);

  // Summary table rows
  const tableRows = categories.map(c => {
    const actual = actualSpending[c.slug] || 0;
    const diff = c.budget > 0 ? c.budget - actual : null;
    const pct = c.budget > 0 ? (actual / c.budget) * 100 : null;
    return { ...c, actual, diff, pct };
  }).sort((a, b) => (b.actual - a.actual));

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Planung für {GERMAN_MONTHS[month - 1]} {year}
      </p>

      {/* Summary stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Geplantes Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalBudget)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tatsächliche Ausgaben</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">{formatCurrency(totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bilanz</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${balance >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatCurrency(balance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Planned vs Actual Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Geplant vs. Tatsächlich nach Kategorie</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              Keine Daten verfügbar
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}€`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="geplant" name="Geplant" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="tatsächlich" name="Tatsächlich" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monatsübersicht</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kategorie</TableHead>
                <TableHead className="text-right">Budget</TableHead>
                <TableHead className="text-right">Ausgaben</TableHead>
                <TableHead className="text-right">Differenz</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableRows.map((row) => (
                <TableRow key={row.slug}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <span>{row.icon}</span>
                      <span className="font-medium">{row.name}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {row.budget > 0 ? formatCurrency(row.budget) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {row.actual > 0 ? formatCurrency(row.actual) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.diff !== null ? (
                      <span className={row.diff >= 0 ? "text-green-500" : "text-red-500"}>
                        {row.diff >= 0 ? "+" : ""}{formatCurrency(row.diff)}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.pct !== null ? (
                      row.pct >= 100 ? (
                        <Badge className="bg-red-500 text-white text-xs">Überzogen</Badge>
                      ) : row.pct >= 80 ? (
                        <Badge className="bg-yellow-500 text-white text-xs">Achtung</Badge>
                      ) : (
                        <Badge className="bg-green-500 text-white text-xs">OK</Badge>
                      )
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals row */}
              <TableRow className="font-bold border-t-2">
                <TableCell>Gesamt</TableCell>
                <TableCell className="text-right">{formatCurrency(totalBudget)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totalExpenses)}</TableCell>
                <TableCell className="text-right">
                  <span className={totalBudget - totalExpenses >= 0 ? "text-green-500" : "text-red-500"}>
                    {totalBudget - totalExpenses >= 0 ? "+" : ""}{formatCurrency(totalBudget - totalExpenses)}
                  </span>
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
