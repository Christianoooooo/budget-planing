"use client";

import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { formatCurrency } from "@/lib/constants";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";

interface Category {
  _id: string;
  slug: string;
  name: string;
  icon: string;
  color: string;
  budget: number;
  isDefault: boolean;
}

interface Transaction {
  _id: string;
  amount: number;
  type: string;
  category: string;
}

const CURRENT_MONTH = new Date().getMonth() + 1;
const CURRENT_YEAR = new Date().getFullYear();

interface CategoryFormData {
  name: string;
  slug: string;
  icon: string;
  color: string;
  budget: string;
}

const defaultForm: CategoryFormData = {
  name: "",
  slug: "",
  icon: "📦",
  color: "#6366f1",
  budget: "0",
};

export default function CategoriesClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CategoryFormData>(defaultForm);
  const [errors, setErrors] = useState<Partial<CategoryFormData>>({});
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, txRes] = await Promise.all([
        fetch("/api/categories"),
        fetch(`/api/transactions?year=${CURRENT_YEAR}&month=${CURRENT_MONTH}`),
      ]);
      const [catData, txData] = await Promise.all([catRes.json(), txRes.json()]);
      setCategories(catData);
      setTransactions(txData);
    } catch {
      toast.error("Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openAdd() {
    setEditCat(null);
    setForm(defaultForm);
    setErrors({});
    setDialogOpen(true);
  }

  function openEdit(cat: Category) {
    setEditCat(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon,
      color: cat.color,
      budget: String(cat.budget),
    });
    setErrors({});
    setDialogOpen(true);
  }

  function validate(): boolean {
    const e: Partial<CategoryFormData> = {};
    if (!form.name.trim()) e.name = "Name erforderlich";
    if (!form.slug.trim()) e.slug = "Slug erforderlich";
    if (!form.icon.trim()) e.icon = "Icon erforderlich";
    if (!form.color) e.color = "Farbe erforderlich";
    if (isNaN(Number(form.budget)) || Number(form.budget) < 0) e.budget = "Gültiges Budget";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim().toLowerCase().replace(/\s+/g, "-"),
        icon: form.icon.trim(),
        color: form.color,
        budget: Number(form.budget),
      };

      let res;
      if (editCat) {
        res = await fetch(`/api/categories/${editCat._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        toast.success(editCat ? "Kategorie aktualisiert" : "Kategorie erstellt");
        setDialogOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Fehler beim Speichern");
      }
    } catch {
      toast.error("Netzwerkfehler");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteCatId) return;
    const res = await fetch(`/api/categories/${deleteCatId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Kategorie gelöscht");
      fetchData();
    } else {
      toast.error("Fehler beim Löschen");
    }
    setDeleteCatId(null);
  }

  const spendingMap: Record<string, number> = {};
  transactions.filter(t => t.type !== "income").forEach(t => {
    spendingMap[t.category] = (spendingMap[t.category] || 0) + t.amount;
  });

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{categories.length} Kategorien</p>
        <Button size="sm" onClick={openAdd} className="gap-1">
          <Plus className="h-4 w-4" /> Neue Kategorie
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Tag className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Keine Kategorien vorhanden</p>
            <p className="text-xs mt-1">Erstelle deine erste Kategorie.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => {
            const spent = spendingMap[cat.slug] || 0;
            const pct = cat.budget > 0 ? Math.min(100, (spent / cat.budget) * 100) : 0;
            return (
              <Card key={cat._id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{cat.icon}</span>
                      <div>
                        <CardTitle className="text-base">{cat.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{cat.slug}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cat)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => setDeleteCatId(cat._id)}
                        disabled={cat.isDefault}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {cat.budget > 0 ? (
                    <>
                      <div className="flex justify-between text-xs">
                        <span>{formatCurrency(spent)}</span>
                        <span className="text-muted-foreground">/{formatCurrency(cat.budget)}</span>
                      </div>
                      <Progress
                        value={pct}
                        className={`h-2 ${pct >= 100 ? "[&>div]:bg-red-500" : pct >= 80 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-green-500"}`}
                      />
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">{pct.toFixed(0)}% genutzt</span>
                        {pct >= 100 ? (
                          <Badge className="bg-red-500 text-white text-xs">Überzogen</Badge>
                        ) : pct >= 80 ? (
                          <Badge className="bg-yellow-500 text-white text-xs">Achtung</Badge>
                        ) : (
                          <Badge className="bg-green-500 text-white text-xs">OK</Badge>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Kein Budget gesetzt</p>
                  )}
                  <div
                    className="h-1 rounded-full mt-2"
                    style={{ backgroundColor: cat.color }}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{editCat ? "Kategorie bearbeiten" : "Neue Kategorie"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="z.B. Wohnen"
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label>Slug (ID)</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="z.B. wohnen"
                />
                {errors.slug && <p className="text-xs text-destructive">{errors.slug}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icon (Emoji)</Label>
                <Input
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  placeholder="🏠"
                />
                {errors.icon && <p className="text-xs text-destructive">{errors.icon}</p>}
              </div>
              <div className="space-y-2">
                <Label>Farbe</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="w-12 p-1 h-10"
                  />
                  <Input
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    placeholder="#6366f1"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Monatsbudget (€)</Label>
              <Input
                type="number"
                min="0"
                step="10"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
                placeholder="0"
              />
              {errors.budget && <p className="text-xs text-destructive">{errors.budget}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Speichern..." : editCat ? "Aktualisieren" : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteCatId} onOpenChange={(open) => { if (!open) setDeleteCatId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kategorie löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Transaktionen mit dieser Kategorie bleiben erhalten.
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
