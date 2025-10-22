"use client";

import { useMemo, useState, useRef, useCallback, Ref } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Sector } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { AnalyticsLeaderboardEntry } from '@/actions/leaderboard';
import type { FilteredAppRawData } from '@/components/LeaderboardBreakdowns';

// --- Type Definitions ---
interface ScoreAnalyticsCardProps {
    leaderboard: AnalyticsLeaderboardEntry[];
    municipalityFilter: string;
    isLoading: boolean;
    scoreSetName: string;
    filteredApps: FilteredAppRawData[];
    skipScoreDistribution: boolean; // NEW PROP for conditional rendering
}

type ScoreCategory = 'SCORE_6' | 'GTE_5' | 'GTE_4' | 'LT_4';

// --- Constants ---
const COLORS = {
    SCORE_6: '#22c55e', GTE_5: '#84cc16', GTE_4: '#facc15', LT_4: '#ef4444',
    GENDER: ['#3b82f6', '#ec4899', '#a855f7', '#84cc16'],
    CATEGORY: ['#14b8a6', '#f97316'], MUNI_COUNT: '#8884d8',
};

const SCORE_THRESHOLDS = {
    SCORE_6: (score: number) => score === 6,
    GTE_5: (score: number) => score >= 5,
    GTE_4: (score: number) => score >= 4,
    LT_4: (score: number) => score < 4,
};

// --- Helper Functions ---
const extractFieldValue = (app: FilteredAppRawData, slug: string): string => (app.raw_fields.find((f: any) => f.slug === slug)?.translated?.en_GB || app.raw_fields.find((f: any) => f.slug === slug)?.value?.en_GB || String(app.raw_fields.find((f: any) => f.slug === slug)?.value).split(" - [")[0].trim() || "N/A");
const abbreviateAgeLabel = (label: string): string => label.toLowerCase().includes('below 18') ? '< 18' : label.toLowerCase().includes('above 65') ? '> 65' : label.replace(/\s*years\s*/, '-years').replace(/\s/g, '').replace(/^-/, '').trim();
const extractPsCodeAndLabel = (app: FilteredAppRawData, possibleSlugs: string[]): string => {
    const field = app.raw_fields.find((f: any) => possibleSlugs.includes(f.slug));
    if (!field) return "N/A";
    const code = field.value ? String(field.value).split(" - [")[0].trim() : "N/A";
    const label = field.translated?.en_GB || "";
    if (code === "N/A") return "N/A";
    return label ? `${code}: ${label}` : code;
};


// --- Data Processing Hook ---
const useAnalyticsData = (leaderboard: AnalyticsLeaderboardEntry[], filteredApps: FilteredAppRawData[]) => {
    return useMemo(() => {
        const total = leaderboard.length;
        if (total === 0) return { overallData: [], genderData: [], ageData: [], categoryData: [], municipalCountData: [], municipalScoreData: [], challengeData: [] };

        const scoreCounts = {
            SCORE_6: leaderboard.filter(e => SCORE_THRESHOLDS.SCORE_6(e.totalScore)).length,
            GTE_5: leaderboard.filter(e => SCORE_THRESHOLDS.GTE_5(e.totalScore)).length,
            GTE_4: leaderboard.filter(e => SCORE_THRESHOLDS.GTE_4(e.totalScore)).length,
            LT_4: leaderboard.filter(e => SCORE_THRESHOLDS.LT_4(e.totalScore)).length,
        };
        const overallData = (['SCORE_6', 'GTE_5', 'GTE_4', 'LT_4'] as ScoreCategory[]).map(key => ({ id: key, label: `Score ${key.replace('_', ' ').replace('GTE', '≥').replace('LT', '<')}`, value: scoreCounts[key], percentage: ((scoreCounts[key] / total) * 100).toFixed(1) }));

        const createBreakdown = (extractor: (app: FilteredAppRawData) => string) => filteredApps.reduce((acc, app) => { const key = extractor(app); if (key !== 'N/A') { acc[key] = (acc[key] || 0) + 1; } return acc; }, {} as Record<string, number>);
        const toChartData = (data: Record<string, number>) => Object.entries(data).map(([name, value]) => ({ name, value }));

        const municipalMap = leaderboard.reduce((acc, entry) => {
            const muni = entry.municipality || 'N/A';
            if (!acc[muni]) acc[muni] = { total: 0, SCORE_6: 0, GTE_5: 0, GTE_4: 0, LT_4: 0 };
            acc[muni].total++;
            Object.keys(SCORE_THRESHOLDS).forEach(key => { if (SCORE_THRESHOLDS[key as ScoreCategory](entry.totalScore)) acc[muni][key as ScoreCategory]++; });
            return acc;
        }, {} as Record<string, { total: number } & Record<ScoreCategory, number>>);

        const challengeStatementSlugs = ['gkknPnQp', 'jDJaNYGG', 'RjAnzBZJ', 'OJBPQyGP'];

        return {
            overallData,
            genderData: toChartData(createBreakdown(app => extractFieldValue(app, 'rojNQzOz'))).sort((a, b) => b.value - a.value),
            ageData: toChartData(createBreakdown(app => abbreviateAgeLabel(extractFieldValue(app, 'xjzONPwj')))).sort((a, b) => a.name.localeCompare(b.name)),
            categoryData: toChartData(createBreakdown(app => app.category?.name?.en_GB || 'Uncategorized')).sort((a, b) => b.value - a.value),
            municipalCountData: Object.entries(municipalMap).map(([muni, data]) => ({ municipality: muni, count: data.total })).sort((a, b) => b.count - a.count),
            municipalScoreData: Object.entries(municipalMap).map(([muni, counts]) => ({ municipality: muni, 'Score = 6': counts.total > 0 ? parseFloat(((counts.SCORE_6 / counts.total) * 100).toFixed(1)) : 0, 'Score ≥ 5': counts.total > 0 ? parseFloat(((counts.GTE_5 / counts.total) * 100).toFixed(1)) : 0, 'Score ≥ 4': counts.total > 0 ? parseFloat(((counts.GTE_4 / counts.total) * 100).toFixed(1)) : 0, 'Score < 4': counts.total > 0 ? parseFloat(((counts.LT_4 / counts.total) * 100).toFixed(1)) : 0, total: counts.total })).sort((a, b) => b.total - a.total),
            challengeData: toChartData(createBreakdown(app => extractPsCodeAndLabel(app, challengeStatementSlugs))).sort((a, b) => a.name.localeCompare(b.name)),
        };
    }, [leaderboard, filteredApps]);
};

// --- Recharts Components ---
const renderActiveShape = (props: any) => { const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props; const RADIAN = Math.PI / 180; const sin = Math.sin(-RADIAN * midAngle); const cos = Math.cos(-RADIAN * midAngle); const sx = cx + (outerRadius + 10) * cos; const sy = cy + (outerRadius + 10) * sin; const mx = cx + (outerRadius + 30) * cos; const my = cy + (outerRadius + 30) * sin; const ex = mx + (cos >= 0 ? 1 : -1) * 22; const ey = my; const textAnchor = cos >= 0 ? 'start' : 'end'; return <g><text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} className="font-semibold">{payload.name}</text><Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius} startAngle={startAngle} endAngle={endAngle} fill={fill} /><path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" /><circle cx={ex} cy={ey} r={3} fill={fill} stroke="none" /><text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#333">{`Count: ${value}`}</text><text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="#999">{`(${(percent * 100).toFixed(1)}%)`}</text></g>; };
const MunicipalTooltip = ({ active, payload, label }: any) => { if (active && payload?.length) { return <div className="p-2 bg-background border rounded-md shadow-lg text-sm"><p className="font-bold mb-1">{label}</p>{payload.map((e: any) => <p key={e.name} style={{ color: e.color }}>{`${e.name}: ${e.value.toFixed(1)}%`}</p>)}<p className="text-muted-foreground mt-1 text-xs">Total: {payload[0].payload.total}</p></div>; } return null; };

// Self-contained component for Gender Pie Chart to prevent parent re-renders on hover
const GenderPieChart = ({ data }: { data: { name: string; value: number }[] }) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const onPieEnter = useCallback((_: any, index: number) => {
        setActiveIndex(index);
    }, []);

    return (
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Pie activeIndex={activeIndex} activeShape={renderActiveShape} data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" onMouseEnter={onPieEnter}>
                    {data.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS.GENDER[index % COLORS.GENDER.length]} />)}
                </Pie>
            </PieChart>
        </ResponsiveContainer>
    );
};

// --- Main Component ---
export function ScoreAnalyticsCard({ leaderboard, municipalityFilter, isLoading, scoreSetName, filteredApps, skipScoreDistribution }: ScoreAnalyticsCardProps) {
    const { overallData, genderData, ageData, categoryData, municipalCountData, municipalScoreData, challengeData } = useAnalyticsData(leaderboard, filteredApps);

    const refs = {
        overall: useRef<HTMLDivElement>(null), gender: useRef<HTMLDivElement>(null), category: useRef<HTMLDivElement>(null),
        age: useRef<HTMLDivElement>(null), muniCount: useRef<HTMLDivElement>(null), muniScore: useRef<HTMLDivElement>(null),
        challenge: useRef<HTMLDivElement>(null),
    };

    const ChartCard = ({ title, chartRef, children }: { title: string; chartRef: Ref<HTMLDivElement>; children: React.ReactNode; }) => (
        <div ref={chartRef} className="bg-white rounded-xl"><Card><CardHeader>
            <div className="flex justify-between items-center">
                <CardTitle className="text-base">{title}</CardTitle>
            </div></CardHeader><CardContent>{children}</CardContent></Card></div>
    );

    if (isLoading) return <Card className="shadow-lg mt-6"><CardContent className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin mr-3" /> Loading Analytics...</CardContent></Card>;
    if (leaderboard.length === 0) return <Card className="shadow-lg mt-6"><CardContent className="py-24 text-center text-muted-foreground">No data for current filters.</CardContent></Card>;

    return (
        <div className="space-y-6">
            <Card className="shadow-lg"><CardHeader>
                <CardTitle>Analytics for: <span className="text-primary">{scoreSetName}</span></CardTitle>
                <CardDescription>Filter: <span className="font-semibold">{municipalityFilter === 'all' ? 'All' : municipalityFilter}</span> | Apps: <span className="font-semibold">{leaderboard.length}</span></CardDescription>
            </CardHeader></Card>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                
                {/* 1. Overall Score Distribution (CONDITIONAL RENDERING) */}
                {!skipScoreDistribution && overallData.length > 0 && (
                    <ChartCard title="Overall Score Distribution" chartRef={refs.overall}>
                        <div className="space-y-4 pt-4">{overallData.map(item => (<div key={item.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center"><div className="h-3 w-3 rounded-full mr-3" style={{ backgroundColor: COLORS[item.id as ScoreCategory] }} /><span>{item.label}</span></div>
                            <div className="font-semibold">{item.percentage}%<span className="text-muted-foreground ml-2">({item.value})</span></div>
                        </div>))}</div>
                    </ChartCard>
                )}

                <ChartCard title="Gender Distribution" chartRef={refs.gender}><div className="h-[250px]">
                    <GenderPieChart data={genderData} />
                </div></ChartCard>
                <ChartCard title="Category (Digital/Non-Digital)" chartRef={refs.category}><div className="h-[250px]"><ResponsiveContainer width="100%" height="100%">
                    <PieChart><Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} labelLine={false} label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => { const r = innerRadius + (outerRadius - innerRadius) * 0.5; const x = cx + r * Math.cos(-midAngle * Math.PI / 180); const y = cy + r * Math.sin(-midAngle * Math.PI / 180); return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central">{`${(percent * 100).toFixed(0)}%`}</text>; }}>{categoryData.map((_, i) => <Cell key={`c-${i}`} fill={COLORS.CATEGORY[i % COLORS.CATEGORY.length]} />)}</Pie><Tooltip /><Legend /></PieChart>
                </ResponsiveContainer></div></ChartCard>
                <div className="md:col-span-2 xl:col-span-3"><ChartCard title="Age Range Distribution" chartRef={refs.age}><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ageData} layout="vertical" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={80} /><Tooltip /><Bar dataKey="value" name="Apps" fill={COLORS.MUNI_COUNT} /></BarChart>
                </ResponsiveContainer></div></ChartCard></div>
                <div className="md:col-span-1 xl:col-span-3"><ChartCard title="Applications per Municipality" chartRef={refs.muniCount}><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%">
                    <BarChart data={municipalCountData} margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="municipality" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" name="Apps" fill={COLORS.MUNI_COUNT} /></BarChart>
                </ResponsiveContainer></div></ChartCard></div>
                <div className="md:col-span-2 xl:col-span-3"><ChartCard title="Scoring Breakdown by Municipality (%)" chartRef={refs.muniScore}><div className="h-[400px]"><ResponsiveContainer width="100%" height="100%">
                    <BarChart data={municipalScoreData} layout="vertical" stackOffset="expand" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tickFormatter={(t) => `${t * 100}%`} domain={[0, 1]} /><YAxis type="category" dataKey="municipality" width={100} /><Tooltip content={<MunicipalTooltip />} /><Legend />
                        <Bar dataKey="Score = 6" stackId="a" fill={COLORS.SCORE_6} /><Bar dataKey="Score ≥ 5" stackId="a" fill={COLORS.GTE_5} /><Bar dataKey="Score ≥ 4" stackId="a" fill={COLORS.GTE_4} /><Bar dataKey="Score < 4" stackId="a" fill={COLORS.LT_4} /></BarChart>
                </ResponsiveContainer></div></ChartCard></div>
                <div className="md:col-span-2 xl:col-span-3"><ChartCard title="Challenge Statement Distribution" chartRef={refs.challenge}><div className="h-[350px]"><ResponsiveContainer width="100%" height="100%">
                    <BarChart data={challengeData} layout="vertical" margin={{ left: 200, right: 30 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={350} style={{ fontSize: '12px' }} interval={0} /><Tooltip /><Bar dataKey="value" name="Applications" fill={COLORS.MUNI_COUNT} /></BarChart>
                </ResponsiveContainer></div></ChartCard></div>
            </div>
        </div>
    );
}