"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Checkbox } from "./ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Skeleton } from "./ui/skeleton";
import { Input } from "./ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { RefreshCw, Trophy, AlertCircle, ChevronLeft, ChevronRight, ArrowUpDown, Tag, Search, Eye, MapPin, Loader2, LineChart } from 'lucide-react';
import { getLeaderboardPage, getScoreSets, syncLeaderboard, getMunicipalities, LeaderboardEntry, ScoreBreakdown, AnalyticsLeaderboardEntry, getAllLeaderboardDataForAnalytics } from '../actions/leaderboard';
import type { AppRawData } from '../actions/analysis';
import { getRawApplicationsBySlugs } from '../actions/analysis';
import { addEligibleTagToApplications } from '../actions/application';
import { useToast } from "./ui/use-toast";
import { Badge } from './ui/badge';
import { ApplicationDetailsInquiryModal } from './ApplicationDetailsInquiryModal';
import { ScoreAnalyticsCard } from './ScoreAnalyticsCard';
import type { FilteredAppRawData } from './LeaderboardBreakdowns';
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
    const { toast } = useToast();
    const [pagination, setPagination] = useState({ currentPage: 1, lastPage: 1, total: 0, perPage: 20 });
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'asc' | 'desc' }>({ key: 'total_score', direction: 'desc' });
    const [titleSearch, setTitleSearch] = useState("");
    const debouncedTitleSearch = useDebounce(titleSearch, 500);
    const [minScore, setMinScore] = useState<string>("");
    const [maxScore, setMaxScore] = useState<string>("");
    const debouncedMinScore = useDebounce(minScore, 500);
    const debouncedMaxScore = useDebounce(maxScore, 500);
    const [municipalityFilter, setMunicipalityFilter] = useState("all");
    const debouncedMunicipalityFilter = useDebounce(municipalityFilter, 500);

    const uniqueCriteria = useMemo(() => {
        const criteriaNames = new Set<string>();
        leaderboard.forEach(entry => {
            entry.scoreBreakdown?.forEach(crit => {
                criteriaNames.add(crit.name);
            });
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
            } catch (err: any) { setError("Failed to load setup data (score sets or municipalities)."); }
            finally { setIsLoadingSets(false); }
        };
        fetchData();
    }, [config]);

    const fetchLeaderboard = useCallback(async () => {
        if (!selectedScoreSet) return;
        setIsLoading(true);
        setError(null);
        const parsedMinScore = debouncedMinScore ? parseFloat(debouncedMinScore) : undefined;
        const parsedMaxScore = debouncedMaxScore ? parseFloat(debouncedMaxScore) : undefined;
        if (parsedMinScore !== undefined && isNaN(parsedMinScore)) { setError("Invalid Minimum Score."); setIsLoading(false); return; }
        if (parsedMaxScore !== undefined && isNaN(parsedMaxScore)) { setError("Invalid Maximum Score."); setIsLoading(false); return; }
        try {
            const response = await getLeaderboardPage(selectedScoreSet, pagination.currentPage, pagination.perPage, sortConfig, debouncedTitleSearch, "", parsedMinScore, parsedMaxScore, debouncedMunicipalityFilter);
            if (response) {
                setLeaderboard(response.data as LeaderboardEntry[]);
                setPagination(p => ({ ...p, currentPage: response.current_page, lastPage: response.last_page, total: response.total }));
                setError(null);
            } else { throw new Error("Invalid response from server."); }
        } catch (err: any) { setError(err.message || "Failed to load leaderboard. Please sync data."); }
        finally { setIsLoading(false); }
    }, [selectedScoreSet, pagination.currentPage, pagination.perPage, sortConfig, debouncedTitleSearch, debouncedMinScore, debouncedMaxScore, debouncedMunicipalityFilter]);

    const fetchAnalyticsData = useCallback(async () => {
        if (!selectedScoreSet) return;
        setIsAnalyticsLoading(true);
        const parsedMinScore = debouncedMinScore ? parseFloat(debouncedMinScore) : undefined;
        const parsedMaxScore = debouncedMaxScore ? parseFloat(debouncedMaxScore) : undefined;
        if ((parsedMinScore !== undefined && isNaN(parsedMinScore)) || (parsedMaxScore !== undefined && isNaN(parsedMaxScore))) {
            setIsAnalyticsLoading(false); setFilteredApps([]); return;
        }
        try {
            const minimalData = await getAllLeaderboardDataForAnalytics(selectedScoreSet, debouncedTitleSearch, "", parsedMinScore, parsedMaxScore, debouncedMunicipalityFilter);
            if (minimalData.length === 0) { setFilteredApps([]); return; }
            const slugs = minimalData.map(d => d.slug);
            const rawDataList = await getRawApplicationsBySlugs(slugs);
            const rawDataMap = rawDataList.reduce((acc, app) => { acc[app.slug] = app; return acc; }, {} as Record<string, AppRawData>);
            const combinedData: FilteredAppRawData[] = minimalData.map(min => {
                const rawApp = rawDataMap[min.slug];
                if (!rawApp) return null;
                return { ...rawApp, totalScore: min.totalScore, municipality: min.municipality } as FilteredAppRawData;
            }).filter((d): d is FilteredAppRawData => d !== null);
            setFilteredApps(combinedData);
        } catch (err) { console.error("Failed to load analytics data:", err); setFilteredApps([]); }
        finally { setIsAnalyticsLoading(false); }
    }, [selectedScoreSet, debouncedTitleSearch, debouncedMinScore, debouncedMaxScore, debouncedMunicipalityFilter]);

    useEffect(() => {
        if (pagination.currentPage !== 1) setPagination(p => ({ ...p, currentPage: 1 }));
        else fetchLeaderboard();
        fetchAnalyticsData();
    }, [selectedScoreSet, pagination.perPage, sortConfig, debouncedTitleSearch, debouncedMinScore, debouncedMaxScore, debouncedMunicipalityFilter]);

    useEffect(() => { fetchLeaderboard(); }, [pagination.currentPage]);

    const handleSync = async () => {
        if (!config.apiKey || !selectedScoreSet) return;
        setIsSyncing(true); setError(null);
        try {
            toast({ title: "Sync Started", description: "Fetching ALL leaderboard data. This may take time...", duration: 5000 });
            const result = await syncLeaderboard(config, selectedScoreSet);
            toast({ title: "Sync Complete", description: `Synchronized ${result.syncedCount} applications.`, duration: 3000 });
            setLastSyncTime(new Date().toISOString());
            setMunicipalities(await getMunicipalities());
            setPagination(p => ({ ...p, currentPage: 1 }));
        } catch (err: any) {
            setError(err.message || "Synchronization failed.");
            toast({ title: "Sync Failed", description: err.message || "Failed to sync from API.", variant: "destructive" });
        } finally { setIsSyncing(false); }
    };

    const handleSort = (key: SortableKeys) => { setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' })); };
    const renderSortArrow = (column: SortableKeys) => { if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />; return sortConfig.direction === 'asc' ? '▲' : '▼'; };
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
        } catch (err: any) { toast({ title: "Tagging Failed", description: err.message, variant: "destructive" }); }
        finally { setIsTagging(false); }
    };

    const cleanMunicipalities = municipalities.filter(muni => muni && muni.trim() !== "");
    const showMunicipalityColumn = debouncedMunicipalityFilter === 'all';
    const totalColumns = 6 + uniqueCriteria.length + (showMunicipalityColumn ? 1 : 0);

    const Controls = () => (
        <div className="my-4 p-4 border rounded-lg bg-muted/20">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search title" value={titleSearch} onChange={(e) => setTitleSearch(e.target.value)} className="pl-10" disabled={isSyncing} />
                </div>
                <Select value={municipalityFilter} onValueChange={setMunicipalityFilter} disabled={isSyncing || municipalities.length === 0}>
                    <SelectTrigger className="w-full">
                        <MapPin className="h-4 w-4 text-muted-foreground mr-2" />
                        <SelectValue placeholder="Filter by Municipality" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Municipalities</SelectItem>
                        {cleanMunicipalities.map(muni => (<SelectItem key={muni} value={muni}>{muni}</SelectItem>))}
                    </SelectContent>
                </Select>
                <Input type="number" placeholder="Min Score" value={minScore} onChange={(e) => setMinScore(e.target.value)} disabled={isSyncing} className="text-center" />
                <Input type="number" placeholder="Max Score" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} disabled={isSyncing} className="text-center" />
                {isLoadingSets ? (<Skeleton className="h-10 w-full" />) : (
                    <Select value={selectedScoreSet} onValueChange={(slug) => {
                        const selectedSet = scoreSets.find(s => s.slug === slug);
                        if (selectedSet) setCurrentScoreSetName(selectedSet.name.en_GB);
                        setSelectedScoreSet(slug);
                    }} disabled={scoreSets.length === 0 || isSyncing}>
                        <SelectTrigger><SelectValue placeholder="Select score set" /></SelectTrigger>
                        <SelectContent>
                            {scoreSets.map(set => <SelectItem key={set.slug} value={set.slug}>{set.name.en_GB}</SelectItem>)}
                        </SelectContent>
                    </Select>
                )}
            </div>
        </div>
    );

    return (
        <>
            <Card className="mt-6 w-full mx-auto">
                <CardHeader>
                    <div className="md:flex justify-between items-start">
                        <div>
                            <CardTitle className="text-2xl">Leaderboard & Analytics</CardTitle>
                            <CardDescription>Analyze and manage applications from GoodGrants.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2 mt-4 md:mt-0">
                            <GenerateReportButton filteredApps={filteredApps} municipalityFilter={debouncedMunicipalityFilter} lastSyncTime={lastSyncTime} scoreSetName={currentScoreSetName} minScore={debouncedMinScore} maxScore={debouncedMaxScore} disabled={isSyncing || isAnalyticsLoading} />
                            <Button onClick={handleSync} disabled={isSyncing || !selectedScoreSet} variant="default">
                                {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                Sync Leaderboard
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="leaderboard" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="leaderboard"><Trophy className="w-4 h-4 mr-2" />Leaderboard</TabsTrigger>
                            <TabsTrigger value="analytics"><LineChart className="w-4 h-4 mr-2" />Analytics</TabsTrigger>
                        </TabsList>
                        <TabsContent value="leaderboard">
                            <Controls />
                            {selectedSlugs.length > 0 && (
                                <div className="flex items-center justify-end mb-4">
                                    <Button onClick={handleTagSelected} disabled={isTagging || isSyncing}>
                                        <Tag className="mr-2 h-4 w-4" /> Tag {selectedSlugs.length} as Eligible-1
                                    </Button>
                                </div>
                            )}
                            <div className="rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead><Checkbox checked={eligibleRows.length > 0 && selectedSlugs.length === eligibleRows.length} onCheckedChange={handleSelectAll} disabled={eligibleRows.length === 0} /></TableHead>
                                            <TableHead>Rank</TableHead>
                                            <TableHead className="cursor-pointer" onClick={() => handleSort('title')}>Title {renderSortArrow('title')}</TableHead>
                                            {showMunicipalityColumn && <TableHead>Municipality</TableHead>}
                                            {uniqueCriteria.map(name => <TableHead key={name} className="text-center">{name}</TableHead>)}
                                            <TableHead className="cursor-pointer text-center" onClick={() => handleSort('total_score')}>Score {renderSortArrow('total_score')}</TableHead>
                                            <TableHead className="text-center">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading || isSyncing ? Array.from({ length: pagination.perPage }).map((_, i) => <SkeletonRow key={i} />)
                                            : error ? <TableRow><TableCell colSpan={totalColumns} className="h-24 text-center text-red-500"><AlertCircle className="mx-auto h-6 w-6 mb-2" />{error}</TableCell></TableRow>
                                                : leaderboard.length > 0 ? leaderboard.map((entry, index) => (
                                                    <TableRow key={entry.slug}>
                                                        <TableCell>{isEligibleForTagging(entry) && <Checkbox checked={selectedSlugs.includes(entry.slug)} onCheckedChange={(c) => handleSelectRow(entry.slug, !!c)} />}</TableCell>
                                                        <TableCell>{(pagination.currentPage - 1) * pagination.perPage + index + 1}</TableCell>
                                                        <TableCell>
                                                            <div>{entry.title}</div>
                                                            <div className="flex flex-wrap gap-1 mt-1">{entry.tags.map(t => <Badge key={t} variant="secondary">{t}</Badge>)}</div>
                                                        </TableCell>
                                                        {showMunicipalityColumn && <TableCell><Badge variant="outline">{entry.municipality || 'N/A'}</Badge></TableCell>}
                                                        {uniqueCriteria.map(crit => <TableCell key={crit} className={`text-center font-mono ${getScoreColorClass(entry.scoreBreakdown?.find(c => c.name === crit)?.rawValue || 0, entry.scoreBreakdown?.find(c => c.name === crit)?.maxScore || 2)}`}>{renderScore(entry.scoreBreakdown?.find(c => c.name === crit))}</TableCell>)}
                                                        <TableCell className="text-center font-semibold text-green-600">{entry.totalScore.toFixed(2)}</TableCell>
                                                        <TableCell className="text-center"><Button variant="ghost" size="icon" onClick={() => { setSelectedAppSlug(entry.slug); setIsModalOpen(true); }}><Eye className="h-4 w-4" /></Button></TableCell>
                                                    </TableRow>
                                                )) : <TableRow><TableCell colSpan={totalColumns} className="h-24 text-center">No results found.</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="flex items-center justify-between py-4">
                                <Select value={String(pagination.perPage)} onValueChange={v => setPagination(p => ({ ...p, perPage: +v, currentPage: 1 }))}>
                                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="10">10/page</SelectItem><SelectItem value="20">20/page</SelectItem><SelectItem value="50">50/page</SelectItem></SelectContent>
                                </Select>
                                <div className="flex items-center space-x-2">
                                    <span>Page {pagination.currentPage} of {pagination.lastPage}</span>
                                    <Button variant="outline" size="sm" onClick={() => changePage(pagination.currentPage - 1)} disabled={pagination.currentPage <= 1}><ChevronLeft /></Button>
                                    <Button variant="outline" size="sm" onClick={() => changePage(pagination.currentPage + 1)} disabled={pagination.currentPage >= pagination.lastPage}><ChevronRight /></Button>
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="analytics" className="p-1 pt-4">
                            <Controls />
                            <ScoreAnalyticsCard leaderboard={filteredApps as unknown as AnalyticsLeaderboardEntry[]} municipalityFilter={debouncedMunicipalityFilter} isLoading={isAnalyticsLoading} scoreSetName={currentScoreSetName}
                                filteredApps={filteredApps} />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
            <ApplicationDetailsInquiryModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} applicationSlug={selectedAppSlug} />
        </>
    );
}

