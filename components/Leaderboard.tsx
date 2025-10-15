"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Checkbox } from "./ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Skeleton } from "./ui/skeleton";
import { Input } from "./ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { RefreshCw, Trophy, AlertCircle, ChevronLeft, ChevronRight, ArrowUpDown, Tag, Search, Eye, MapPin, Loader2, Download } from 'lucide-react';
import { getLeaderboardPage, getScoreSets, syncLeaderboard, getMunicipalities, LeaderboardEntry, ScoreBreakdown, AnalyticsLeaderboardEntry, getAllLeaderboardDataForAnalytics } from '../actions/leaderboard';
import type { AppRawData } from '../actions/analysis';
import { getRawApplicationsBySlugs } from '../actions/analysis';
import { addEligibleTagToApplications } from '../actions/application';
import { useToast } from "./ui/use-toast";
import { Badge } from './ui/badge';
import { ApplicationDetailsInquiryModal } from './ApplicationDetailsInquiryModal';
import { ScoreAnalyticsCard } from './ScoreAnalyticsCard';
import { LeaderboardBreakdowns, FilteredAppRawData } from './LeaderboardBreakdowns';
import { GenerateReportButton } from './GenerateReportButton';


type SortableKeys = 'title' | 'total_score';

interface ScoreSet {
    slug: string;
    name: { en_GB: string };
}

interface LeaderboardProps {
    config: { apiKey: string };
}

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

const SkeletonRow = () => (
    <TableRow>
        <TableCell><Skeleton className="h-5 w-5" /></TableCell>
        <TableCell><Skeleton className="h-5 w-8" /></TableCell>
        <TableCell><Skeleton className="h-5 w-full" /></TableCell>
        <TableCell colSpan={3}><Skeleton className="h-5 w-full" /></TableCell>
        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
    </TableRow>
);

const getScoreColorClass = (rawValue: number, maxScore: number): string => {
    if (maxScore === 0) return 'text-muted-foreground';
    const ratio = rawValue / maxScore;
    if (ratio >= 0.75) return 'text-green-500 font-semibold';
    if (ratio >= 0.5) return 'text-yellow-500 font-medium';
    if (ratio >= 0.25) return 'text-orange-500';
    return 'text-red-500';
};

export function Leaderboard({ config }: LeaderboardProps) {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [filteredApps, setFilteredApps] = useState<FilteredAppRawData[]>([]);
    const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
    const [scoreSets, setScoreSets] = useState<ScoreSet[]>([]);
    const [municipalities, setMunicipalities] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingSets, setIsLoadingSets] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isTagging, setIsTagging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedScoreSet, setSelectedScoreSet] = useState<string>("");
    const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAppSlug, setSelectedAppSlug] = useState<string | null>(null);
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
    const [currentScoreSetName, setCurrentScoreSetName] = useState<string>("");
    
    const tableContainerRef = useRef<HTMLDivElement>(null);

    const { toast } = useToast();

    const [pagination, setPagination] = useState({ currentPage: 1, lastPage: 1, total: 0, perPage: 20 });
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'asc' | 'desc' }>({ key: 'total_score', direction: 'desc' });

    const [titleSearch, setTitleSearch] = useState("");
    const debouncedTitleSearch = useDebounce(titleSearch, 500);
    const [tagFilter, setTagFilter] = useState("");
    const debouncedTagFilter = useDebounce(tagFilter, 500);
    const [minScore, setMinScore] = useState<string>("");
    const [maxScore, setMaxScore] = useState<string>("");
    const debouncedMinScore = useDebounce(minScore, 500);
    const debouncedMaxScore = useDebounce(maxScore, 500);
    const [municipalityFilter, setMunicipalityFilter] = useState("all");
    const debouncedMunicipalityFilter = useDebounce(municipalityFilter, 500);

    const uniqueCriteria = useMemo(() => {
        const criteriaNames = new Set<string>();
        leaderboard.forEach(entry => {
            entry.scoreBreakdown?.forEach(crit => criteriaNames.add(crit.name));
        });
        return Array.from(criteriaNames);
    }, [leaderboard]);
    
    const renderScore = (scoreEntry: ScoreBreakdown | undefined): string => {
        if (!scoreEntry) return 'N/A';
        if (scoreEntry.score.includes('/')) return scoreEntry.score;
        return scoreEntry.rawValue.toFixed(2);
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!config.apiKey) { setError("API key is not configured."); setIsLoadingSets(false); return; }
            setIsLoadingSets(true);
            try {
                const [sets, muniData] = await Promise.all([getScoreSets(config), getMunicipalities()]);
                setScoreSets(sets);
                setMunicipalities(muniData);
                if (sets.length > 0) {
                    const eligibilitySet = sets.find(set => set.name.en_GB === 'Eligibility Shortlisting');
                    const selectedSet = eligibilitySet || sets[0];
                    setSelectedScoreSet(selectedSet.slug);
                    setCurrentScoreSetName(selectedSet.name.en_GB);
                }
            } catch (err: any) { setError("Failed to load setup data."); }
            finally { setIsLoadingSets(false); }
        };
        fetchData();
    }, [config]);

    const fetchLeaderboard = useCallback(async () => {
        if (!selectedScoreSet) return;
        setIsLoading(true);
        setError(null);
        const parsedMin = debouncedMinScore ? parseFloat(debouncedMinScore) : undefined;
        const parsedMax = debouncedMaxScore ? parseFloat(debouncedMaxScore) : undefined;
        try {
            const response = await getLeaderboardPage(selectedScoreSet, pagination.currentPage, pagination.perPage, sortConfig, debouncedTitleSearch, debouncedTagFilter, parsedMin, parsedMax, debouncedMunicipalityFilter);
            setLeaderboard(response.data as LeaderboardEntry[]);
            setPagination(p => ({ ...p, currentPage: response.current_page, lastPage: response.last_page, total: response.total }));
        } catch (err: any) {
            setError(err.message || "Failed to load leaderboard data.");
        } finally {
            setIsLoading(false);
        }
    }, [selectedScoreSet, pagination.currentPage, pagination.perPage, sortConfig, debouncedTitleSearch, debouncedTagFilter, debouncedMinScore, debouncedMaxScore, debouncedMunicipalityFilter]);

    const fetchAnalyticsData = useCallback(async () => {
        if (!selectedScoreSet) return;
        setIsAnalyticsLoading(true);
        const parsedMin = debouncedMinScore ? parseFloat(debouncedMinScore) : undefined;
        const parsedMax = debouncedMaxScore ? parseFloat(debouncedMaxScore) : undefined;
        try {
            const minimalData = await getAllLeaderboardDataForAnalytics(selectedScoreSet, debouncedTitleSearch, debouncedTagFilter, parsedMin, parsedMax, debouncedMunicipalityFilter);
            if (minimalData.length === 0) { setFilteredApps([]); return; }
            const slugs = minimalData.map(d => d.slug);
            const rawDataList = await getRawApplicationsBySlugs(slugs);
            const rawDataMap = rawDataList.reduce((acc, app) => ({ ...acc, [app.slug]: app }), {} as Record<string, AppRawData>);
            const combinedData = minimalData.map(min => {
                const rawApp = rawDataMap[min.slug];
                return rawApp ? { ...rawApp, totalScore: min.totalScore, municipality: min.municipality } as FilteredAppRawData : null;
            }).filter((d): d is FilteredAppRawData => d !== null);
            setFilteredApps(combinedData);
        } catch (err) {
            console.error("Failed to load analytics data:", err);
            setFilteredApps([]);
        } finally {
            setIsAnalyticsLoading(false);
        }
    }, [selectedScoreSet, debouncedTitleSearch, debouncedTagFilter, debouncedMinScore, debouncedMaxScore, debouncedMunicipalityFilter]);

    useEffect(() => {
        if (pagination.currentPage !== 1) setPagination(p => ({ ...p, currentPage: 1 })); else fetchLeaderboard();
        fetchAnalyticsData();
    }, [selectedScoreSet, pagination.perPage, sortConfig, debouncedTitleSearch, debouncedTagFilter, debouncedMinScore, debouncedMaxScore, debouncedMunicipalityFilter]);

    useEffect(() => { fetchLeaderboard(); }, [pagination.currentPage]);

    const handleSync = async () => {
        if (!config.apiKey || !selectedScoreSet) return;
        setIsSyncing(true);
        setError(null);
        try {
            toast({ title: "Sync Started", description: "Fetching ALL leaderboard data. This may take a while..." });
            const result = await syncLeaderboard(config, selectedScoreSet);
            toast({ title: "Sync Complete", description: `Synchronized ${result.syncedCount} applications.` });
            setLastSyncTime(new Date().toISOString());
            const muniData = await getMunicipalities();
            setMunicipalities(muniData);
            setPagination(p => ({ ...p, currentPage: 1 }));
        } catch (err: any) {
            setError(err.message || "Synchronization failed.");
            toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
        } finally {
            setIsSyncing(false);
        }
    };

    const handleViewDetails = (slug: string) => { setSelectedAppSlug(slug); setIsModalOpen(true); };
    const handleSort = (key: SortableKeys) => { setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' })); };
    const renderSortArrow = (column: SortableKeys) => (sortConfig.key !== column ? <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" /> : sortConfig.direction === 'asc' ? '▲' : '▼');
    const changePage = (newPage: number) => { if (newPage > 0 && newPage <= pagination.lastPage) setPagination(prev => ({ ...prev, currentPage: newPage })); };
    const isEligibleForTagging = (entry: LeaderboardEntry) => !entry.tags?.includes('Eligible-1');
    const eligibleRows = useMemo(() => leaderboard.filter(isEligibleForTagging), [leaderboard]);
    const handleSelectRow = (slug: string, checked: boolean) => setSelectedSlugs(prev => checked ? [...prev, slug] : prev.filter(s => s !== slug));
    const handleSelectAll = (checked: boolean) => setSelectedSlugs(checked ? eligibleRows.map(r => r.slug) : []);

    const handleTagSelected = async () => {
        if (selectedSlugs.length === 0) return;
        setIsTagging(true);
        try {
            await addEligibleTagToApplications(config, selectedSlugs, ["Eligible-1"]);
            toast({ title: "Success", description: `${selectedSlugs.length} applications tagged.` });
            setSelectedSlugs([]);
            fetchLeaderboard();
        } catch (err: any) {
            toast({ title: "Tagging Failed", description: err.message, variant: "destructive" });
        } finally { setIsTagging(false); }
    };

    const cleanMunicipalities = municipalities.filter(muni => muni && muni.trim() !== "");
    const showMunicipalityColumn = debouncedMunicipalityFilter === 'all';
    const totalColumns = 6 + uniqueCriteria.length + (showMunicipalityColumn ? 1 : 0);

    return (
        <Card className="mt-6 shadow-lg">
            <CardHeader>
                <div className="md:flex justify-between items-start">
                    <div>
                        <CardTitle className="flex items-center gap-2"><Trophy className="w-6 h-6" /> Leaderboard & Analytics</CardTitle>
                        <CardDescription>Analyze and manage applications synchronized from GoodGrants.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 mt-4 md:mt-0 flex-wrap">
                        <GenerateReportButton filteredApps={filteredApps} municipalityFilter={debouncedMunicipalityFilter} lastSyncTime={lastSyncTime} scoreSetName={currentScoreSetName} minScore={debouncedMinScore} maxScore={debouncedMaxScore} disabled={isSyncing || isAnalyticsLoading} />
                        <Button onClick={handleSync} disabled={isSyncing || !selectedScoreSet}><RefreshCw className="mr-2 h-4 w-4" /> Sync</Button>
                        <Select value={selectedScoreSet} onValueChange={(slug) => {
                            const set = scoreSets.find(s => s.slug === slug);
                            if (set) setCurrentScoreSetName(set.name.en_GB);
                            setSelectedScoreSet(slug);
                        }} disabled={isLoadingSets || isSyncing}>
                            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Select score set" /></SelectTrigger>
                            <SelectContent>{scoreSets.map(set => <SelectItem key={set.slug} value={set.slug}>{set.name.en_GB}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="leaderboard">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
                        <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    </TabsList>
                    <TabsContent value="leaderboard">
                        <div ref={tableContainerRef}>
                            <div className="my-4 p-4 border rounded-lg bg-muted/40">
                               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                                    <Input placeholder="Search title..." value={titleSearch} onChange={(e) => setTitleSearch(e.target.value)} className="pl-4" disabled={isSyncing} />
                                    <Select value={municipalityFilter} onValueChange={setMunicipalityFilter} disabled={isSyncing || municipalities.length === 0}>
                                        <SelectTrigger><SelectValue placeholder="Filter Municipality" /></SelectTrigger>
                                        <SelectContent><SelectItem value="all">All Municipalities</SelectItem>{cleanMunicipalities.map(muni => <SelectItem key={muni} value={muni}>{muni}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <Input type="number" placeholder="Min Score" value={minScore} onChange={(e) => setMinScore(e.target.value)} disabled={isSyncing} />
                                    <Input type="number" placeholder="Max Score" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} disabled={isSyncing} />
                                </div>
                            </div>
                            <div className="my-4 flex justify-between items-center">
                                <div className="text-sm text-muted-foreground">{pagination.total} applications found.</div>
                                {selectedSlugs.length > 0 && (<Button onClick={handleTagSelected} disabled={isTagging || isSyncing}><Tag className="mr-2 h-4 w-4" /> Tag {selectedSlugs.length} as Eligible</Button>)}
                            </div>
                            <div className="rounded-md border overflow-x-auto">
                                <Table className="min-w-[1200px]">
                                    <TableHeader><TableRow>
                                        <TableHead className="w-12"><Checkbox checked={selectedSlugs.length > 0 && eligibleRows.length > 0 && selectedSlugs.length === eligibleRows.length} onCheckedChange={handleSelectAll} disabled={eligibleRows.length === 0 || isSyncing} /></TableHead>
                                        <TableHead className="w-16">Rank</TableHead>
                                        <TableHead className="cursor-pointer w-[30%]" onClick={() => handleSort('title')}>Application Title & Tags {renderSortArrow('title')}</TableHead>
                                        {showMunicipalityColumn && (<TableHead className="w-[150px] border-l">Municipality</TableHead>)}
                                        {uniqueCriteria.map(name => (<TableHead key={name} className="text-center w-[100px] text-xs font-semibold border-l">{name}</TableHead>))}
                                        <TableHead className="cursor-pointer text-center w-[100px] border-l" onClick={() => handleSort('total_score')}>Total Score {renderSortArrow('total_score')}</TableHead>
                                        <TableHead className="w-16 text-center">Actions</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                        {isLoading || isSyncing ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
                                        : error ? <TableRow><TableCell colSpan={totalColumns} className="h-24 text-center text-red-500"><AlertCircle className="mx-auto h-6 w-6 mb-2" />{error}</TableCell></TableRow>
                                        : leaderboard.length > 0 ? leaderboard.map((entry, index) => {
                                            const rank = (pagination.currentPage - 1) * pagination.perPage + index + 1;
                                            return (<TableRow key={entry.slug}>
                                                <TableCell>{isEligibleForTagging(entry) && <Checkbox checked={selectedSlugs.includes(entry.slug)} onCheckedChange={(c) => handleSelectRow(entry.slug, !!c)} />}</TableCell>
                                                <TableCell className="font-bold text-lg">{rank}</TableCell>
                                                <TableCell><div>{entry.title}</div><div className="flex flex-wrap gap-1 mt-2">{entry.tags.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div></TableCell>
                                                {showMunicipalityColumn && <TableCell className="border-l text-sm"><Badge variant="outline">{entry.municipality || 'N/A'}</Badge></TableCell>}
                                                {uniqueCriteria.map(critName => {
                                                    const scoreEntry = entry.scoreBreakdown?.find(c => c.name === critName);
                                                    return (<TableCell key={critName} className={`text-center font-mono text-sm border-l ${getScoreColorClass(scoreEntry?.rawValue || 0, scoreEntry?.maxScore || 2)}`}>{renderScore(scoreEntry)}</TableCell>);
                                                })}
                                                <TableCell className="text-center border-l"><TooltipProvider><Tooltip><TooltipTrigger asChild><span className="cursor-help font-semibold text-lg text-green-600">{entry.totalScore.toFixed(2)}</span></TooltipTrigger><TooltipContent><p className="font-bold">Breakdown:</p>{entry.scoreBreakdown.map(c => <div key={c.name}>{c.name}: <span className="font-mono">{renderScore(c)}</span></div>)}</TooltipContent></Tooltip></TooltipProvider></TableCell>
                                                <TableCell className="text-center"><Button variant="ghost" size="icon" onClick={() => handleViewDetails(entry.slug)}><Eye className="h-4 w-4" /></Button></TableCell>
                                            </TableRow>);
                                        })
                                        : <TableRow><TableCell colSpan={totalColumns} className="h-24 text-center">No results found for the current filters.</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="flex items-center justify-end space-x-2 py-4">
                                <Select value={pagination.perPage.toString()} onValueChange={(v) => setPagination(p => ({ ...p, perPage: Number(v), currentPage: 1 }))}>
                                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="10">10/page</SelectItem><SelectItem value="20">20/page</SelectItem><SelectItem value="50">50/page</SelectItem><SelectItem value="100">100/page</SelectItem></SelectContent>
                                </Select>
                                <span className="text-sm text-muted-foreground">Page {pagination.currentPage} of {pagination.lastPage}</span>
                                <Button variant="outline" size="sm" onClick={() => changePage(pagination.currentPage - 1)} disabled={pagination.currentPage <= 1}><ChevronLeft className="h-4 w-4" /></Button>
                                <Button variant="outline" size="sm" onClick={() => changePage(pagination.currentPage + 1)} disabled={pagination.currentPage >= pagination.lastPage}><ChevronRight className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    </TabsContent>
                    <TabsContent value="analytics">
                        <div className="my-4 p-4 border rounded-lg bg-muted/40">
                             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
                                <Input placeholder="Search title..." value={titleSearch} onChange={(e) => setTitleSearch(e.target.value)} className="pl-4" disabled={isSyncing} />
                                <Select value={municipalityFilter} onValueChange={setMunicipalityFilter} disabled={isSyncing || municipalities.length === 0}>
                                    <SelectTrigger><SelectValue placeholder="Filter Municipality" /></SelectTrigger>
                                    <SelectContent><SelectItem value="all">All Municipalities</SelectItem>{cleanMunicipalities.map(muni => <SelectItem key={muni} value={muni}>{muni}</SelectItem>)}</SelectContent>
                                </Select>
                                <Input type="number" placeholder="Min Score" value={minScore} onChange={(e) => setMinScore(e.target.value)} disabled={isSyncing} />
                                <Input type="number" placeholder="Max Score" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} disabled={isSyncing} />
                            </div>
                        </div>
                        <ScoreAnalyticsCard leaderboard={filteredApps as unknown as AnalyticsLeaderboardEntry[]} municipalityFilter={debouncedMunicipalityFilter} isLoading={isAnalyticsLoading} scoreSetName={currentScoreSetName} filteredApps={filteredApps} />
                    </TabsContent>
                </Tabs>
            </CardContent>
            <ApplicationDetailsInquiryModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} applicationSlug={selectedAppSlug} />
        </Card>
    );
}

