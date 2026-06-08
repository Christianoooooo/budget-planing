import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Transaction from '@/lib/models/Transaction';
import Category from '@/lib/models/Category';
import Settings from '@/lib/models/Settings';

const DEFAULT_CATEGORIES = [
  { slug: 'wohnen', name: 'Wohnen', icon: '🏠', color: '#6366f1', budget: 1200, isDefault: true },
  { slug: 'lebensmittel', name: 'Lebensmittel', icon: '🛒', color: '#22c55e', budget: 400, isDefault: true },
  { slug: 'transport', name: 'Transport', icon: '🚗', color: '#f59e0b', budget: 200, isDefault: true },
  { slug: 'freizeit', name: 'Freizeit', icon: '🎮', color: '#ec4899', budget: 150, isDefault: true },
  { slug: 'gesundheit', name: 'Gesundheit', icon: '💊', color: '#14b8a6', budget: 100, isDefault: true },
  { slug: 'versicherung', name: 'Versicherung', icon: '🛡️', color: '#8b5cf6', budget: 250, isDefault: true },
  { slug: 'sparen', name: 'Sparen', icon: '💰', color: '#f97316', budget: 500, isDefault: true },
  { slug: 'einkommen', name: 'Einkommen', icon: '💼', color: '#84cc16', budget: 0, isDefault: true },
  { slug: 'sonstiges', name: 'Sonstiges', icon: '📦', color: '#64748b', budget: 100, isDefault: true },
];

function getDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export async function POST() {
  try {
    await connectDB();

    const existingCount = await Transaction.countDocuments();
    if (existingCount > 0) {
      return NextResponse.json({ message: 'Data already exists, skipping seed' });
    }

    // Seed categories
    await Category.deleteMany({});
    await Category.insertMany(DEFAULT_CATEGORIES);

    // Seed settings
    await Settings.findOneAndUpdate(
      { key: 'savingsGoal' },
      { key: 'savingsGoal', value: 500 },
      { upsert: true }
    );
    await Settings.findOneAndUpdate(
      { key: 'currency' },
      { key: 'currency', value: 'EUR' },
      { upsert: true }
    );

    // Seed transactions - current month (June 2026)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const currentMonthTransactions = [
      { description: 'Gehalt Juni', amount: 3200, type: 'income', category: 'einkommen', date: getDateString(currentYear, currentMonth, 1), recurring: 'monthly' },
      { description: 'Nebenjob', amount: 450, type: 'income', category: 'einkommen', date: getDateString(currentYear, currentMonth, 5), recurring: null },
      { description: 'Miete', amount: 950, type: 'fixed', category: 'wohnen', date: getDateString(currentYear, currentMonth, 1), recurring: 'monthly' },
      { description: 'Strom & Gas', amount: 89, type: 'fixed', category: 'wohnen', date: getDateString(currentYear, currentMonth, 3), recurring: 'monthly' },
      { description: 'Internet', amount: 39.99, type: 'fixed', category: 'wohnen', date: getDateString(currentYear, currentMonth, 3), recurring: 'monthly' },
      { description: 'REWE Wocheneinkauf', amount: 87.45, type: 'expense', category: 'lebensmittel', date: getDateString(currentYear, currentMonth, 4), recurring: null },
      { description: 'Bäckerei', amount: 12.50, type: 'expense', category: 'lebensmittel', date: getDateString(currentYear, currentMonth, 6), recurring: null },
      { description: 'REWE Wocheneinkauf', amount: 94.20, type: 'expense', category: 'lebensmittel', date: getDateString(currentYear, currentMonth, 11), recurring: null },
      { description: 'Tankstelle', amount: 65, type: 'expense', category: 'transport', date: getDateString(currentYear, currentMonth, 8), recurring: null },
      { description: 'ÖPNV Monatsticket', amount: 49, type: 'fixed', category: 'transport', date: getDateString(currentYear, currentMonth, 1), recurring: 'monthly' },
      { description: 'Kino mit Freunden', amount: 28, type: 'expense', category: 'freizeit', date: getDateString(currentYear, currentMonth, 7), recurring: null },
      { description: 'Spotify Premium', amount: 9.99, type: 'fixed', category: 'freizeit', date: getDateString(currentYear, currentMonth, 10), recurring: 'monthly' },
      { description: 'Apotheke', amount: 24.80, type: 'expense', category: 'gesundheit', date: getDateString(currentYear, currentMonth, 9), recurring: null },
      { description: 'KFZ-Versicherung', amount: 89, type: 'fixed', category: 'versicherung', date: getDateString(currentYear, currentMonth, 1), recurring: 'monthly' },
      { description: 'Haftpflichtversicherung', amount: 15, type: 'fixed', category: 'versicherung', date: getDateString(currentYear, currentMonth, 1), recurring: 'monthly' },
      { description: 'Sparplan ETF', amount: 300, type: 'fixed', category: 'sparen', date: getDateString(currentYear, currentMonth, 1), recurring: 'monthly' },
      { description: 'Restaurant', amount: 45.60, type: 'expense', category: 'freizeit', date: getDateString(currentYear, currentMonth, 13), recurring: null },
      { description: 'Amazon Bestellung', amount: 34.99, type: 'expense', category: 'sonstiges', date: getDateString(currentYear, currentMonth, 5), recurring: null },
    ];

    // Historical data for past 5 months
    const historicalTransactions = [];
    for (let i = 1; i <= 5; i++) {
      let hMonth = currentMonth - i;
      let hYear = currentYear;
      if (hMonth <= 0) {
        hMonth += 12;
        hYear -= 1;
      }
      historicalTransactions.push(
        { description: 'Gehalt', amount: 3200, type: 'income', category: 'einkommen', date: getDateString(hYear, hMonth, 1), recurring: 'monthly' },
        { description: 'Miete', amount: 950, type: 'fixed', category: 'wohnen', date: getDateString(hYear, hMonth, 1), recurring: 'monthly' },
        { description: 'Strom & Gas', amount: 89, type: 'fixed', category: 'wohnen', date: getDateString(hYear, hMonth, 3), recurring: 'monthly' },
        { description: 'Internet', amount: 39.99, type: 'fixed', category: 'wohnen', date: getDateString(hYear, hMonth, 3), recurring: 'monthly' },
        { description: 'Lebensmittel', amount: Math.round((200 + Math.random() * 150) * 100) / 100, type: 'expense', category: 'lebensmittel', date: getDateString(hYear, hMonth, 15), recurring: null },
        { description: 'Transport', amount: Math.round((80 + Math.random() * 60) * 100) / 100, type: 'expense', category: 'transport', date: getDateString(hYear, hMonth, 10), recurring: null },
        { description: 'Freizeit', amount: Math.round((50 + Math.random() * 100) * 100) / 100, type: 'expense', category: 'freizeit', date: getDateString(hYear, hMonth, 20), recurring: null },
        { description: 'Versicherungen', amount: 104, type: 'fixed', category: 'versicherung', date: getDateString(hYear, hMonth, 1), recurring: 'monthly' },
        { description: 'Sparplan ETF', amount: 300, type: 'fixed', category: 'sparen', date: getDateString(hYear, hMonth, 1), recurring: 'monthly' },
      );
    }

    await Transaction.insertMany([...currentMonthTransactions, ...historicalTransactions]);

    return NextResponse.json({ message: 'Seed successful', categories: DEFAULT_CATEGORIES.length });
  } catch (error) {
    console.error('POST /api/seed error:', error);
    return NextResponse.json({ error: 'Seed failed' }, { status: 500 });
  }
}
