// shaibalsharif/csv-uploader-include-callforidea/csv-uploader-include-callForIdea-14a8d21d8fecb34cd17d5142be6dd196d290720c/app/analysis/AnalyticsSkeleton.tsx

"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center">
        <Skeleton className="h-9 w-64" />
        <div className="flex items-center space-x-4">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>

      {/* Top Stat Cards Skeleton */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <Card><CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
      </div>

      {/* Line Chart Skeleton */}
      <Card>
        <CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader>
        <CardContent><Skeleton className="h-[300px] w-full" /></CardContent>
      </Card>
      
      {/* MODIFIED: Skeleton for the new Stacked Bar Chart component */}
      <Card>
        <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
        <CardContent className="grid gap-8 md:grid-cols-2">
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
      
       <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
          <CardContent><Skeleton className="h-[350px] w-full" /></CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
          <CardContent><Skeleton className="h-[350px] w-full" /></CardContent>
        </Card>
        {/* Skeleton for Applicant Category Distribution Card */}
        <Card>
          <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
          <CardContent><Skeleton className="h-[350px] w-full" /></CardContent>
        </Card>
        {/* Placeholder for symmetric layout */}
        <Card>
          <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
          <CardContent><Skeleton className="h-[350px] w-full" /></CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
          <CardContent><Skeleton className="h-[350px] w-full" /></CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
          <CardContent><Skeleton className="h-[350px] w-full" /></CardContent>
        </Card>
      </div>
    </div>
  );
}