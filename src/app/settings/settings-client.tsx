"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import { Download, Upload, Trash2, Save, Target, FileText } from "lucide-react";
import N26ImportDialog from "@/components/n26-import-dialog";

export default function SettingsClient() {
  const [savingsGoal, setSavingsGoal] = useState("500");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [n26ImportOpen, setN26ImportOpen] = useState(false);
  const [categories, setCategories] = useState<{ slug: string; name: string; icon: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const [settingsRes, catRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/categories"),
      ]);
      const [data, catData] = await Promise.all([settingsRes.json(), catRes.json()]);
      if (data.savingsGoal !== undefined) setSavingsGoal(String(data.savingsGoal));
      setCategories(catData.map((c: { slug: string; name: string; icon: string }) => ({ slug: c.slug, name: c.name, icon: c.icon })));
    } catch {
      toast.error("Fehler beim Laden der Einstellungen");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  async function handleSaveSavingsGoal() {
    const goal = Number(savingsGoal);
    if (isNaN(goal) || goal < 0) {
      toast.error("Ungültiges Sparziel");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "savingsGoal", value: goal }),
      });
      if (res.ok) {
        toast.success("Sparziel gespeichert");
      } else {
        toast.error("Fehler beim Speichern");
      }
    } catch {
      toast.error("Netzwerkfehler");
    } finally {
      setSaving(false);
    }
  }

  function handleExportCSV() {
    window.open("/api/export/csv", "_blank");
    toast.success("CSV-Export gestartet");
  }

  function handleExportJSON() {
    window.open("/api/export/json", "_blank");
    toast.success("JSON-Export gestartet");
  }

  async function handleImportJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await fetch("/api/export/json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        toast.success("Daten erfolgreich importiert");
        window.location.reload();
      } else {
        toast.error("Import fehlgeschlagen");
      }
    } catch {
      toast.error("Ungültige JSON-Datei");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleReset() {
    try {
      // Re-seed the database
      const res = await fetch("/api/seed", { method: "POST" });
      if (res.ok) {
        toast.success("Daten zurückgesetzt");
        window.location.reload();
      } else {
        toast.error("Zurücksetzen fehlgeschlagen");
      }
    } catch {
      toast.error("Netzwerkfehler");
    }
    setResetOpen(false);
  }

  if (loading) {
    return <div className="text-muted-foreground text-sm">Einstellungen werden geladen...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Savings Goal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4" />
            Sparziel
          </CardTitle>
          <CardDescription>Lege dein monatliches Sparziel fest.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-2">
              <Label>Monatliches Sparziel (€)</Label>
              <Input
                type="number"
                min="0"
                step="50"
                value={savingsGoal}
                onChange={(e) => setSavingsGoal(e.target.value)}
              />
            </div>
            <Button onClick={handleSaveSavingsGoal} disabled={saving} className="gap-1">
              <Save className="h-4 w-4" />
              {saving ? "Speichern..." : "Speichern"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Aktuelles Ziel: <strong>{formatCurrency(Number(savingsGoal))}</strong> pro Monat
          </p>
        </CardContent>
      </Card>

      <Separator />

      {/* Export/Import */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4" />
            Daten exportieren
          </CardTitle>
          <CardDescription>Exportiere deine Transaktionen und Kategorien.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={handleExportCSV} className="gap-2 flex-1">
              <Download className="h-4 w-4" />
              Als CSV exportieren
            </Button>
            <Button variant="outline" onClick={handleExportJSON} className="gap-2 flex-1">
              <Download className="h-4 w-4" />
              Als JSON exportieren
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            CSV enthält alle Transaktionen. JSON enthält vollständige Daten (Transaktionen, Kategorien, Einstellungen).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-4 w-4" />
            Daten importieren
          </CardTitle>
          <CardDescription>Importiere Daten aus einer JSON-Datei (ersetzt alle vorhandenen Daten).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportJSON}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            JSON-Datei auswählen
          </Button>
          <p className="text-xs text-muted-foreground">
            Warnung: Der Import ersetzt alle bestehenden Daten (Transaktionen, Kategorien, Einstellungen).
          </p>
        </CardContent>
      </Card>

      {/* N26 Import */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            N26 Kontoauszug importieren
          </CardTitle>
          <CardDescription>
            Importiere Transaktionen direkt aus deinem N26-Kontoauszug (PDF).
            Die Transaktionen werden automatisch erkannt und kategorisiert.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={() => setN26ImportOpen(true)}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            N26 PDF importieren
          </Button>
          <p className="text-xs text-muted-foreground">
            Unterstützt: N26 Kontoauszüge (Monatsübersicht als PDF). Transaktionen werden vor dem Import zur Prüfung angezeigt.
          </p>
        </CardContent>
      </Card>

      <N26ImportDialog
        open={n26ImportOpen}
        onOpenChange={setN26ImportOpen}
        onSuccess={() => {
          setN26ImportOpen(false);
          window.location.reload();
        }}
        categories={categories}
      />

      <Separator />

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <Trash2 className="h-4 w-4" />
            Gefahrenzone
          </CardTitle>
          <CardDescription>Irreversible Aktionen</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => setResetOpen(true)}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Demo-Daten neu laden
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Lädt die Demo-Daten neu (nur möglich wenn DB leer). Um zu resetten, alle Daten zuerst löschen.
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Demo-Daten neu laden?</AlertDialogTitle>
            <AlertDialogDescription>
              Dies versucht, Demo-Daten in die Datenbank zu laden. Bestehende Daten bleiben erhalten wenn vorhanden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>Bestätigen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
