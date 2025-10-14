"use client";

import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Sector } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from 'lucide-react';
import { AnalyticsLeaderboardEntry } from '@/actions/leaderboard';
import { FilteredAppRawData } from './LeaderboardBreakdowns';

// --- Type Definitions ---
interface ScoreAnalyticsCardProps {
    leaderboard: AnalyticsLeaderboardEntry[];
    municipalityFilter: string;
    isLoading: boolean;
    scoreSetName: string;
    filteredApps: FilteredAppRawData[];
}

type ScoreCategory = 'SCORE_6' | 'GTE_5' | 'GTE_4' | 'LT_4';

// --- Constants ---
const COLORS = {
    SCORE_6: '#22c55e', // green-500
    GTE_5: '#84cc16',  // lime-500
    GTE_4: '#facc15',  // yellow-500
    LT_4: '#ef4444',   // red-500
    GENDER: ['#3b82f6', '#ec4899', '#a855f7', '#84cc16'], // blue, pink, purple, lime
    CATEGORY: ['#14b8a6', '#f97316'], // teal, orange
    MUNI_COUNT: '#8884d8', // default recharts purple
};

const SCORE_THRESHOLDS = {
    SCORE_6: (score: number) => score === 6,
    GTE_5: (score: number) => score >= 5,
    GTE_4: (score: number) => score >= 4,
    LT_4: (score: number) => score < 4,
};

// --- Helper Functions ---
const extractFieldValue = (app: FilteredAppRawData, slug: string): string => {
    const field = app.raw_fields.find((f:any) => f.slug === slug);
    if (!field || field.value === null || field.value === undefined) return "N/A";
    if (typeof field.value === 'object') return field.translated?.en_GB || field.value.en_GB || "N/A";
    return String(field.value).split(" - [")[0].trim();
};

const abbreviateAgeLabel = (label: string): string => {
    if (label.toLowerCase().includes('below 18')) return '< 18';
    if (label.toLowerCase().includes('above 65')) return '> 65';
    return label.replace(/\s*years\s*/, '-years').replace(/\s/g, '').replace(/^-/, '').trim();
};

// --- Data Processing Hook ---
const useAnalyticsData = (leaderboard: AnalyticsLeaderboardEntry[], filteredApps: FilteredAppRawData[]) => {
    return useMemo(() => {
        const total = leaderboard.length;
        if (total === 0) {
            return {
                overallData: [], genderData: [], ageData: [], categoryData: [],
                municipalCountData: [], municipalScoreData: []
            };
        }

        // 1. Overall Score Distribution
        const scoreCounts = {
            SCORE_6: leaderboard.filter(e => SCORE_THRESHOLDS.SCORE_6(e.totalScore)).length,
            GTE_5: leaderboard.filter(e => SCORE_THRESHOLDS.GTE_5(e.totalScore)).length,
            GTE_4: leaderboard.filter(e => SCORE_THRESHOLDS.GTE_4(e.totalScore)).length,
            LT_4: leaderboard.filter(e => SCORE_THRESHOLDS.LT_4(e.totalScore)).length,
        };
        const overallData = (['SCORE_6', 'GTE_5', 'GTE_4', 'LT_4'] as ScoreCategory[]).map(key => ({
            id: key,
            label: `Score ${key === 'SCORE_6' ? '= 6' : key === 'GTE_5' ? '≥ 5' : key === 'GTE_4' ? '≥ 4' : '< 4'}`,
            value: scoreCounts[key],
            percentage: ((scoreCounts[key] / total) * 100).toFixed(1),
        }));

        // 2. Other Breakdowns (Gender, Age, Category)
        const createBreakdown = (extractor: (app: FilteredAppRawData) => string) =>
            filteredApps.reduce((acc, app) => {
                const key = extractor(app);
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

        const toChartData = (data: Record<string, number>) => Object.entries(data).map(([name, value]) => ({ name, value }));
        
        const genderData = toChartData(createBreakdown(app => extractFieldValue(app, 'rojNQzOz'))).sort((a,b)=>b.value-a.value);
        const ageData = toChartData(createBreakdown(app => abbreviateAgeLabel(extractFieldValue(app, 'xjzONPwj')))).sort((a, b) => a.name.localeCompare(b.name));
        const categoryData = toChartData(createBreakdown(app => app.category?.name?.en_GB || 'Uncategorized')).sort((a,b)=>b.value-a.value);

        // 3. Municipality Breakdowns
        const municipalMap = leaderboard.reduce((acc, entry) => {
            const muni = entry.municipality || 'N/A';
            if (!acc[muni]) acc[muni] = { total: 0, SCORE_6: 0, GTE_5: 0, GTE_4: 0, LT_4: 0 };
            acc[muni].total++;
            if (SCORE_THRESHOLDS.SCORE_6(entry.totalScore)) acc[muni].SCORE_6++;
            if (SCORE_THRESHOLDS.GTE_5(entry.totalScore)) acc[muni].GTE_5++;
            if (SCORE_THRESHOLDS.GTE_4(entry.totalScore)) acc[muni].GTE_4++;
            if (SCORE_THRESHOLDS.LT_4(entry.totalScore)) acc[muni].LT_4++;
            return acc;
        }, {} as Record<string, { total: number } & Record<ScoreCategory, number>>);

        const municipalCountData = Object.entries(municipalMap).map(([municipality, data]) => ({ municipality, count: data.total })).sort((a, b) => b.count - a.count);
        
        const municipalScoreData = Object.entries(municipalMap).map(([municipality, counts]) => ({
            municipality,
            'Score = 6': counts.total > 0 ? parseFloat(((counts.SCORE_6 / counts.total) * 100).toFixed(1)) : 0,
            'Score ≥ 5': counts.total > 0 ? parseFloat(((counts.GTE_5 / counts.total) * 100).toFixed(1)) : 0,
            'Score ≥ 4': counts.total > 0 ? parseFloat(((counts.GTE_4 / counts.total) * 100).toFixed(1)) : 0,
            'Score < 4': counts.total > 0 ? parseFloat(((counts.LT_4 / counts.total) * 100).toFixed(1)) : 0,
            total: counts.total,
        })).sort((a, b) => b.total - a.total);

        return { overallData, genderData, ageData, categoryData, municipalCountData, municipalScoreData };
    }, [leaderboard, filteredApps]);
};


// --- Custom Recharts Components ---
const renderActiveShape = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
    const RADIAN = Math.PI / 180;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + (outerRadius + 10) * cos;
    const sy = cy + (outerRadius + 10) * sin;
    const mx = cx + (outerRadius + 30) * cos;
    const my = cy + (outerRadius + 30) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 22;
    const ey = my;
    const textAnchor = cos >= 0 ? 'start' : 'end';

    return (
        <g>
            <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} className="font-semibold">{payload.name}</text>
            <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius} startAngle={startAngle} endAngle={endAngle} fill={fill} />
            <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
            <circle cx={ex} cy={ey} r={3} fill={fill} stroke="none" />
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#333">{`Count: ${value}`}</text>
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="#999">{`(${(percent * 100).toFixed(1)}%)`}</text>
        </g>
    );
};

const MunicipalTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="p-2 bg-background border rounded-md shadow-lg text-sm">
                <p className="font-bold mb-1">{label}</p>
                {payload.map((entry: any) => (<p key={entry.name} style={{ color: entry.color }}>{`${entry.name}: ${entry.value.toFixed(1)}%`}</p>))}
                <p className="text-muted-foreground mt-1 text-xs">Total Apps: {payload[0].payload.total}</p>
            </div>
        );
    }
    return null;
};

// --- Main Component ---
export function ScoreAnalyticsCard({ leaderboard, municipalityFilter, isLoading, scoreSetName, filteredApps }: ScoreAnalyticsCardProps) {
    const { overallData, genderData, ageData, categoryData, municipalCountData, municipalScoreData } = useAnalyticsData(leaderboard, filteredApps);
    const [activeIndex, setActiveIndex] = useState(0);

    if (isLoading) {
        return <Card className="shadow-lg mt-6"><CardContent className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin mr-3" /> Loading Analytics Data...</CardContent></Card>;
    }
    if (leaderboard.length === 0) return (
        <Card className="shadow-lg mt-6"><CardContent className="flex items-center justify-center py-24 text-muted-foreground">No data available for the current filters to display analytics.</CardContent></Card>
    );

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle>Performance Analytics for: <span className="text-primary">{scoreSetName}</span></CardTitle>
                    <CardDescription>Filtered by: <span className="font-semibold">{municipalityFilter === 'all' ? 'All Municipalities' : municipalityFilter}</span> | Total Applications: <span className="font-semibold">{leaderboard.length}</span></CardDescription>
                </CardHeader>
            </Card>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                <Card><CardHeader><CardTitle className="text-base">Overall Score Distribution</CardTitle></CardHeader><CardContent>
                    <div className="space-y-4">{overallData.map(item => (<div key={item.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center"><div className="h-3 w-3 rounded-full mr-3" style={{ backgroundColor: COLORS[item.id] }} /><span>{item.label}</span></div>
                        <div className="font-semibold text-right">{item.percentage}%<span className="text-muted-foreground ml-2">({item.value})</span></div>
                    </div>))}</div>
                </CardContent></Card>

                <Card><CardHeader><CardTitle className="text-base">Gender Distribution</CardTitle></CardHeader><CardContent className="h-[250px]"><ResponsiveContainer width="100%" height="100%">
                    <PieChart><Pie activeIndex={activeIndex} activeShape={renderActiveShape} data={genderData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" onMouseEnter={(_, index) => setActiveIndex(index)}>{genderData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS.GENDER[index % COLORS.GENDER.length]} />)}</Pie></PieChart>
                </ResponsiveContainer></CardContent></Card>

                <Card><CardHeader><CardTitle className="text-base">Category (Digital/Non-Digital)</CardTitle></CardHeader><CardContent className="h-[250px]"><ResponsiveContainer width="100%" height="100%">
                    <PieChart><Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} labelLine={false} label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
                        const RADIAN = Math.PI / 180; const radius = innerRadius + (outerRadius - innerRadius) * 0.5; const x = cx + radius * Math.cos(-midAngle * RADIAN); const y = cy + radius * Math.sin(-midAngle * RADIAN);
                        return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central">{`${(percent * 100).toFixed(0)}%`}</text>;
                    }}>{categoryData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS.CATEGORY[index % COLORS.CATEGORY.length]} />)}</Pie><Tooltip /><Legend /></PieChart>
                </ResponsiveContainer></CardContent></Card>

                <Card className="md:col-span-2 xl:col-span-3"><CardHeader><CardTitle className="text-base">Age Range Distribution</CardTitle></CardHeader><CardContent className="h-[300px]"><ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ageData} layout="vertical" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={80} /><Tooltip /><Bar dataKey="value" name="Applications" fill={COLORS.MUNI_COUNT} /></BarChart>
                </ResponsiveContainer></CardContent></Card>

                <Card className="md:col-span-1 xl:col-span-3"><CardHeader><CardTitle className="text-base">Applications per Municipality</CardTitle></CardHeader><CardContent className="h-[300px]"><ResponsiveContainer width="100%" height="100%">
                    <BarChart data={municipalCountData} margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="municipality" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" name="Applications" fill={COLORS.MUNI_COUNT} /></BarChart>
                </ResponsiveContainer></CardContent></Card>

                <Card className="md:col-span-2 xl:col-span-3"><CardHeader><CardTitle className="text-base">Scoring Breakdown by Municipality (%)</CardTitle></CardHeader><CardContent className="h-[400px]"><ResponsiveContainer width="100%" height="100%">
                    <BarChart data={municipalScoreData} layout="vertical" stackOffset="expand" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tickFormatter={(tick) => `${tick * 100}%`} domain={[0, 1]} /><YAxis type="category" dataKey="municipality" width={100} />
                        <Tooltip content={<MunicipalTooltip />} /><Legend />
                        <Bar dataKey="Score = 6" stackId="a" fill={COLORS.SCORE_6} /><Bar dataKey="Score ≥ 5" stackId="a" fill={COLORS.GTE_5} />
                        <Bar dataKey="Score ≥ 4" stackId="a" fill={COLORS.GTE_4} /><Bar dataKey="Score < 4" stackId="a" fill={COLORS.LT_4} />
                    </BarChart>
                </ResponsiveContainer></CardContent></Card>
            </div>
        </div>
    );
}

