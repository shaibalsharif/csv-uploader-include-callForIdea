"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Loader2, Zap } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';


// Re-defining the necessary interface from Leaderboard.tsx (or a shared file)
interface SunburstNode {
  name: string;
  value?: number;
  children?: SunburstNode[];
}

interface SunburstAnalyticsProps {
  data: SunburstNode; // The hierarchical data
  isLoading: boolean;
}

// Custom Colors for the two levels
const LEVEL_1_COLORS = ['#3b82f6', '#10b981', '#f97316', '#ef4444', '#a855f7', '#6366f1'];
const LEVEL_2_COLORS = ['#14b8a6', '#f59e0b', '#2563eb', '#db2777', '#06b6d4', '#475569'];

// Custom Tooltip Content (optional, but helpful for debugging the data structure)
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    // The first payload item is the segment itself
    const item = payload[0];
    const isLeaf = item.payload.children === undefined;

    return (
      <div className="p-2 bg-background border rounded-md shadow-lg text-sm">
        <p className="font-bold">{item.name}</p>
        <p className="text-muted-foreground">
          {isLeaf ? 'Score' : 'Total Score'}: **{item.value?.toFixed(2)}**
        </p>
        {isLeaf && <p className="text-xs text-muted-foreground italic">Application Score</p>}
      </div>
    );
  }
  return null;
};

/**
 * Renders a two-level Sunburst approximation using Recharts PieChart.
 * The inner ring is Municipality, the outer ring is Category.
 */
export function SunburstAnalytics({ data, isLoading }: SunburstAnalyticsProps) {
  // Separate data into Level 1 (Municipality) and Level 2 (Category)
  const level1Data = useMemo(() => {
    return data.children?.map(muniNode => ({
      name: muniNode.name,
      value: muniNode.value, // Total score for the muni
      children: muniNode.children // Keep children for the next level mapping
    })) || [];
  }, [data]);

  const level2Data = useMemo(() => {
    // Flatten the children of all Level 1 nodes for the outer pie
    const allCategoryNodes: { name: string; value: number; parentMuni: string }[] = [];
    data.children?.forEach(muniNode => {
      muniNode.children?.forEach(categoryNode => {
        allCategoryNodes.push({
          name: categoryNode.name,
          value: categoryNode.value || 0,
          parentMuni: muniNode.name // Helps in coloring/tooltips if needed
        });
      });
    });
    return allCategoryNodes;
  }, [data]);

  if (isLoading) {
    return (
      <Card className="shadow-lg mb-6">
        <CardContent className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin mr-3" /> Loading Sunburst Data...
        </CardContent>
      </Card>
    );
  }

  if (level1Data.length === 0) {
    return (
      <Card className="shadow-lg mb-6">
        <CardContent className="py-24 text-center text-muted-foreground">
          No application data to display the Sunburst chart.
        </CardContent>
      </Card>
    );
  }

  // Create a color map for Level 1 names to ensure consistency in Level 2 coloring (optional but good practice)
  const muniColorMap = new Map(level1Data.map((d, i) => [d.name, LEVEL_1_COLORS[i % LEVEL_1_COLORS.length]]));

  return (
    <Card className="shadow-lg mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Zap className="h-4 w-4" /> Score Distribution by Region & Category</CardTitle>
        <CardDescription>Visual breakdown of total application scores across Municipalities (Inner Ring) and Categories (Outer Ring).</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[450px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              {/* Inner Ring (Level 1: Municipality) */}
              <Pie
                data={level1Data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80} // Inner ring size
                fill="#8884d8"
                labelLine={false}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              >
                {level1Data.map((entry, index) => (
                  <Cell key={`cell-l1-${index}`} fill={LEVEL_1_COLORS[index % LEVEL_1_COLORS.length]} />
                ))}
              </Pie>

              {/* Outer Ring (Level 2: Category) - Adjusted to appear as the next level */}
              <Pie
                data={level2Data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={90} // Start slightly after the inner ring ends
                outerRadius={140} // Outer ring size
                fill="#82ca9d"
                labelLine={false}
                // Custom label to ensure it fits, or you can disable it
                label={({ name, percent }) => name.substring(0, 12) + '...'}
              >
                {level2Data.map((entry, index) => (
                  // You can use a more complex color logic here based on the parentMuni
                  <Cell key={`cell-l2-${index}`} fill={LEVEL_2_COLORS[index % LEVEL_2_COLORS.length]} />
                ))}
              </Pie>

              <Tooltip content={<CustomTooltip />} />

            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}