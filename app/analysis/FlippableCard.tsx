"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Replace } from "lucide-react";

type FlippableCardProps = {
  title: string;
  chartComponent: React.ReactNode;
  tableComponent: React.ReactNode;
  onFlip?: () => void;
};

export function FlippableCard({ title, chartComponent, tableComponent, onFlip }: FlippableCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    if (onFlip) {
      setTimeout(onFlip, 50);
    }
  };

  return (
    <div className={`flip-card min-h-[420px] ${isFlipped ? "flipped" : ""}`}>
      <div className="flip-card-inner">
        {/* Front of the Card (Chart) */}
        <div className="flip-card-front">
          <Card className="flex flex-col h-full transition-all duration-300 hover:shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{title}</CardTitle>
              <Button variant="ghost" size="icon" onClick={handleFlip}>
                <Replace className="h-4 w-4" />
                <span className="sr-only">Show Table</span>
              </Button>
            </CardHeader>
            {/* MODIFIED: Added `min-h-0` to allow the content area to shrink correctly */}
            <CardContent className="flex-grow min-h-0">{chartComponent}</CardContent>
          </Card>
        </div>

        {/* Back of the Card (Table) */}
        <div className="flip-card-back">
          <Card className="flex flex-col h-full transition-all duration-300 hover:shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{title}</CardTitle>
              <Button variant="ghost" size="icon" onClick={handleFlip}>
                <Replace className="h-4 w-4" />
                <span className="sr-only">Show Chart</span>
              </Button>
            </CardHeader>
            {/* MODIFIED: Added `min-h-0` for consistency */}
            <CardContent className="flex-grow min-h-0">{tableComponent}</CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}