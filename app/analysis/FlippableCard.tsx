"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Replace } from "lucide-react";

type FlippableCardProps = {
  title: string;
  chartComponent: React.ReactNode;
  tableComponent: React.ReactNode;
};

export function FlippableCard({ title, chartComponent, tableComponent }: FlippableCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div className={`flip-card min-h-[420px] ${isFlipped ? "flipped" : ""}`}>
      <div className="flip-card-inner">
        {/* Front of the Card (displays the chart) */}
        <div className="flip-card-front">
          <Card className="flex flex-col flex-grow transition-all duration-300 hover:shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{title}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setIsFlipped(true)}>
                <Replace className="h-4 w-4" />
                <span className="sr-only">Show Table</span>
              </Button>
            </CardHeader>
            <CardContent className="flex-grow">{chartComponent}</CardContent>
          </Card>
        </div>

        {/* Back of the Card (displays the table) */}
        <div className="flip-card-back">
          <Card className="flex flex-col flex-grow transition-all duration-300 hover:shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{title}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setIsFlipped(false)}>
                <Replace className="h-4 w-4" />
                <span className="sr-only">Show Chart</span>
              </Button>
            </CardHeader>
            <CardContent className="flex-grow">{tableComponent}</CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}