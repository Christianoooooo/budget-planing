import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import PlannerClient from "./planner-client";

export default function PlannerPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string };
}) {
  const now = new Date();
  const year  = parseInt(searchParams.year  || String(now.getFullYear()));
  const month = parseInt(searchParams.month || String(now.getMonth() + 1));

  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <PlannerClient year={year} month={month} />
    </Suspense>
  );
}
