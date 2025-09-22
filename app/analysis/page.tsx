"use client";

import { useState, useEffect, ReactNode } from "react";
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { getAnalyticsFromDB, triggerLiveSync } from "@/actions/analysis";
import { AnalyticsSkeleton } from "./AnalyticsSkeleton";
import { FlippableCard } from "./FlippableCard";
import { SunburstAnalysis } from "./SunburstAnalysis";
import { Loader2, RefreshCw, AlertCircle, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";


const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#AF19FF", "#FF4560", "#6A3E90"];

// --- Helper Components Specific to this Page ---

/**
 * Formats a date string with an ordinal suffix for the day (e.g., "25th Aug, 2025").
 * @param dateString - An ISO date string.
 * @returns A formatted date string.
 */
const formatDateWithOrdinal = (dateString: string): string => {
  const date = new Date(dateString);
  const day = date.getUTCDate();
  let suffix = 'th';
  if (day % 10 === 1 && day !== 11) suffix = 'st';
  else if (day % 10 === 2 && day !== 12) suffix = 'nd';
  else if (day % 10 === 3 && day !== 13) suffix = 'rd';

  const month = date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const year = date.getUTCFullYear();

  return `${day}${suffix} ${month}, ${year}`;
};

/**
 * Renders the legend for pie charts as a series of styled badges.
 */
const CustomLegend = ({ payload }: any) => {
  if (!payload || !payload.length) {
    return null;
  }
  return (
    <div className="flex items-center justify-center flex-wrap gap-2">
      {payload.map((entry: any, index: number) => (
        <Badge key={`item-${index}`} variant="outline" className="flex items-center gap-1.5 px-2 py-1">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs font-medium">{entry.value}</span>
        </Badge>
      ))}
    </div>
  );
};

/**
 * Renders the pie chart graphic with refined styling.
 */
// MODIFIED: PieChartGraphic now has a larger outerRadius
const PieChartGraphic = ({ data }: { data: { name: string, value: number }[] }) => (
  <ResponsiveContainer width="100%" height={350}>
    <PieChart>
      <Pie
        data={data}
        cx="50%"
        cy="45%"
        labelLine={false}
        // MODIFIED: Increased pie size
        outerRadius={100}
        fill="#8884d8"
        dataKey="value"
        nameKey="name"
        label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
          // Increased radius for label positioning to match new outerRadius
          const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
          const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
          const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
          if ((percent * 100) < 5) return null;
          return (
            <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-sm font-bold">
              {`${(percent * 100).toFixed(0)}%`}
            </text>
          );
        }}
      >
        {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
      </Pie>
      <Tooltip formatter={(value: number, name: string) => [`${value} Applications`, name]} />
      <Legend content={<CustomLegend />} wrapperStyle={{ paddingTop: "30px" }} />
    </PieChart>
  </ResponsiveContainer>
);

/**
 * Renders the data table for the back of the flippable cards.
 */
const TableGraphic = ({ data }: { data: { name: string, value: number }[] }) => (
  <div className="max-h-[250px] overflow-y-auto border rounded-md">
    <Table>
      <TableHeader><TableRow><TableHead>Value</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader>
      <TableBody>{data.map((item, index) => <TableRow key={`${item.name}-${index}`}><TableCell className="font-medium">{item.name}</TableCell><TableCell className="text-right">{item.value}</TableCell></TableRow>)}</TableBody>
    </Table>
  </div>
);

/**
 * Renders a custom tooltip for the line chart, showing daily and cumulative totals.
 */
const CustomLineChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="p-3 bg-background border rounded-md shadow-lg">
        <p className="font-bold text-sm">{formatDateWithOrdinal(label)}</p>
        <p className="text-sm text-primary">Submissions this day: <strong>{data.count}</strong></p>
        <p className="text-sm text-muted-foreground">Total to date: <strong>{data.total}</strong></p>
      </div>
    );
  }
  return null;
};

// --- Main Page Component ---

export default function AnalysisPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const loadDataFromDB = async () => {
    const result = await getAnalyticsFromDB();
    if (result.error) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
    setData(result);
    setIsLoading(false);
  };

  useEffect(() => { loadDataFromDB(); }, []);

  const handleSyncClick = async () => {
    setIsSyncing(true);
    toast({ title: "Sync Started", description: "Fetching latest data from GoodGrants. This may take a while." });

    try {
      const result = await triggerLiveSync();
      if (result.success) {
        toast({ title: "Sync Successful", description: `${result.syncedCount} applications were updated or added.` });
        await loadDataFromDB();
      } else {
        throw new Error(result.error || "An unknown error occurred during sync.");
      }
    } catch (error: any) {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return <div className="p-6"><AnalyticsSkeleton /></div>;
  }

  if (data?.error || !data) {
    return <div className="text-center text-red-500 mt-10 p-6">Error loading dashboard. Please try again.</div>
  }

  const lastSyncDate = data.lastSyncTime ? new Date(data.lastSyncTime) : null;
  const timeSinceSync = lastSyncDate ? `about ${Math.round((new Date().getTime() - lastSyncDate.getTime()) / 60000)} minutes ago` : 'never';
  const topMunicipalities = data.municipalityData?.slice(0, 4) || [];

  return (
    <div className="p-6 space-y-6 bg-muted/20 min-h-screen">
      <header className="flex flex-wrap gap-4 justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back to Home</span>
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Applications Analysis</h1>
            <p className="text-muted-foreground">Displaying data from the local database.</p>
          </div>
        </div>
        <div className="border p-3 rounded-lg bg-background flex items-center space-x-4">
          <div className="text-right">
            <p className="text-sm font-medium">Data Last Updated</p>
            <p className="text-sm text-muted-foreground font-mono" title={lastSyncDate?.toLocaleString()}>{lastSyncDate ? timeSinceSync : 'N/A'}</p>
          </div>
          <Button onClick={handleSyncClick} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {isSyncing ? "Syncing..." : "Sync Now"}
          </Button>
        </div>
      </header>

      <main>
        {data.isEmpty ? (
          <Card className="text-center p-10">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
            <CardTitle className="mt-4">No Data Found</CardTitle>
            <CardDescription className="mt-2">Your local database is empty. Click "Sync Now" to populate it with data from GoodGrants.</CardDescription>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
              <Card className="transition-all duration-300 hover:shadow-xl">
                <CardHeader className="pb-2"><CardTitle className="text-base font-medium">Total Applications</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{data.totalApplications}</p></CardContent>
              </Card>
              {topMunicipalities.map((muni: { name: string, value: number }) => (
                <Card key={muni.name} className="transition-all duration-300 hover:shadow-xl">
                  <CardHeader className="pb-2"><CardTitle className="text-base font-medium">{muni.name}</CardTitle></CardHeader>
                  <CardContent><p className="text-2xl font-bold">{muni.value}</p></CardContent>
                </Card>
              ))}
            </div>

            <Card className="transition-all duration-300 hover:shadow-xl">
              <CardHeader><CardTitle>Application Growth Over Time</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.lineChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateWithOrdinal}
                      interval={4}
                    />
                    <YAxis allowDecimals={false} />
                    <Tooltip content={<CustomLineChartTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey="count" stroke="#8884d8" activeDot={{ r: 8 }} name="Submissions" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <SunburstAnalysis apps={data.rawApps} />

            <div className="grid gap-8 lg:grid-cols-2">
              <FlippableCard title="Division by Category" chartComponent={<PieChartGraphic data={data.categoryPieData} />} tableComponent={<TableGraphic data={data.categoryPieData} />} />
              <FlippableCard title="Division by Municipality" chartComponent={<PieChartGraphic data={data.municipalityData} />} tableComponent={<TableGraphic data={data.municipalityData} />} />
              <FlippableCard title="Division by PS Code" chartComponent={<PieChartGraphic data={data.psCodeData} />} tableComponent={<TableGraphic data={data.psCodeData} />} />
              <FlippableCard title="Division by Age Range" chartComponent={<PieChartGraphic data={data.ageRangeData} />} tableComponent={<TableGraphic data={data.ageRangeData} />} />
              <FlippableCard title="Division by Gender" chartComponent={<PieChartGraphic data={data.genderData} />} tableComponent={<TableGraphic data={data.genderData} />} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}