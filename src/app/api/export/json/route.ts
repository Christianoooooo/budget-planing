import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Transaction from '@/lib/models/Transaction';
import Category from '@/lib/models/Category';
import Settings from '@/lib/models/Settings';

export async function GET() {
  try {
    await connectDB();
    const transactions = await Transaction.find({}).lean();
    const categories = await Category.find({}).lean();
    const settingsArr = await Settings.find({}).lean();
    const settings: Record<string, unknown> = {};
    settingsArr.forEach((s) => { settings[s.key] = s.value; });

    const data = { transactions, categories, settings, exportedAt: new Date().toISOString() };

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="budget-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error('GET /api/export/json error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { transactions, categories, settings } = body;

    if (categories && Array.isArray(categories)) {
      await Category.deleteMany({});
      await Category.insertMany(categories.map((c: Record<string, unknown>) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _id, __v, createdAt, updatedAt, ...rest } = c as Record<string, unknown>;
        return rest;
      }));
    }

    if (transactions && Array.isArray(transactions)) {
      await Transaction.deleteMany({});
      await Transaction.insertMany(transactions.map((t: Record<string, unknown>) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _id, __v, createdAt, updatedAt, ...rest } = t as Record<string, unknown>;
        return rest;
      }));
    }

    if (settings && typeof settings === 'object') {
      for (const [key, value] of Object.entries(settings)) {
        await Settings.findOneAndUpdate({ key }, { key, value }, { upsert: true });
      }
    }

    return NextResponse.json({ success: true, message: 'Import successful' });
  } catch (error) {
    console.error('POST /api/export/json error:', error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
