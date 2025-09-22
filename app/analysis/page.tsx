// /app/analysis/page.tsx
"use client"

import { useState, useEffect } from "react"
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { getAnalyticsFromDB, triggerLiveSync } from "@/actions/analysis"
import { AnalyticsSkeleton } from "./AnalyticsSkeleton"
import { Loader2, RefreshCw, AlertCircle } from "lucide-react"

// Define colors for pie charts
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#AF19FF", "#FF4560"]

// A reusable component for displaying a pie chart and a table
const DistributionChart = ({ title, data }: { title: string; data: { name: string; value: number }[] }) => (
  <Card className="flex flex-col">
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent className="flex-grow">
      {data.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center h-full">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="value" nameKey="name" label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value, name) => [value, name]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
          <div className="max-h-[250px] overflow-y-auto border rounded-md">
            <Table>
              <TableHeader><TableRow><TableHead>Value</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader>
              <TableBody>{data.map((item) => <TableRow key={item.name}><TableCell className="font-medium">{item.name}</TableCell><TableCell className="text-right">{item.value}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
        </div>
      ) : <p className="text-muted-foreground">No data available for this category.</p>}
    </CardContent>
  </Card>
);

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

  useEffect(() => {
    loadDataFromDB();
  }, []);

  const handleSyncClick = async () => {
    setIsSyncing(true);
    toast({ title: "Sync Started", description: "Fetching latest data from GoodGrants. This may take a while." });
    
    try {
      const result = await triggerLiveSync();
      if (result.success) {
        toast({ title: "Sync Successful", description: `${result.syncedCount} applications were updated or added.` });
        await loadDataFromDB(); // Refresh the page data from the DB
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

  return (
    <div className="p-6 space-y-6 bg-muted/20 min-h-screen container mx-auto py-8 px-4">
      <header className="flex flex-wrap gap-4 justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Applications Analysis</h1>
          <p className="text-muted-foreground">Displaying data from the local database.</p>
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
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader><CardTitle>Total Applications</CardTitle></CardHeader>
                <CardContent><p className="text-4xl font-bold">{data.totalApplications}</p></CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader><CardTitle>Application Growth Over Time</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.lineChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="count" stroke="#8884d8" activeDot={{ r: 8 }} name="Submissions"/>
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <div className="grid gap-6 lg:grid-cols-2">
              <DistributionChart title="Division by Category" data={data.categoryPieData} />
              <DistributionChart title="Division by Municipality" data={data.municipalityData} />
              <DistributionChart title="Division by PS Code" data={data.psCodeData} />
              <DistributionChart title="Division by Age Range" data={data.ageRangeData} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}