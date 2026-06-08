import { Suspense } from "react";
import CategoriesClient from "./categories-client";
import { Skeleton } from "@/components/ui/skeleton";

export default function CategoriesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
      <CategoriesClient />
    </Suspense>
  );
}
