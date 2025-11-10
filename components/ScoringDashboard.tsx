"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, LineChart, Line, Legend, Radar } from 'recharts';
import { AggregatedData } from '@/lib/scoring-utils';
import { Zap, Users, LayoutList, Eye, CheckCircle, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ApplicationDetailsInquiryModal } from "./ApplicationDetailsInquiryModal";
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


interface ScoringDashboardProps {
    data: AggregatedData;
    initialTab?: 'overview' | 'reviewer' | 'application';
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#a855f7"];
const ELIGIBILITY_SET_NAME = "Eligibility Shortlisting";


const InfoTooltip = ({ content, children, className = "" }: { content: string; children: React.ReactNode, className?: string }) => (
    <UiTooltip delayDuration={300}>
        <TooltipTrigger asChild className={className}>
            {children}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-sm bg-secondary text-secondary-foreground border-secondary">
            {content}
        </TooltipContent>
    </UiTooltip>
);


const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const name = payload[0].name || payload[0].dataKey;
        const value = payload[0].value;
        const labelText = label || payload[0].payload.title;

        return (
            <div className="p-2 bg-background border rounded-md shadow-lg text-sm">
                <p className="font-bold">{labelText}</p>
                <p style={{ color: payload[0].color }}>{`${name}: ${value.toFixed(2)}`}</p>
            </div>
        );
    }
    return null;
};

const CustomRadarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="p-2 bg-background border rounded-md shadow-lg text-sm">
                <p className="font-bold">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <p key={`item-${index}`} style={{ color: entry.color }}>
                        {`${entry.name}: ${entry.value.toFixed(2)}`}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const CustomLineTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const appInfo = payload[0].payload.appData;
        const score = payload[0].value.toFixed(2);

        return (
            <div className="p-2 bg-background border rounded-md shadow-lg text-sm">
                <p className="font-bold mb-1">Score: {score} (out of {appInfo.score_set_name === ELIGIBILITY_SET_NAME ? 6 : 5})</p>
                <p className="text-primary">{appInfo.title}</p>
                <p className="text-muted-foreground text-xs">ID: {appInfo.id}</p>
                <p className="text-primary font-medium mt-1">Applicant: {appInfo.applicant_name}</p>
                <p className="text-muted-foreground text-xs">Email: {appInfo.applicant_email}</p>
            </div>
        );
    }
    return null;
};

const ScoreBreakdownTooltip = ({ appData, reviewerEmail }: { appData: any, reviewerEmail: string }) => {
    const reviewerData = appData.reviewers[reviewerEmail];

    if (!reviewerData || !reviewerData.criteriaScores) {
        return <div className="text-black p-2 bg-background border rounded-md shadow-lg text-sm ">No detailed criteria breakdown available for this reviewer.</div>;
    }

    const isEligibility = appData.score_set_name === ELIGIBILITY_SET_NAME;
    const displayMax = isEligibility ? 6 : 5;
    
    const reviewerCriteriaScores = reviewerData.criteriaScores; 

    const criteriaBreakdown = Object.entries(reviewerCriteriaScores).map(([name, scoreData]: [string, any]) => {
        let normalizedScore = 0;
        
        // Select the correct score/max based on the score set type
        const scoreValue = isEligibility ? scoreData.rawScore : scoreData.weightedScore;
        const maxScoreValue = isEligibility ? scoreData.maxScore : scoreData.weightedMaxScore;
        
        if (maxScoreValue > 0) {
            // Apply normalization: (score / max_score) * displayMax
            normalizedScore = (scoreValue / maxScoreValue) * displayMax;
        } else {
            normalizedScore = scoreValue;
        }
        
        // Round to 2 decimal places for display
        const finalScore = Math.round((normalizedScore + Number.EPSILON) * 100) / 100;

        return {
            name,
            score: finalScore.toFixed(2),
            rawValue: scoreData.rawScore, 
            maxScore: scoreData.maxScore,
        };
    }).sort((a, b) => parseFloat(b.score) - parseFloat(a.score));

    return (
        <div className="p-2 bg-background border max-w-sm rounded-md shadow-lg text-sm">
            <p className="font-bold mb-2 text-[#00000088]">Criteria Breakdown (Normalized to {displayMax})</p>
            <div className="max-h-40 overflow-y-auto pr-2">
                {criteriaBreakdown.map((c) => (
                    <div key={c.name} className="flex justify-between py-0.5">
                        <span className="text-muted-foreground w-40 truncate">{c.name}</span>
                        <span className="font-mono text-foreground">{c.score}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};


const OverviewPanel = ({ data }: { data: AggregatedData }) => {
    const { summary, apps, reviewers } = data;

    const isEligibility = Object.values(data.apps).some(a => a.score_set_name === ELIGIBILITY_SET_NAME);
    const displayMax = isEligibility ? 6 : 5;
    const maxLabel = `out-of-${displayMax}`;

    const MAX_APPLICATIONS = 42;
    const topAppsData = useMemo(() => {
        return Object.values(apps)
            .map(a => ({ id: a.id, title: a.title, avg: a.finalAverage || 0 }))
            .sort((a, b) => b.avg - a.avg)
            .slice(0, MAX_APPLICATIONS);
    }, [apps]);

    const reviewerAveragesData = useMemo(() => {
        return Object.values(reviewers)
            .map(r => ({ name: r.name || r.email, avg: r.avgReviewerScore || 0 }))
            .sort((a, b) => b.avg - a.avg);
    }, [reviewers]);

    const topAppCriteriaData = useMemo(() => {
        const topApp = topAppsData[0] ? apps[topAppsData[0].id] : null;
        if (!topApp) return [];
        return Object.entries(topApp.criteriaAverages).map(([name, value]) => ({
            name,
            value,
        }));
    }, [apps, topAppsData]);

    const maxCriteriaValue = Math.max(displayMax, ...Object.values(topAppCriteriaData).map((d: any) => d.value));

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <InfoTooltip content="The total number of unique applications found in the current score set data.">
                    <div className="flex flex-col gap-1.5 p-3 rounded-lg border cursor-help">
                        <div className="text-xs text-muted-foreground flex items-center gap-1"><LayoutList className="w-3 h-3" /> Applications</div>
                        <div className="text-xl font-bold">{summary.totalApps}</div>
                    </div>
                </InfoTooltip>

                <InfoTooltip content="The total number of unique reviewers who submitted scores in the current score set.">
                    <div className="flex flex-col gap-1.5 p-3 rounded-lg border cursor-help">
                        <div className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Reviewers</div>
                        <div className="text-xl font-bold">{summary.totalReviewers}</div>
                    </div>
                </InfoTooltip>

                <InfoTooltip content="The overall average of the raw/weighted scores (before normalization to the final scale) across all criteria and applications.">
                    <div className="flex flex-col gap-1.5 p-3 rounded-lg border cursor-help">
                        <div className="text-xs text-muted-foreground">Avg Raw Score</div>
                        <div className="text-xl font-bold">{summary.avgRawScore || '—'}</div>
                    </div>
                </InfoTooltip>

                <InfoTooltip content={`The aggregate average of all final application scores, normalized to the standard ${displayMax}.0 scale (average of all reviewer's final scores for each app).`}>
                    <div className="flex flex-col gap-1.5 p-3 rounded-lg border bg-primary/10 cursor-help">
                        <div className="text-xs text-muted-foreground">Avg Final ({maxLabel})</div>
                        <div className="text-xl font-bold text-primary">{summary.avgFinalScore || '—'}</div>
                    </div>
                </InfoTooltip>
            </div>

            <Card>
                <CardHeader>
                    <InfoTooltip content={`Displays the highest-scoring applications based on their calculated final average score (${maxLabel}). This chart is horizontally scrollable and limited to the top 42 entries.`}>
                        <CardTitle className="inline-flex items-center gap-2 cursor-help">
                            Top Applications (by final average {maxLabel}) <Info className="w-4 h-4 text-muted-foreground" />
                        </CardTitle>
                    </InfoTooltip>
                </CardHeader>
                <CardContent className="h-96">
                    <ScrollArea className="w-full">
                        <div style={{ width: `${Math.max(1000, topAppsData.length * 30)}px`, height: '350px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topAppsData} margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <YAxis domain={[0, displayMax]} allowDecimals={false} />
                                    <XAxis
                                        dataKey="title"
                                        interval={0}
                                        angle={-90}
                                        textAnchor="end"
                                        height={100}
                                        tick={{ fontSize: 8 }}
                                        tickFormatter={(tick) => tick.substring(0, 15) + '...'}
                                    />
                                    <Tooltip content={<CustomBarTooltip />} />
                                    <Bar dataKey="avg" name={`Final avg (${maxLabel})`} fill={COLORS[0]} maxBarSize={15} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <InfoTooltip content={`Shows the criteria averages for the highest-scoring application in a radial chart format, normalized to a score out of ${displayMax}.`}>
                            <CardTitle className="inline-flex items-center gap-2 cursor-help">
                                Criteria Share (Top App Criteria Averages) <Info className="w-4 h-4 text-muted-foreground" />
                            </CardTitle>
                        </InfoTooltip>
                    </CardHeader>
                    <CardContent className="h-80">
                        {topAppCriteriaData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart outerRadius={90} data={topAppCriteriaData}>
                                    <PolarGrid />
                                    <PolarAngleAxis dataKey="name" tick={{ fontSize: 10 }} />
                                    <PolarRadiusAxis angle={30} domain={[0, maxCriteriaValue]} allowDecimals={false} />
                                    <Radar name={topAppsData[0].title || 'Top App'} dataKey="value" stroke={COLORS[1]} fill={COLORS[1]} fillOpacity={0.6} />
                                    <Tooltip content={<CustomRadarTooltip />} />
                                </RadarChart>
                            </ResponsiveContainer>
                        ) : <p className="text-center text-muted-foreground pt-10">No criteria data for the top application.</p>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <InfoTooltip content={`Displays the average score given by each reviewer (${maxLabel}) across all applications they reviewed, highlighting scoring tendencies.`}>
                            <CardTitle className="inline-flex items-center gap-2 cursor-help">
                                Reviewer Averages (Distribution) <Info className="w-4 h-4 text-muted-foreground" />
                            </CardTitle>
                        </InfoTooltip>
                    </CardHeader>
                    <CardContent className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={reviewerAveragesData} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" domain={[0, displayMax]} allowDecimals={false} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    width={100}
                                    tickFormatter={(tick) => tick.split(" ")[0]}
                                    tick={{ fontSize: 10 }}
                                />
                                <Tooltip content={CustomBarTooltip} />
                                <Bar dataKey="avg" name={`Reviewer avg (${maxLabel})`} fill={COLORS[2]} maxBarSize={15} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

const ReviewerPanel = ({ data }: { data: AggregatedData }) => {
    const { reviewers, apps } = data;
    const reviewerOptions = useMemo(() =>
        Object.values(reviewers)
            .filter(r => r.countApps > 0)
            .sort((a, b) => (b.avgReviewerScore || 0) - (a.avgReviewerScore || 0)),
        [reviewers]
    );

    const [selectedReviewerEmail, setSelectedReviewerEmail] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAppSlug, setSelectedAppSlug] = useState<string | null>(null);

    const handleReviewerClick = (email: string) => {
        setSelectedReviewerEmail(prevEmail => prevEmail === email ? null : email);
    }

    const selectedReviewer = reviewers[selectedReviewerEmail || ''] || null;

    const firstApp = Object.values(apps)[0] || {};
    const isEligibility = firstApp.score_set_name === ELIGIBILITY_SET_NAME;
    const displayMax = isEligibility ? 6 : 5;
    const maxLabel = `out-of-${displayMax}`;

    const reviewerAppData = useMemo(() => {
        if (!selectedReviewer) return [];
        return Object.entries(selectedReviewer.appScores)
            .map(([appId, score]) => ({
                appId,
                score,
                title: apps[appId]?.title || `App ${appId}`,
                appData: apps[appId],
                reviewerName: selectedReviewer.name,
                reviewerEmail: selectedReviewer.email,
                application_slug: (apps[appId] as any)?.application_slug || appId,
            }))
            .sort((a, b) => b.score - a.score);
    }, [selectedReviewer, apps]);

    const handlePreview = (appId: string) => {
        const app = reviewerAppData.find(a => a.appId === appId);
        if (app) {
            setSelectedAppSlug(app.application_slug);
            setIsModalOpen(true);
        }
    }


    return (
        <div className="space-y-6 flex flex-col h-full">
            <ApplicationDetailsInquiryModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} applicationSlug={selectedAppSlug} />

            <Card>
                <CardHeader><CardTitle>Select Reviewer for Breakdown</CardTitle></CardHeader>
                <CardContent>
                    <ScrollArea className="h-40 w-full whitespace-nowrap">
                        <div className="flex space-x-3 pb-4 flex-wrap gap-2 ">
                            {reviewerOptions.map(r => (
                                <InfoTooltip
                                    key={r.email}
                                    content={`Average score: ${r.avgReviewerScore?.toFixed(2) || 'N/A'}/${displayMax}.00 over ${r.countApps} applications.`}
                                >
                                    <Button
                                        variant={selectedReviewerEmail === r.email ? "default" : "outline"}
                                        onClick={() => handleReviewerClick(r.email)}
                                        className={cn(
                                            "h-auto px-4 py-2 flex-shrink-0 cursor-help",
                                            selectedReviewerEmail !== r.email && "hover:bg-muted/50"
                                        )}
                                    >
                                        <div className="flex flex-col items-start">
                                            <span className="font-semibold text-sm">{r.name || r.email}</span>
                                            <span className="text-xs">{r.avgReviewerScore?.toFixed(2) || '—'} / {displayMax}.00</span>
                                            <span className="text-xs text-muted-foreground/80">{r.countApps} Apps</span>
                                        </div>
                                        {selectedReviewerEmail === r.email && <CheckCircle className="w-4 h-4 ml-2" />}
                                    </Button>
                                </InfoTooltip>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>

            {selectedReviewer ? (
                <Card className="flex flex-col flex-1">
                    <CardHeader>
                        <CardTitle>{selectedReviewer.name || selectedReviewer.email}</CardTitle>
                        <CardDescription>
                            Reviewed {selectedReviewer.countApps} applications — Average Score: {selectedReviewer.avgReviewerScore?.toFixed(2) || '—'} ({maxLabel})
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 flex flex-col h-full">

                        <Card>
                            <CardHeader>
                                <InfoTooltip content={`A visualization of the reviewer's score (${maxLabel}) for each application they assessed, revealing any trends or outliers in their scoring behavior.`}>
                                    <CardTitle className="inline-flex items-center gap-2 cursor-help">
                                        Scoring Pattern (Line Chart) <Info className="w-4 h-4 text-muted-foreground" />
                                    </CardTitle>
                                </InfoTooltip>
                            </CardHeader>
                            <CardContent className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={reviewerAppData} margin={{ left: 10, top: 10, right: 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <YAxis domain={[0, displayMax]} allowDecimals={false} />
                                        <XAxis
                                            dataKey="appId"
                                            tickFormatter={(id) => `ID ${id}`}
                                            interval="preserveStartEnd"
                                            angle={-15}
                                            textAnchor="end"
                                            height={50}
                                            tick={{ fontSize: 10 }}
                                        />
                                        <Tooltip content={<CustomLineTooltip />} />
                                        <Line type="monotone" dataKey="score" stroke={COLORS[3]} strokeWidth={2} name={`Reviewer Score (${maxLabel})`} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <div className="flex-1 border rounded-lg overflow-hidden min-h-[400px]">
                            <ScrollArea className="h-full">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-background z-10">
                                        <TableRow>
                                            <TableHead className="w-[100px]">
                                                <InfoTooltip content="The unique numerical ID for the application.">
                                                    <span className="cursor-help inline-flex items-center gap-1">App ID <Info className="w-3 h-3 text-muted-foreground" /></span>
                                                </InfoTooltip>
                                            </TableHead>
                                            <TableHead>Application</TableHead>
                                            <TableHead className="text-right w-[150px]">
                                                <InfoTooltip content={`The final score (${maxLabel}) given by this reviewer for the application. Hover over the score value for a breakdown by scoring criterion.`}>
                                                    <span className="cursor-help inline-flex items-center gap-1 justify-end">Score ({maxLabel}) <Info className="w-3 h-3 text-muted-foreground" /></span>
                                                </InfoTooltip>
                                            </TableHead>
                                            <TableHead className="text-right w-[100px]">Preview</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {reviewerAppData.map((app) => (
                                            <TableRow key={app.appId}>
                                                <TableCell className="font-mono">{app.appId}</TableCell>
                                                <TableCell>{app.title.substring(0, 60)}...</TableCell>
                                                <TableCell className="text-right font-bold w-[150px]">
                                                    <UiTooltip delayDuration={0}>
                                                        <TooltipTrigger asChild>
                                                            <span className="cursor-help text-primary/80 hover:text-primary">{app.score.toFixed(2)}</span>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="p-0 bg-background border max-w-sm">
                                                            <ScoreBreakdownTooltip appData={app.appData} reviewerEmail={selectedReviewer.email} />
                                                        </TooltipContent>
                                                    </UiTooltip>
                                                </TableCell>
                                                <TableCell className="text-right w-[100px]">
                                                    <Button variant="ghost" size="sm" onClick={() => handlePreview(app.appId)}>
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card className="p-8 text-center text-muted-foreground">
                    Please select a reviewer card above to see their detailed breakdown and scoring pattern.
                </Card>
            )}
        </div>
    );
};

const ApplicationPanel = ({ data }: { data: AggregatedData }) => {
    const { apps } = data;
    const appOptions = Object.values(apps).filter(a => a.finalAverage !== null).sort((a, b) => (b.finalAverage || 0) - (a.finalAverage || 0));
    const [selectedAppId, setSelectedAppId] = useState<string | undefined>(appOptions[0]?.id);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAppSlug, setSelectedAppSlug] = useState<string | null>(null);

    useEffect(() => {
        if (!selectedAppId && appOptions.length > 0) {
            setSelectedAppId(appOptions[0].id);
        }
    }, [selectedAppId, appOptions]);

    const selectedApp = apps[selectedAppId || ''] || null;

    const appReviewerData = useMemo(() => {
        if (!selectedApp) return [];
        return Object.entries(selectedApp.finalReviewerScores)
            .map(([email, score]) => ({
                email,
                score,
                name: data.reviewers[email]?.name || email,
                appData: selectedApp,
            }))
            .sort((a, b) => b.score - a.score);
    }, [selectedApp, data.reviewers]);

    const isEligibility = selectedApp?.score_set_name === ELIGIBILITY_SET_NAME;
    const displayMax = isEligibility ? 6 : 5;
    const maxLabel = `out-of-${displayMax}`;

    const maxCriteriaValue = Math.max(displayMax, ...Object.values(selectedApp?.criteriaAverages || {}).map(v => v));

    const criteriaData = useMemo(() => {
        if (!selectedApp) return [];
        return Object.entries(selectedApp.criteriaAverages).map(([name, value]) => ({ name, value }));
    }, [selectedApp]);

    const handlePreview = (appId: string) => {
        const app = apps[appId];
        if (app) {
            setSelectedAppSlug((app as any).application_slug || appId);
            setIsModalOpen(true);
        }
    }


    return (
        <div className="space-y-6">
            <ApplicationDetailsInquiryModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} applicationSlug={selectedAppSlug} />
            <Card>
                <CardHeader>
                    <InfoTooltip content="Select a specific application to view how individual reviewers scored it, and to see its criteria breakdown.">
                        <CardTitle className="inline-flex items-center gap-2 cursor-help">
                            Select Application <Info className="w-4 h-4 text-muted-foreground" />
                        </CardTitle>
                    </InfoTooltip>
                    <CardDescription>Dive into a specific application's scores and criteria breakdown.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col space-y-2">
                        <Label>Application</Label>
                        <Select value={selectedAppId} onValueChange={setSelectedAppId} >
                            <SelectTrigger>
                                <SelectValue placeholder="Select an application" />
                            </SelectTrigger>
                            <SelectContent className="w-[50vw]">
                                {appOptions.map(a => (
                                    <SelectItem key={a.id} value={a.id}>
                                        App {a.id}: {a.title} ({a.finalAverage?.toFixed(2) || '—'})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {selectedApp && (
                <Card>
                    <CardHeader>
                        <CardTitle>App {selectedApp.id} - {selectedApp.title}</CardTitle>
                        <CardDescription>
                            Marked by {appReviewerData.length} reviewers — Final Average Score: {selectedApp.finalAverage?.toFixed(2) || '—'} ({maxLabel})
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader>
                                    <InfoTooltip content={`Compares the final scores (${maxLabel}) given by all reviewers for the currently selected application.`}>
                                        <CardTitle className="inline-flex items-center gap-2 cursor-help">
                                            Reviewer Comparison (Bar Chart) <Info className="w-4 h-4 text-muted-foreground" />
                                        </CardTitle>
                                    </InfoTooltip>
                                </CardHeader>
                                <CardContent className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={appReviewerData} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis
                                                dataKey="name"
                                                interval={0}
                                                angle={-15}
                                                textAnchor="end"
                                                height={50}
                                                tickFormatter={(tick) => tick.split(" ")[0]}
                                                tick={{ fontSize: 10 }}
                                            />
                                            <YAxis domain={[0, displayMax]} allowDecimals={false} />
                                            <Tooltip content={CustomBarTooltip} />
                                            <Bar dataKey="score" name={`Reviewer Score (${maxLabel})`} fill={COLORS[0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <InfoTooltip content={`Shows the average score the application received across all reviewers for each scoring criterion, normalized to a score out of ${displayMax}.`}>
                                        <CardTitle className="inline-flex items-center gap-2 cursor-help">
                                            Criteria Average (Radar Chart) <Info className="w-4 h-4 text-muted-foreground" />
                                        </CardTitle>
                                    </InfoTooltip>
                                </CardHeader>
                                <CardContent className="h-64">
                                    {criteriaData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadarChart outerRadius={90} data={criteriaData}>
                                                <PolarGrid />
                                                <PolarAngleAxis dataKey="name" tick={{ fontSize: 10 }} />
                                                <PolarRadiusAxis angle={30} domain={[0, maxCriteriaValue]} allowDecimals={false} />
                                                <Radar name={selectedApp.title} dataKey="value" stroke={COLORS[4]} fill={COLORS[4]} fillOpacity={0.6} />
                                                <Tooltip content={<CustomRadarTooltip />} />
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    ) : <p className="text-center text-muted-foreground pt-10">No criteria data for this application.</p>}
                                </CardContent>
                            </Card>
                        </div>
                        <div className="flex-1 border rounded-lg overflow-hidden min-h-[300px]">
                            <ScrollArea className="h-full">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-background z-10">
                                        <TableRow>
                                            <TableHead>
                                                <InfoTooltip content="The reviewer's name or email.">
                                                    <span className="cursor-help inline-flex items-center gap-1">Reviewer <Info className="w-3 h-3 text-muted-foreground" /></span>
                                                </InfoTooltip>
                                            </TableHead>
                                            <TableHead className="text-right w-[150px]">
                                                <InfoTooltip content={`The score (${maxLabel}) given by this reviewer. Hover over the score value for a criteria breakdown.`}>
                                                    <span className="cursor-help inline-flex items-center gap-1 justify-end">Score ({maxLabel}) <Info className="w-3 h-3 text-muted-foreground" /></span>
                                                </InfoTooltip>
                                            </TableHead>
                                            <TableHead className="text-right w-[100px]">Preview</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {appReviewerData.map((r) => (
                                            <TableRow key={r.email}>
                                                <TableCell>{r.name || r.email}</TableCell>
                                                <TableCell className="text-right font-bold w-[150px]">
                                                    <UiTooltip delayDuration={0}>
                                                        <TooltipTrigger asChild>
                                                            <span className="cursor-help text-primary/80 hover:text-primary">{r.score.toFixed(2)}</span>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="p-0 bg-background border max-w-sm">
                                                            <ScoreBreakdownTooltip appData={selectedApp} reviewerEmail={r.email} />
                                                        </TooltipContent>
                                                    </UiTooltip>
                                                </TableCell>
                                                <TableCell className="text-right w-[100px]">
                                                    <Button variant="ghost" size="sm" onClick={() => handlePreview(selectedApp.id)}>
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </div>


                    </CardContent>
                </Card>
            )}
        </div>
    );
};


export function ScoringDashboard({ data, initialTab = 'overview' }: ScoringDashboardProps) {
    return (
        <TooltipProvider delayDuration={0}>
            <div className="space-y-6">
                {initialTab === 'overview' && <OverviewPanel data={data} />}
                {initialTab === 'reviewer' && <ReviewerPanel data={data} />}
                {initialTab === 'application' && <ApplicationPanel data={data} />}
            </div>
        </TooltipProvider>
    );
}