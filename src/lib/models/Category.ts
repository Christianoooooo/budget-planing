import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICategory extends Document {
  slug: string;
  name: string;
  icon: string;
  color: string;
  budget: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    icon: { type: String, required: true },
    color: { type: String, required: true },
    budget: { type: Number, required: true, default: 0 },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Category: Model<ICategory> =
  mongoose.models.Category || mongoose.model<ICategory>('Category', CategorySchema);

export default Category;
