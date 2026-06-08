import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Transaction from '@/lib/models/Transaction';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    let query: Record<string, unknown> = {};
    if (year && month) {
      const monthPadded = month.padStart(2, '0');
      query = {
        date: { $regex: `^${year}-${monthPadded}` },
      };
    } else if (year) {
      query = { date: { $regex: `^${year}-` } };
    }

    const transactions = await Transaction.find(query).sort({ date: -1 }).lean();
    return NextResponse.json(transactions);
  } catch (error) {
    console.error('GET /api/transactions error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { description, amount, type, category, date, recurring } = body;

    if (!description || amount === undefined || !type || !category || !date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const transaction = await Transaction.create({
      description,
      amount: Number(amount),
      type,
      category,
      date,
      recurring: recurring || null,
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error('POST /api/transactions error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
