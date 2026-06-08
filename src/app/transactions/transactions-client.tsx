"use client";

import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency, GERMAN_MONTHS } from "@/lib/constants";
import { Pencil, Trash2, Search, Plus } from "lucide-react";
import AddTransactionDialog from "@/components/add-transaction-dialog";

interface Transaction {
  _id: string;
  description: string;
  amount: number;
  type: "income" | "expense" | "fixed";
  category: string;
  date: string;
  recurring: "monthly" | "weekly" | null;
}

interface Category {
  _id: string;
  slug: string;
  name: string;
  icon: string;
  color: string;
}

interface Props {
  year: number;
  month: number;
}

export default function TransactionsClient({ year, month }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [deleteTxId, setDeleteTxId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

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
    } catch {
      toast.error("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleDelete() {
    if (!deleteTxId) return;
    const res = await fetch(`/api/transactions/${deleteTxId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Transaktion gelöscht");
      fetchData();
    } else {
      toast.error("Fehler beim Löschen");
    }
    setDeleteTxId(null);
  }

  const catMap = new Map(categories.map(c => [c.slug, c]));

  const filtered = transactions.filter(t => {
    const matchSearch = search === "" || t.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === "all" || t.category === filterCategory;
    const matchType = filterType === "all" || t.type === filterType;
    return matchSearch && matchCat && matchType;
  });

  const typeLabel = { income: "Einnahme", expense: "Ausgabe", fixed: "Fixkosten" };
  const typeColor = {
    income: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    expense: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    fixed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length} Transaktionen in {GERMAN_MONTHS[month - 1]} {year}
        </p>
        <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1">
          <Plus className="h-4 w-4" /> Neue Transaktion
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Alle Kategorien" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kategorien</SelectItem>
            {categories.map(c => (
              <SelectItem key={c._id} value={c.slug}>
                {c.icon} {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Alle Typen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            <SelectItem value="income">Einnahmen</SelectItem>
            <SelectItem value="expense">Ausgaben</SelectItem>
            <SelectItem value="fixed">Fixkosten</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Search className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Keine Transaktionen gefunden</p>
            <p className="text-xs mt-1">Versuche, die Filter anzupassen oder füge eine neue Transaktion hinzu.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((tx) => {
            const cat = catMap.get(tx.category);
            return (
              <Card key={tx._id} className="hover:bg-accent/30 transition-colors">
                <CardContent className="flex items-center justify-between py-3 px-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{cat?.icon || "📦"}</span>
                    <div>
                      <p className="font-medium text-sm">{tx.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{tx.date}</span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full ${typeColor[tx.type]}`}
                        >
                          {typeLabel[tx.type]}
                        </span>
                        {tx.recurring && (
                          <Badge variant="outline" className="text-xs py-0">
                            {tx.recurring === "monthly" ? "Monatlich" : "Wöchentlich"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-semibold text-sm ${
                        tx.type === "income" ? "text-green-500" : "text-foreground"
                      }`}
                    >
                      {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditTx(tx)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteTxId(tx._id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add dialog */}
      <AddTransactionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={() => { setAddOpen(false); fetchData(); }}
      />

      {/* Edit dialog */}
      {editTx && (
        <AddTransactionDialog
          open={!!editTx}
          onOpenChange={(open) => { if (!open) setEditTx(null); }}
          onSuccess={() => { setEditTx(null); fetchData(); }}
          initialData={{
            _id: editTx._id,
            description: editTx.description,
            amount: String(editTx.amount),
            type: editTx.type,
            category: editTx.category,
            date: editTx.date,
            recurring: editTx.recurring || "none",
          }}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTxId} onOpenChange={(open) => { if (!open) setDeleteTxId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transaktion löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
