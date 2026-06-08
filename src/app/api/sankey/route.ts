import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Transaction from "@/lib/models/Transaction";
import Category from "@/lib/models/Category";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await connectDB();

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-31`;

  const transactions = await Transaction.find({
    date: { $gte: startDate, $lte: endDate },
  }).lean();

  const categories = await Category.find({}).lean();
  const catMap = new Map(categories.map((c) => [c.slug, c]));

  // Build Sankey data
  // Nodes: Income sources → Gesamtbudget → Categories → Savings/Überschuss
  const incomeByDesc: Record<string, number> = {};
  const expenseByCategory: Record<string, number> = {};
  let totalIncome = 0;
  let totalExpense = 0;

  for (const tx of transactions) {
    if (tx.type === "income") {
      const key = tx.description || "Sonstige Einnahmen";
      incomeByDesc[key] = (incomeByDesc[key] || 0) + tx.amount;
      totalIncome += tx.amount;
    } else {
      expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + tx.amount;
      totalExpense += tx.amount;
    }
  }

  const surplus = Math.max(0, totalIncome - totalExpense);

  // Build nodes and links for @nivo/sankey
  const nodeIds = new Set<string>();
  const links: { source: string; target: string; value: number }[] = [];

  // Income sources → Gesamtbudget
  for (const [desc, amount] of Object.entries(incomeByDesc)) {
    const nodeId = `income_${desc}`;
    nodeIds.add(nodeId);
    links.push({ source: nodeId, target: "budget", value: amount });
  }
  nodeIds.add("budget");

  // Gesamtbudget → Expense categories
  for (const [slug, amount] of Object.entries(expenseByCategory)) {
    const nodeId = `cat_${slug}`;
    nodeIds.add(nodeId);
    links.push({ source: "budget", target: nodeId, value: amount });
  }

  // Gesamtbudget → Überschuss
  if (surplus > 0) {
    nodeIds.add("surplus");
    links.push({ source: "budget", target: "surplus", value: surplus });
  }

  // Build node list with labels and colors
  const nodes = Array.from(nodeIds).map((id) => {
    if (id === "budget") return { id, label: "Gesamtbudget", color: "#6366f1" };
    if (id === "surplus") return { id, label: "Überschuss", color: "#22c55e" };
    if (id.startsWith("income_")) return { id, label: id.replace("income_", ""), color: "#3ecf8e" };
    if (id.startsWith("cat_")) {
      const slug = id.replace("cat_", "");
      const cat = catMap.get(slug);
      return {
        id,
        label: cat ? `${cat.icon} ${cat.name}` : slug,
        color: cat?.color || "#94a3b8",
      };
    }
    return { id, label: id, color: "#94a3b8" };
  });

  return NextResponse.json({ nodes, links });
}
