import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITransaction extends Document {
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'fixed';
  category: string;
  date: string;
  recurring: 'monthly' | 'weekly' | null;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ['income', 'expense', 'fixed'], required: true },
    category: { type: String, required: true },
    date: { type: String, required: true },
    recurring: { type: String, enum: ['monthly', 'weekly', null], default: null },
  },
  { timestamps: true }
);

const Transaction: Model<ITransaction> =
  mongoose.models.Transaction || mongoose.model<ITransaction>('Transaction', TransactionSchema);

export default Transaction;
