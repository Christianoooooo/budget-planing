"use client";

import React, { useState, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileText, Check, Loader2 } from "lucide-react";

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense" | "fixed";
  category: string;
}

interface PreviewData {
  transactions: ParsedTransaction[];
  count: number;
  totalIncome: number;
  totalExpenses: number;
}

interface CategoryOption {
  slug: string;
  name: string;
  icon: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  categories: CategoryOption[];
}

export default function N26ImportDialog({ open, onOpenChange, onSuccess, categories }: Props) {
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [editedTransactions, setEditedTransactions] = useState<ParsedTransaction[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetState() {
    setStep("upload");
    setPreview(null);
    setEditedTransactions([]);
    setFile(null);
    setImportResult(null);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Bitte eine PDF-Datei auswählen");
      return;
    }

    setFile(selectedFile);

    // Preview (dry run)
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("dryRun", "true");

    try {
      const res = await fetch("/api/import/n26", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Fehler beim Parsen der PDF");
        if (data.rawTextPreview) {
          console.log("PDF Text Preview:", data.rawTextPreview);
        }
        return;
      }

      setPreview(data);
      setEditedTransactions(data.transactions);
      setStep("preview");
    } catch {
      toast.error("Netzwerkfehler beim Hochladen");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function updateTransactionCategory(index: number, newCategory: string) {
    setEditedTransactions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], category: newCategory };
      return updated;
    });
  }

  function removeTransaction(index: number) {
    setEditedTransactions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleImport() {
    if (!file || editedTransactions.length === 0) return;

    setStep("importing");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/import/n26", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Import fehlgeschlagen");
        setStep("preview");
        return;
      }

      setImportResult({ imported: data.imported });
      setStep("done");
      toast.success(`${data.imported} Transaktionen importiert`);
    } catch {
      toast.error("Netzwerkfehler beim Importieren");
      setStep("preview");
    }
  }

  function handleClose() {
    if (step === "done") onSuccess();
    resetState();
    onOpenChange(false);
  }

  const typeLabel: Record<string, string> = {
    income: "Einnahme",
    expense: "Ausgabe",
    fixed: "Fixkosten",
  };

  const typeColor: Record<string, string> = {
    income: "bg-green-500",
    expense: "bg-red-500",
    fixed: "bg-yellow-500",
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            N26 Kontoauszug importieren
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Lade deinen N26 Kontoauszug als PDF hoch. Die Transaktionen werden automatisch erkannt und kategorisiert."}
            {step === "preview" && `${editedTransactions.length} Transaktionen erkannt. Prüfe die Zuordnung und passe Kategorien an, bevor du importierst.`}
            {step === "importing" && "Transaktionen werden importiert..."}
            {step === "done" && `${importResult?.imported} Transaktionen erfolgreich importiert!`}
          </DialogDescription>
        </DialogHeader>

        {/* Upload Step */}
        {step === "upload" && (
          <div className="flex flex-col items-center gap-6 py-8">
            <div className="w-32 h-32 rounded-2xl bg-muted flex items-center justify-center">
              <Upload className="h-12 w-12 text-muted-foreground" />
            </div>
            <div className="text-center space-y-2">
              <p className="font-medium">PDF-Datei auswählen</p>
              <p className="text-sm text-muted-foreground">
                Unterstützt: N26 Kontoauszüge (Monatsübersicht)
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" />
              PDF hochladen
            </Button>
          </div>
        )}

        {/* Preview Step */}
        {step === "preview" && preview && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">Transaktionen</p>
                <p className="text-lg font-bold">{editedTransactions.length}</p>
              </div>
              <div className="rounded-lg bg-green-500/10 p-3 text-center">
                <p className="text-xs text-muted-foreground">Einnahmen</p>
                <p className="text-lg font-bold text-green-500">
                  {formatCurrency(editedTransactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0))}
                </p>
              </div>
              <div className="rounded-lg bg-red-500/10 p-3 text-center">
                <p className="text-xs text-muted-foreground">Ausgaben</p>
                <p className="text-lg font-bold text-red-500">
                  {formatCurrency(editedTransactions.filter((t) => t.type !== "income").reduce((s, t) => s + t.amount, 0))}
                </p>
              </div>
            </div>

            {/* Transaction Table */}
            <div className="border rounded-lg max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Datum</TableHead>
                    <TableHead>Beschreibung</TableHead>
                    <TableHead className="w-36">Kategorie</TableHead>
                    <TableHead className="w-20">Typ</TableHead>
                    <TableHead className="text-right w-28">Betrag</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editedTransactions.map((tx, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{tx.date.split("-").reverse().join(".")}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate" title={tx.description}>
                        {tx.description}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={tx.category}
                          onValueChange={(val) => updateTransactionCategory(i, val)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat.slug} value={cat.slug}>
                                {cat.icon} {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${typeColor[tx.type]} text-white text-xs`}>
                          {typeLabel[tx.type]}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-medium text-sm ${tx.type === "income" ? "text-green-500" : "text-red-500"}`}>
                        {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeTransaction(i)}
                          title="Entfernen"
                        >
                          ×
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Importing Step */}
        {step === "importing" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Importiere Transaktionen...</p>
          </div>
        )}

        {/* Done Step */}
        {step === "done" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <p className="font-medium">{importResult?.imported} Transaktionen importiert</p>
            <p className="text-sm text-muted-foreground">
              Die Transaktionen wurden deiner Datenbank hinzugefügt.
            </p>
          </div>
        )}

        <DialogFooter>
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={resetState}>Zurück</Button>
              <Button onClick={handleImport} disabled={editedTransactions.length === 0} className="gap-2">
                <Upload className="h-4 w-4" />
                {editedTransactions.length} Transaktionen importieren
              </Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={handleClose}>Schließen</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
