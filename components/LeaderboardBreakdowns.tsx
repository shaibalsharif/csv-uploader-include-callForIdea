"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Zap, Circle, User, Layers, MapPin } from "lucide-react";
import type { AppRawData } from '@/actions/analysis';
import { Skeleton } from "@/components/ui/skeleton";

export interface FilteredAppRawData extends AppRawData {
    totalScore: number;
    municipality: string;
}

export type BreakdownKey = 'municipality' | 'psCode' | 'gender' | 'age' | 'applicantCategory' | 'category';

interface LeaderboardBreakdownsProps {
    filteredApps: FilteredAppRawData[];
    isLoading: boolean;
    selectedBreakdown: BreakdownKey;
}

const normalizeApplicantCategory = (value: string): string => {
    const v = value.toLowerCase();
    if (v.includes('academia')) return 'Education Institute';
    if (v.includes('municipal administration') || v.includes('private organization') || v.includes('civil society') || v.includes('ngo/ingo')) return 'Institution';
    return 'Individual';
};

export const extractFieldValue = (app: FilteredAppRawData, slug: string): string => {
    const rawFields = (app.raw_fields as any[]) || [];
    const field = rawFields.find((f: any) => f.slug === slug);
    const value = field?.value;
    if (typeof value === 'object' && value !== null) {
        return field?.translated?.en_GB || value.en_GB || value.en || JSON.stringify(value);
    }
    return value !== null && value !== undefined && typeof value === 'string' ? value.split(" - [")[0].trim() : "N/A";
};

const extractPsCodeValue = (app: FilteredAppRawData, possibleSlugs: string[]): string => {
    const rawFields = (app.raw_fields as any[]) || [];
    const field = rawFields.find((f: any) => possibleSlugs.includes(f.slug));
    return field?.value || "N/A";
};

const getPsCodeTranslation = (app: FilteredAppRawData, possibleSlugs: string[]): string => {
    const rawFields = (app.raw_fields as any[]) || [];
    const field = rawFields.find((f: any) => possibleSlugs.includes(f.slug));
    return field?.translated?.en_GB || "";
};

const abbreviateAgeLabel = (label: string): string => {
    if (label.toLowerCase().includes('below 18')) return '< 18';
    if (label.toLowerCase().includes('above 65')) return '> 65';
    return label.replace(/\s*years\s*/, '-years').replace(/\s/g, '').replace(/^-/, '').trim();
};

export const dimensionMap = {
    age: { label: "Age Range", slug: 'xjzONPwj', icon: User, order: ['< 18', '18-25-years', '26-35-years', '36-45-years', '46-55-years', '56-65-years', '> 65'] },
    gender: { label: "Gender", slug: 'rojNQzOz', icon: Circle, order: ['Male', 'Female', 'Other', 'N/A'] },
    psCode: { label: "Challenge Statement", slug: ['gkknPnQp', 'jDJaNYGG', 'RjAnzBZJ', 'OJBPQyGP'], icon: Layers, order: [] },
    category: { label: "Category", slug: 'category', icon: Zap, order: [] },
    applicantCategory: { label: "Applicant Type", slug: 'JvKDGVwE', icon: User, order: ['Individual', 'Institution', 'Education Institute', 'N/A'] },
    municipality: { label: "Municipality", slug: 'municipality', icon: MapPin, order: [] },
};

export const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#AF19FF", "#FF4560", "#6A3E90"];

export interface BreakdownResult {
    municipality: string;
    data: any[];
    stackKeys: string[];
}

export const processBreakdownData = (apps: FilteredAppRawData[], dimension: BreakdownKey): BreakdownResult[] => {
    
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
            case 'applicantCategory':
                key = normalizeApplicantCategory(extractFieldValue(app, dimensionMap.applicantCategory.slug as string));
                break;
            case 'municipality':
                key = app.municipality || "N/A";
                break;
            default:
                key = 'N/A';
        }
        if (!acc[key]) {
            acc[key] = { apps: [], totalScoreSum: 0, totalAppCount: 0 };
        }
        acc[key].apps.push(app);
        acc[key].totalScoreSum += app.totalScore;
        acc[key].totalAppCount += 1;
        return acc;
    }, {} as Record<string, { apps: FilteredAppRawData[], totalScoreSum: number, totalAppCount: number }>);

    const allCategories = [...new Set(apps?.map((app: FilteredAppRawData) => app.category?.name?.en_GB || "Uncategorized"))].sort();

    
    const aggregatedData = Object.entries(groupedByDimension)?.map(([name, dimGroup]) => {
        
        const categoryScores: Record<string, { sum: number, count: number }> = allCategories.reduce((acc, category) => {
            acc[category] = { sum: 0, count: 0 };
            return acc;
        }, {} as Record<string, { sum: number, count: number }>);

        dimGroup.apps.forEach((app: FilteredAppRawData) => {
            const category = app.category?.name?.en_GB || "Uncategorized";
            if (categoryScores[category] !== undefined) {
                categoryScores[category].sum += app.totalScore;
                categoryScores[category].count++;
            }
        });

        const finalRow: Record<string, any> = { name };
        
        allCategories.forEach(category => {
            const { sum, count } = categoryScores[category];
            if (count > 0) {
                // Return the average score for the category stack, rounded to 2 decimals
                finalRow[category] = parseFloat((sum / count).toFixed(2));
            } else {
                finalRow[category] = 0;
            }
        });
        
        const totalAverageScore = dimGroup.totalAppCount > 0 ? parseFloat((dimGroup.totalScoreSum / dimGroup.totalAppCount).toFixed(2)) : 0;
        
        let translation = "";
        if (dimension === 'psCode' && dimGroup.apps.length > 0) {
            translation = getPsCodeTranslation(dimGroup.apps[0], dimensionMap.psCode.slug as string[]);
        }

        return { 
            ...finalRow, 
            name,
            totalAverageScore,
            totalCount: dimGroup.totalAppCount,
            translation 
        };
    }).sort((a, b) => {
        const order = dimensionMap[dimension]?.order || [];

        if (dimension === 'psCode') {
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

        if (order.length > 0) {
            return order.indexOf(a.name) - order.indexOf(b.name);
        }
        return a.name.localeCompare(b.name);
    });

    return [{ municipality: "All Filtered Data (Aggregated)", data: aggregatedData, stackKeys: allCategories }];
};


const GenericTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const totalCount = payload[0]?.payload?.totalCount; 
        const translation = payload[0]?.payload?.translation;

        return (
            <div className="p-3 bg-background border rounded-md shadow-lg text-sm">
                <p className="font-bold mb-1">{label}</p>
                {translation && (
                     <p className="text-xs text-muted-foreground italic mb-2">{translation}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">Total Applications: {totalCount}</p>
                {payload?.map((entry: any, index: number) => (
                    <p key={`item-${index}`} style={{ color: entry.color }}>
                        {`${entry.name} Avg Score: ${parseFloat(entry.value).toFixed(2)}`}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

export function LeaderboardBreakdowns({ filteredApps, isLoading, selectedBreakdown }: LeaderboardBreakdownsProps) {
    const allCategories = useMemo(() => [...new Set(filteredApps?.map(app => app.category?.name?.en_GB || "Uncategorized"))].sort(), [filteredApps]);
    const totalApps = filteredApps.length;
    
    const selectedBreakdownData = useMemo(() => {
        const dim = dimensionMap[selectedBreakdown];
        if (!dim) return null;
        
        const processedData = processBreakdownData(filteredApps, selectedBreakdown);
        
        const stackKeys = processedData?.[0]?.stackKeys || allCategories;

        const chartData = processedData?.[0]?.data || [];

        return {
            id: selectedBreakdown,
            title: dim.label,
            icon: dim.icon,
            data: chartData,
            stackKeys,
        };

    }, [filteredApps, selectedBreakdown, allCategories]);


    if (isLoading) {
        return (
            <Card className="mt-6">
                <CardContent className="grid gap-6">
                    <Skeleton className="h-[350px] w-full" />
                </CardContent>
            </Card>
        );
    }

    if (totalApps === 0 || !selectedBreakdownData || selectedBreakdownData.data.length === 0) {
        return (
            <Card className="mt-6">
                 <CardHeader><CardTitle>Breakdown: {selectedBreakdownData?.title || 'Loading...'}</CardTitle></CardHeader>
                 <CardContent className="text-center py-12 text-muted-foreground">
                    <Layers className="h-8 w-8 mx-auto mb-2" />
                    <p>No data to display for this breakdown with current filters.</p>
                </CardContent>
            </Card>
        );
    }

    const chart = selectedBreakdownData;
    
    return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                    <chart.icon className="h-4 w-4" /> {chart.title} Breakdown (Average Score)
                </CardTitle>
                <CardDescription>Average total scores broken down by {chart.title} and stacked by Category (Digital/Non-Digital).</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chart.data}
                        margin={{ top: 20, right: 30, left: 20, bottom: chart.id === 'psCode' ? 70 : 30 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                            dataKey="name" 
                            interval={0} 
                            angle={chart.id === 'psCode' ? -45 : -15}
                            textAnchor="end" 
                            height={chart.id === 'age' || chart.id === 'psCode' ? 60 : 30}
                        />
                        <YAxis allowDecimals={false} label={{ value: 'Average Score', angle: -90, position: 'insideLeft' }}/>
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
    );
}