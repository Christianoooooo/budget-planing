import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import connectDB from "@/lib/mongodb";
import Transaction from "@/lib/models/Transaction";
import Category from "@/lib/models/Category";

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense" | "fixed";
  category: string;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  housing: ["miete", "wohnung", "strom", "gas", "heizung", "nebenkosten", "hausverwaltung", "immoscout", "wohnungsbaugesellschaft"],
  food: ["rewe", "edeka", "aldi", "lidl", "netto", "penny", "kaufland", "dm ", "rossmann", "supermarkt", "lebensmittel", "bakery", "bäckerei", "lieferando", "lieferheld", "uber eats", "wolt", "flink", "gorillas", "getir"],
  transport: ["db ", "bahn", "deutsche bahn", "tank", "aral", "shell", "esso", "jet ", "uber", "bolt", "miles", "share now", "sixt", "flixbus", "adac", "kfz", "auto", "parkhaus", "parken", "tier", "lime", "voi"],
  leisure: ["netflix", "spotify", "amazon prime", "disney", "youtube", "kino", "theater", "museum", "konzert", "fitnessstudio", "gym", "mcfit", "urban sports", "sport", "hobby", "restaurant", "bar ", "café", "cafe", "starbucks", "steam", "playstation", "xbox", "nintendo"],
  health: ["apotheke", "arzt", "zahnarzt", "praxis", "krankenhaus", "klinik", "physiotherap", "optiker", "brille"],
  insurance: ["versicherung", "allianz", "huk", "ergo", "axa", "debeka", "barmer", "aok", "tk ", "dak", "krankenkasse"],
  savings: ["sparplan", "etf", "depot", "trade republic", "scalable", "ing diba spar", "tagesgeld", "festgeld"],
};

function categorizeTransaction(description: string): string {
  const lower = description.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category;
    }
  }
  return "other";
}

function parseGermanDate(dateStr: string): string | null {
  // Formats: DD.MM.YYYY, DD.MM.YY, DD/MM/YYYY
  const match = dateStr.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (!match) return null;
  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  let year = match[3];
  if (year.length === 2) year = "20" + year;
  return `${year}-${month}-${day}`;
}

function parseGermanAmount(amountStr: string): number | null {
  // N26 uses formats like: -12,34 or 1.234,56 or +50,00
  let cleaned = amountStr.replace(/[€\s]/g, "").trim();
  // Remove thousands separators (dots before comma)
  cleaned = cleaned.replace(/\.(?=\d{3})/g, "");
  // Replace comma with dot for decimal
  cleaned = cleaned.replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseN26Pdf(text: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // N26 PDF patterns:
  // Pattern 1 (newer statements): "DD.MM.YYYY Description -XX,XX €" or similar
  // Pattern 2 (CSV-like within PDF): date on one line, description next, amount after
  // Pattern 3: Table rows with date | description | amount

  // Regex for a line containing a date and amount
  const fullLineRegex = /(\d{1,2}[./]\d{1,2}[./]\d{2,4})\s+(.+?)\s+([+-]?\s*[\d.,]+)\s*€?$/;

  // Try full-line pattern first
  for (const line of lines) {
    const match = line.match(fullLineRegex);
    if (match) {
      const date = parseGermanDate(match[1]);
      const description = match[2].trim();
      const amount = parseGermanAmount(match[3]);
      if (date && amount !== null && description.length > 1) {
        transactions.push({
          date,
          description,
          amount: Math.abs(amount),
          type: amount > 0 ? "income" : "expense",
          category: categorizeTransaction(description),
        });
      }
    }
  }

  // If the full-line pattern didn't work well, try multi-line parsing
  if (transactions.length < 3) {
    transactions.length = 0; // reset

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Look for a date at the start of a line
      const dateMatch = line.match(/^(\d{1,2}[./]\d{1,2}[./]\d{2,4})/);
      if (!dateMatch) continue;

      const date = parseGermanDate(dateMatch[1]);
      if (!date) continue;

      // The rest of this line or the next line(s) should have description and amount
      const remaining = line.substring(dateMatch[0].length).trim();
      let description = "";
      let amountStr = "";

      // Check if amount is on the same line
      const amountMatch = remaining.match(/([+-]?\s*[\d.]+,\d{2})\s*€?\s*$/);
      if (amountMatch) {
        amountStr = amountMatch[1];
        description = remaining.substring(0, remaining.length - amountMatch[0].length).trim();
      } else {
        description = remaining;
        // Look ahead for amount
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          const nextLine = lines[j];
          // Skip if it's another date line
          if (/^\d{1,2}[./]\d{1,2}[./]\d{2,4}/.test(nextLine)) break;

          const amtMatch = nextLine.match(/([+-]?\s*[\d.]+,\d{2})\s*€?\s*$/);
          if (amtMatch) {
            amountStr = amtMatch[1];
            const prefix = nextLine.substring(0, nextLine.length - amtMatch[0].length).trim();
            if (prefix && !description) description = prefix;
            else if (prefix) description += " " + prefix;
            break;
          } else if (!description) {
            description = nextLine;
          } else {
            description += " " + nextLine;
          }
        }
      }

      const amount = parseGermanAmount(amountStr);
      if (date && amount !== null && description.length > 1) {
        transactions.push({
          date,
          description: description.replace(/\s+/g, " ").trim(),
          amount: Math.abs(amount),
          type: amount > 0 ? "income" : "expense",
          category: categorizeTransaction(description),
        });
      }
    }
  }

  // Deduplicate by date + description + amount
  const seen = new Set<string>();
  return transactions.filter((t) => {
    const key = `${t.date}|${t.description}|${t.amount}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Keine Datei hochgeladen" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Nur PDF-Dateien werden akzeptiert" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    const pdfResult = await parser.getText();
    const text = pdfResult.text;
    await parser.destroy();
    const parsed = parseN26Pdf(text);

    if (parsed.length === 0) {
      return NextResponse.json({
        error: "Keine Transaktionen gefunden. Bitte stelle sicher, dass es sich um einen N26-Kontoauszug handelt.",
        rawTextPreview: text.substring(0, 500),
      }, { status: 422 });
    }

    // Preview mode — return parsed transactions without saving
    const dryRun = formData.get("dryRun") === "true";
    if (dryRun) {
      return NextResponse.json({
        transactions: parsed,
        count: parsed.length,
        totalIncome: parsed.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
        totalExpenses: parsed.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
      });
    }

    // Save to DB
    await connectDB();

    // Ensure all categories exist
    const existingCategories = await Category.find({});
    const existingSlugs = new Set(existingCategories.map((c) => c.slug));
    const neededSlugs = Array.from(new Set(parsed.map((t) => t.category)));
    for (const slug of neededSlugs) {
      if (!existingSlugs.has(slug)) {
        await Category.create({
          slug,
          name: slug.charAt(0).toUpperCase() + slug.slice(1),
          icon: "📦",
          color: "#94a3b8",
          budget: 0,
          isDefault: false,
        });
      }
    }

    const created = await Transaction.insertMany(
      parsed.map((t) => ({
        description: t.description,
        amount: t.amount,
        type: t.type,
        category: t.category,
        date: t.date,
        recurring: null,
      }))
    );

    return NextResponse.json({
      imported: created.length,
      transactions: parsed,
    });
  } catch (error) {
    console.error("N26 import error:", error);
    return NextResponse.json(
      { error: "Fehler beim Verarbeiten der PDF-Datei" },
      { status: 500 }
    );
  }
}
