// csv-uploader-include-callForIdea/components/ScoreAnalyticsCard.tsx

"use client";

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from 'lucide-react'; 
import { AnalyticsLeaderboardEntry } from '@/actions/leaderboard';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';


type ScoreCategory = keyof typeof COLORS;

interface OverallScoreData {
    id: ScoreCategory;
    label: string;
    value: number;
    percentage?: string;
}
// Score thresholds for categorization
const SCORE_THRESHOLDS = {
    SCORE_6: (score: number) => score === 6,
    GTE_5: (score: number) => score >= 5,
    GTE_4: (score: number) => score >= 4,
    LT_4: (score: number) => score < 4,
};

const COLORS = {
    SCORE_6: '#00C49F', // Teal
    GTE_5: '#2A9F59', // Darker Green
    GTE_4: '#FFBB28', // Yellow
    LT_4: '#FF4560',  // Red
};

interface ScoreAnalyticsCardProps {
    leaderboard: AnalyticsLeaderboardEntry[]; 
    municipalityFilter: string;
    isLoading: boolean; 
}

// Function to process data for all score analytics charts
const processAnalyticsData = (leaderboard: AnalyticsLeaderboardEntry[]) => { 
    // 1. Overall Metrics
    const total = leaderboard.length;
    let overallData: OverallScoreData[] = [];


    if (total > 0) {
        const counts = {
            SCORE_6: leaderboard.filter(e => SCORE_THRESHOLDS.SCORE_6(e.totalScore)).length,
            GTE_5: leaderboard.filter(e => SCORE_THRESHOLDS.GTE_5(e.totalScore)).length,
            GTE_4: leaderboard.filter(e => SCORE_THRESHOLDS.GTE_4(e.totalScore)).length,
            LT_4: leaderboard.filter(e => SCORE_THRESHOLDS.LT_4(e.totalScore)).length,
        };

        overallData = ([
            { id: 'SCORE_6', label: 'Score = 6 (Excellent)', value: counts.SCORE_6 },
            { id: 'GTE_5', label: 'Score ≥ 5', value: counts.GTE_5 },
            { id: 'GTE_4', label: 'Score ≥ 4', value: counts.GTE_4 },
            { id: 'LT_4', label: 'Score < 4 (Low)', value: counts.LT_4 },
        ] as const).map(item => ({
            ...item,
            percentage: ((item.value / total) * 100).toFixed(1)
        })) as OverallScoreData[];
    }

    // 2. Municipal Breakdown (Count for simple bar chart)
    const municipalCountMap = leaderboard.reduce((acc, entry) => {
        const muni = entry.municipality || 'N/A';
        acc[muni] = (acc[muni] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const municipalCountData = Object.entries(municipalCountMap).map(([municipality, count]) => ({
        municipality,
        count
    })).sort((a, b) => b.count - a.count);


    // 3. Municipal Breakdown (Percentage for stacked bar chart)
    const municipalMap = leaderboard.reduce((acc, entry) => {
        const muni = entry.municipality || 'N/A';
        if (!acc[muni]) {
            acc[muni] = { total: 0, SCORE_6: 0, GTE_5: 0, GTE_4: 0, LT_4: 0 };
        }
        acc[muni].total++;
        const score = entry.totalScore;

        if (SCORE_THRESHOLDS.SCORE_6(score)) acc[muni].SCORE_6++;
        if (SCORE_THRESHOLDS.GTE_5(score)) acc[muni].GTE_5++;
        if (SCORE_THRESHOLDS.GTE_4(score)) acc[muni].GTE_4++;
        if (SCORE_THRESHOLDS.LT_4(score)) acc[muni].LT_4++;

        return acc;
    }, {} as Record<string, { total: number, SCORE_6: number, GTE_5: number, GTE_4: number, LT_4: number }>);

    const municipalData = Object.entries(municipalMap).map(([muni, counts]) => {
        const calculatePercentage = (count: number) => ((count / counts.total) * 100).toFixed(1);

        return {
            municipality: muni,
            'Score = 6': calculatePercentage(counts.SCORE_6),
            'Score ≥ 5': calculatePercentage(counts.GTE_5),
            'Score ≥ 4': calculatePercentage(counts.GTE_4),
            'Score < 4': calculatePercentage(counts.LT_4),
            total: counts.total, 
        };
    }).sort((a, b) => {
        return b.total - a.total;
    });

    return { overallData, municipalData, municipalCountData };
};


// Custom tooltip for municipal score percentage chart
const MunicipalTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const total = payload[0].payload.total;

        return (
            <div className="p-3 bg-background border rounded-md shadow-lg text-sm">
                <p className="font-bold mb-1">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <p key={`item-${index}`} style={{ color: entry.color }}>
                        {`${entry.name}: ${entry.value}%`}
                    </p>
                ))}
                <p className="text-muted-foreground mt-1 text-xs">Total Applications: {total}</p>
            </div>
        );
    }
    return null;
};

export function ScoreAnalyticsCard({ leaderboard, municipalityFilter, isLoading, }: ScoreAnalyticsCardProps) {
    const { overallData, municipalData, municipalCountData } = useMemo(() => processAnalyticsData(leaderboard), [leaderboard]); 
    const overallTotal = leaderboard.length;
    const isFiltered = municipalityFilter !== 'all';

    // Keys for the municipal stacked bar chart
    const municipalKeys = ['Score = 6', 'Score ≥ 5', 'Score ≥ 4', 'Score < 4'];

    if (isLoading) { 
        return (
            <Card className="shadow-lg mt-6">
                <CardHeader>
                    <CardTitle>Scoring Performance Analytics</CardTitle>
                    <CardDescription>Breakdown of application scores across predefined thresholds.</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin mr-2" /> Loading All Data for Analytics...
                </CardContent>
            </Card>
        );
    }

    if (overallTotal === 0) {
        return null;
    }

    return (
        <Card className="shadow-lg mt-6">
            <CardHeader>
                <CardTitle>Scoring Performance Analytics</CardTitle>
                <CardDescription>Breakdown of application scores across predefined thresholds.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"> {/* Use a 3-column grid */}

                {/* 1. Overall Score Distribution (Existing) */}
                <Card>
                    <CardHeader className={cn("pb-2", isFiltered && "bg-accent/30 rounded-t-xl")}>
                        <CardTitle className="text-base">
                            {isFiltered ? `Distribution for: ${municipalityFilter}` : 'Overall Score Distribution'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="space-y-4">
                            {overallData.map(item => (
                                <div key={item.id} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center">
                                        <div className="h-3 w-3 rounded-full mr-3" style={{ backgroundColor: COLORS[item.id] }} />
                                        <span>{item.label}</span>
                                    </div>
                                    <div className="font-semibold text-right">
                                        {item.percentage}%
                                        <span className="text-muted-foreground ml-2">({item.value}/{overallTotal})</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Municipal Count Bar Chart (NEW CHART) */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Applications per Municipality</CardTitle>
                        <CardDescription className="text-xs">{`Total: ${overallTotal} (Filtered by Score)`}</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={municipalCountData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" allowDecimals={false} />
                                <YAxis type="category" dataKey="municipality" width={100} />
                                <Tooltip contentStyle={{ fontSize: '12px' }} />
                                <Bar dataKey="count" fill="#8884d8" name="Applications" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* 3. Municipal Breakdown (Existing Stacked Percentage Bar Chart) */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Scoring Breakdown by Municipality (%)</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px] pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={municipalData}
                                layout="vertical"
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                stackOffset="expand" // Use expand to show percentage stacked bars
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" tickFormatter={(tick) => `${tick * 100}%`} domain={[0, 1]} />
                                <YAxis type="category" dataKey="municipality" width={100} />
                                <Tooltip content={MunicipalTooltip} />
                                <Legend />
                                <Bar dataKey="Score = 6" stackId="a" fill={COLORS.SCORE_6} />
                                <Bar dataKey="Score ≥ 5" stackId="a" fill={COLORS.GTE_5} />
                                <Bar dataKey="Score ≥ 4" stackId="a" fill={COLORS.GTE_4} />
                                <Bar dataKey="Score < 4" stackId="a" fill={COLORS.LT_4} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

            </CardContent>
        </Card>
    );
}