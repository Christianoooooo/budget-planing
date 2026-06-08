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
      query = { date: { $regex: `^${year}-${monthPadded}` } };
    }

    const transactions = await Transaction.find(query).sort({ date: -1 }).lean();

    const headers = ['Datum', 'Beschreibung', 'Typ', 'Kategorie', 'Betrag (EUR)', 'Wiederkehrend'];
    const rows = transactions.map((t) => [
      t.date,
      `"${t.description}"`,
      t.type === 'income' ? 'Einnahme' : t.type === 'expense' ? 'Ausgabe' : 'Fixkosten',
      t.category,
      t.amount.toFixed(2).replace('.', ','),
      t.recurring || '',
    ]);

    const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="transaktionen-${year || 'alle'}-${month || 'alle'}.csv"`,
      },
    });
  } catch (error) {
    console.error('GET /api/export/csv error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
