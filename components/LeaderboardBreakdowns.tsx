// csv-uploader-include-callForIdea/components/LeaderboardBreakdowns.tsx

"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Zap, Circle, User, Layers } from "lucide-react";
import type { AppRawData } from '@/actions/analysis';
import { cn } from '@/lib/utils';
import { Skeleton } from "@/components/ui/skeleton";

// Define the interface that Leaderboard passes (full app data + score info)
interface FilteredAppRawData extends AppRawData {
    totalScore: number;
    municipality: string;
}

interface LeaderboardBreakdownsProps {
    filteredApps: FilteredAppRawData[];
    isLoading: boolean;
}

// --- Helper Functions from StackedBarAnalysis (Adapted) ---

const extractFieldValue = (app: FilteredAppRawData, slug: string): string => {
    // FIX: Add check for app.raw_fields being null/undefined before calling .find()
    const rawFields = (app.raw_fields as any[]) || [];
    const field = rawFields.find((f: any) => f.slug === slug);
    const value = field?.value;
    if (typeof value === 'object' && value !== null) {
        return field?.translated?.en_GB || value.en_GB || value.en || JSON.stringify(value);
    }
    // FIX: Check if value is a string before calling .split()
    return value !== null && value !== undefined && typeof value === 'string' ? value.split(" - [")[0].trim() : "N/A";
};

const extractPsCodeValue = (app: FilteredAppRawData, possibleSlugs: string[]): string => {
    // FIX: Add check for app.raw_fields being null/undefined before calling .find()
    const rawFields = (app.raw_fields as any[]) || [];
    const field = rawFields.find((f: any) => possibleSlugs.includes(f.slug));
    return field?.value || "N/A";
};

// NEW HELPER: Get translated text for PS Code
const getPsCodeTranslation = (app: FilteredAppRawData, possibleSlugs: string[]): string => {
    const rawFields = (app.raw_fields as any[]) || [];
    const field = rawFields.find((f: any) => possibleSlugs.includes(f.slug));
    return field?.translated?.en_GB || "";
};

const abbreviateAgeLabel = (label: string): string => {
    if (label.toLowerCase().includes('below 18')) return '< 18';
    if (label.toLowerCase().includes('above 65')) return '> 65';
    // FIX: Abbreviate the label more consistently and remove the space
    return label.replace(/\s*years\s*/, '-years').replace(/\s/g, '').replace(/^-/, '').trim();
};

const dimensionMap = {
    // FIX: Updated order list to match the output of abbreviateAgeLabel
    age: { label: "Age Range Breakdown", slug: 'xjzONPwj', icon: User, order: ['< 18', '18-25-years', '26-35-years', '36-45-years', '46-55-years', '56-65-years', '> 65'] },
    gender: { label: "Gender Breakdown", slug: 'rojNQzOz', icon: Circle, order: ['Male', 'Female', 'Other', 'N/A'] },
    psCode: { label: "Challenge Statement Breakdown", slug: ['gkknPnQp', 'jDJaNYGG', 'RjAnzBZJ', 'OJBPQyGP'], icon: Layers, order: [] },
    category: { label: "Category Breakdown", slug: 'category', icon: Zap, order: [] },
};

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#AF19FF", "#FF4560", "#6A3E90"];

// --- Core Data Processing Logic (MODIFIED for aggregation of non-category dimensions) ---

const processBreakdownData = (apps: FilteredAppRawData[], dimension: 'age' | 'gender' | 'psCode' | 'category') => {
    // 1. Group all filtered apps by the dimension key globally
    const groupedByDimension = apps.reduce((acc, app) => {
        let key;
        switch (dimension) {
            case 'age':
                key = abbreviateAgeLabel(extractFieldValue(app, dimensionMap.age.slug));
                break;
            case 'psCode':
                key = extractPsCodeValue(app, dimensionMap.psCode.slug as string[]);
                break;
            case 'gender':
                key = extractFieldValue(app, dimensionMap.gender.slug);
                break;
            case 'category':
                key = app.category?.name?.en_GB || "Uncategorized";
                break;
            default:
                key = 'N/A';
        }
        if (!acc[key]) {
            acc[key] = { apps: [] };
        }
        acc[key].apps.push(app);
        return acc;
    }, {} as Record<string, { apps: FilteredAppRawData[] }>);

    const municipalNames = [...new Set(apps.map(a => a.municipality || 'N/A'))].filter(m => m !== 'N/A');
    const allCategories = [...new Set(apps?.map((app: FilteredAppRawData) => app.category?.name?.en_GB || "Uncategorized"))].sort();

    // === Case 1: Category Breakdown (Pivot by Municipality) - Unchanged functional logic ===
    if (dimension === 'category') {
        const transformedData: Record<string, any>[] = [];

        allCategories.forEach(catName => {
            const row: Record<string, any> = { name: catName };
            let totalCount = 0;
            municipalNames.forEach(muniName => {
                // Filter the apps grouped by category by municipality to pivot the data
                const muniApps = groupedByDimension[catName]?.apps.filter(app => (app.municipality || 'N/A') === muniName) || [];
                const muniCount = muniApps.length;
                row[muniName] = muniCount;
                totalCount += muniCount;
            });

            if (totalCount > 0) {
                transformedData.push(row);
            }
        });

        // The stacking keys are the municipal names
        return [{
            municipality: "Category Breakdown (All Municipalities)",
            data: transformedData,
            stackKeys: municipalNames
        }];
    }

    // === Case 2: Other Breakdowns (Age, Gender, PS Code) - Aggregated Logic ===

    const aggregatedData = Object.entries(groupedByDimension)?.map(([name, dimGroup]) => {
        const counts = allCategories.reduce((acc, category) => {
            acc[category] = 0;
            return acc;
        }, {} as Record<string, number>);

        dimGroup.apps.forEach((app: FilteredAppRawData) => {
            const category = app.category?.name?.en_GB || "Uncategorized";
            if (counts[category] !== undefined) counts[category]++;
        });

        const total = dimGroup.apps.length; 
        
        let translation = "";
        if (dimension === 'psCode' && dimGroup.apps.length > 0) {
            // Include the translation
            translation = getPsCodeTranslation(dimGroup.apps[0], dimensionMap.psCode.slug as string[]);
        }

        return { name, ...counts, total, translation };
    }).sort((a, b) => {
        const order = dimensionMap[dimension]?.order || [];

        if (dimension === 'psCode') {
            // PS Code natural sort logic for Char-PS-1, Char-PS-2, etc.
            const regex = /^([a-z]+)-ps-(\d+)$/i;
            const aMatch = a.name.match(regex);
            const bMatch = b.name.match(regex);

            if (aMatch && bMatch) {
                const aPrefix = aMatch[1];
                const bPrefix = bMatch[1];
                const aNum = parseInt(aMatch[2], 10);
                const bNum = parseInt(bMatch[2], 10);

                if (aPrefix !== bPrefix) {
                    return aPrefix.localeCompare(bPrefix);
                }
                return aNum - bNum;
            }
            return a.name.localeCompare(b.name);
        }

        // Use predefined order if available
        if (order.length > 0) {
            return order.indexOf(a.name) - order.indexOf(b.name);
        }
        return a.name.localeCompare(b.name);
    });

    // Return an array with a single element containing the aggregated data.
    return [{ municipality: "All Filtered Data (Aggregated)", data: aggregatedData }];
};


// Custom tooltip for generic stacked bar
const GenericTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        // FIX: Safely access payload[0].payload.total
        const total = payload[0]?.payload?.total || payload.reduce((sum: number, entry: any) => sum + entry.value, 0);
        
        // NEW: Safely get the translation from the payload data
        const translation = payload[0]?.payload?.translation;


        return (
            <div className="p-3 bg-background border rounded-md shadow-lg text-sm">
                <p className="font-bold mb-1">{label}</p>
                {translation && (
                     <p className="text-xs text-muted-foreground italic mb-2">{translation}</p>
                )}
                {payload?.map((entry: any, index: number) => (
                    <p key={`item-${index}`} style={{ color: entry.color }}>
                        {`${entry.name}: ${entry.value}`}
                    </p>
                ))}
                {/* FIX: Check total is available before displaying */}
                {total > 0 && <p className="text-muted-foreground mt-1 text-xs">Total for {label}: {total}</p>}
            </div>
        );
    }
    return null;
};

// --- Main Component ---
export function LeaderboardBreakdowns({ filteredApps, isLoading }: LeaderboardBreakdownsProps) {
    const municipalNames = useMemo(() => [...new Set(filteredApps.map(a => a.municipality))].filter(m => m !== 'N/A'), [filteredApps]);
    const allCategories = useMemo(() => [...new Set(filteredApps?.map(app => app.category?.name?.en_GB || "Uncategorized"))].sort(), [filteredApps]);
    const totalApps = filteredApps.length;

    const breakdownCharts = useMemo(() => ([
        // MODIFIED: Added 'span: full' to achieve col-span-full
        { id: 'psCode', title: 'Challenge Statement', icon: Layers, span: 'full' },
        { id: 'category', title: 'Category (Digital/Non-Digital)', icon: Zap },
        { id: 'gender', title: 'Gender', icon: Circle },
        { id: 'age', title: 'Age Range', icon: User },
    ] as const).map(chart => {
        const processedData = processBreakdownData(filteredApps, chart.id);
        const stackKeys = chart.id === 'category' ? municipalNames : allCategories;
        const chartData = processedData?.[0]?.data || [];

        return {
            ...chart,
            data: chartData,
            stackKeys,
        };
    }), [filteredApps, municipalNames, allCategories]);


    if (isLoading) {
        return (
            <Card className="mt-6">
                <CardContent className="grid gap-6 md:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-[350px] w-full" />
                    ))}
                </CardContent>
            </Card>
        );
    }

    if (totalApps === 0) return null;

    // Render the set of stacked bar charts
    return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle>Filtered Data Breakdowns</CardTitle>
                <CardDescription>Breakdown of applications matching the current filters.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
                {breakdownCharts.map(chart => (
                    <Card 
                        key={chart.id} 
                        // MODIFIED: Apply full width class conditionally
                        className={cn(chart.span === "full" && "md:col-span-2")} 
                    >
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                                <chart.icon className="h-4 w-4" /> {chart.title}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px] pt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={chart.data}
                                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis 
                                        dataKey="name" 
                                        interval={0} 
                                        angle={chart.id === 'psCode' ? -45 : -15} // Increase angle for PS Code for better label visibility
                                        textAnchor="end" 
                                        height={chart.id === 'age' || chart.id === 'psCode' ? 60 : 30} // Increase height
                                    />
                                    <YAxis allowDecimals={false} />
                                    {/* MODIFIED: Use the enhanced GenericTooltip */}
                                    <Tooltip content={GenericTooltip} />
                                    <Legend />
                                    {chart.stackKeys?.map((key, index) => (
                                        <Bar
                                            key={key}
                                            dataKey={key}
                                            stackId="a"
                                            fill={COLORS[index % COLORS.length]}
                                        />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                ))}
            </CardContent>
        </Card>
    );
}

export { FilteredAppRawData };