import mongoose, { Schema, Document, Model } from "mongoose";

interface CategoryPlan {
  slug: string;
  planned: number;
}

export interface IMonthPlan extends Document {
  year: number;
  month: number;
  plannedIncome: number;
  categoryPlans: CategoryPlan[];
  createdAt: Date;
  updatedAt: Date;
}

const CategoryPlanSchema = new Schema<CategoryPlan>(
  { slug: { type: String, required: true }, planned: { type: Number, required: true, default: 0 } },
  { _id: false }
);

const MonthPlanSchema = new Schema<IMonthPlan>(
  {
    year:  { type: Number, required: true },
    month: { type: Number, required: true },
    plannedIncome: { type: Number, required: true, default: 0 },
    categoryPlans: { type: [CategoryPlanSchema], default: [] },
  },
  { timestamps: true }
);

MonthPlanSchema.index({ year: 1, month: 1 }, { unique: true });

const MonthPlan: Model<IMonthPlan> =
  mongoose.models.MonthPlan || mongoose.model<IMonthPlan>("MonthPlan", MonthPlanSchema);

export default MonthPlan;
