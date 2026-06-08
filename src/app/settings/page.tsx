import { Suspense } from "react";
import SettingsClient from "./settings-client";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
      <SettingsClient />
    </Suspense>
  );
}
