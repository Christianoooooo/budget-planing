import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import MonthPlan from "@/lib/models/MonthPlan";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await connectDB();
  const { searchParams } = new URL(req.url);
  const year  = parseInt(searchParams.get("year")  || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));

  const plan = await MonthPlan.findOne({ year, month }).lean();
  return NextResponse.json(plan || { year, month, plannedIncome: 0, categoryPlans: [] });
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  const { year, month, plannedIncome, categoryPlans } = body;

  if (!year || !month) {
    return NextResponse.json({ error: "year and month required" }, { status: 400 });
  }

  const plan = await MonthPlan.findOneAndUpdate(
    { year, month },
    { plannedIncome, categoryPlans },
    { upsert: true, new: true }
  );
  return NextResponse.json(plan);
}
