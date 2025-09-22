// /actions/analysis.ts
"use server"

import { sql } from "@vercel/postgres"

// Helper function to extract specific field values from the JSONB column
const extractFieldValue = (app: any, slug: string) => {
  const field = app.raw_fields?.find((f: any) => f.slug === slug)
  // GoodGrants stores selectable values in an object like { "en": "Value" }
  return field?.value?.en || "N/A"
}

export async function getAnalyticsData() {
  try {
    const { rows: apps } = await sql`SELECT slug, updated_at, category, raw_fields FROM goodgrants_applications;`

    // --- 1. Total Applications ---
    const totalApplications = apps.length

    // --- 2. Date-wise Growth (Line Chart) ---
    const growthData = apps.reduce((acc, app) => {
      const date = new Date(app.updated_at).toISOString().split("T")[0] // Group by day
      acc[date] = (acc[date] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const lineChartData = Object.entries(growthData)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // --- 3. Category Division (Pie Chart) ---
    const categoryData = apps.reduce((acc, app) => {
      const categoryName = app.category?.title?.en || "Uncategorized"
      acc[categoryName] = (acc[categoryName] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const categoryPieData = Object.entries(categoryData).map(([name, value]) => ({ name, value }))

    // --- 4. Specific Field Analyses (Pie Chart & Table) ---
    const analyzeField = (slug: string) => {
      const counts = apps.reduce((acc, app) => {
        const value = extractFieldValue(app, slug)
        acc[value] = (acc[value] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return Object.entries(counts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value) // Sort for table view
    }
    
    // Replace 'YOUR_PS_CODE_FIELD_SLUG' with the actual slug for that field.
    // To find it, inspect the 'raw_fields' JSON in your database for an application
    // where you know the value is "Siraj-PS-1", etc.
    const psCodeSlug = "YOUR_PS_CODE_FIELD_SLUG" 

    const municipalityData = analyzeField("rDkKljjz")
    const psCodeData = analyzeField(psCodeSlug)
    const ageRangeData = analyzeField("xjzONPwj")

    return {
      totalApplications,
      lineChartData,
      categoryPieData,
      municipalityData,
      psCodeData,
      ageRangeData,
    }
  } catch (error: any) {
    console.error("Failed to get analytics data:", error)
    // Return empty state on error
    return {
      totalApplications: 0,
      lineChartData: [],
      categoryPieData: [],
      municipalityData: [],
      psCodeData: [],
      ageRangeData: [],
      error: "Could not load analytics data from the database.",
    }
  }
}