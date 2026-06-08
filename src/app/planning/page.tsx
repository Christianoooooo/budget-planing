import { Suspense } from "react";
import PlanningClient from "./planning-client";
import { Skeleton } from "@/components/ui/skeleton";

export default function PlanningPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string };
}) {
  const now = new Date();
  const year = parseInt(searchParams.year || String(now.getFullYear()));
  const month = parseInt(searchParams.month || String(now.getMonth() + 1));

  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
      <PlanningClient year={year} month={month} />
    </Suspense>
  );
}
