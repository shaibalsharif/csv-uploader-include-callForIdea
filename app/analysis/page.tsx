// /app/manager/analysis/page.tsx
"use client"

import { useState, useEffect } from "react"
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getAnalyticsData } from "@/actions/analysis"
import { Loader2 } from "lucide-react"

// Define colors for pie charts
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#AF19FF", "#FF4560"]

// A reusable component for displaying a pie chart and a table
const DistributionChart = ({ title, data }: { title: string; data: { name: string; value: number }[] }) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent>
      {data.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="value" nameKey="name" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="max-h-[250px] overflow-y-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Value</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item) => (
                  <TableRow key={item.name}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-right">{item.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground">No data available.</p>
      )}
    </CardContent>
  </Card>
)

export default function AnalysisPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAnalyticsData().then((result) => {
      setData(result)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin" />
        <p className="ml-4 text-lg">Loading Analytics Dashboard...</p>
      </div>
    )
  }
  
  if (data?.error) {
     return <div className="text-center text-red-500 mt-10">{data.error}</div>
  }

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-3xl font-bold">Applications Analysis</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{data.totalApplications}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Application Growth Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.lineChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false}/>
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="count" stroke="#8884d8" activeDot={{ r: 8 }} name="Applications"/>
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-1">
        <DistributionChart title="Division by Category" data={data.categoryPieData} />
        <DistributionChart title="Division by Municipality" data={data.municipalityData} />
        <DistributionChart title="Division by PS Code" data={data.psCodeData} />
        <DistributionChart title="Division by Age Range" data={data.ageRangeData} />
      </div>
    </div>
  )
}