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
import { RefreshCw, Trophy, AlertCircle, ChevronLeft, ChevronRight, ArrowUpDown, Tag, Search, Eye, MapPin, Loader2, Download, ScrollText, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { getLeaderboardPage, getScoreSets, syncLeaderboard, syncAllLeaderboards, getMunicipalities, getChallengeStatements, LeaderboardEntry, ScoreBreakdown, AnalyticsLeaderboardEntry, getAllLeaderboardDataForAnalytics } from '../actions/leaderboard';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import type { AppRawData } from '../actions/analysis';
import { getRawApplicationsBySlugs } from '../actions/analysis';
import { addEligibleTagToApplications } from '../actions/application';
import { useToast } from "./ui/use-toast";
import { Badge } from './ui/badge';
import { ApplicationDetailsInquiryModal } from './ApplicationDetailsInquiryModal';
import { ScoreAnalyticsCard } from './ScoreAnalyticsCard';
import { LeaderboardBreakdowns, FilteredAppRawData } from './LeaderboardBreakdowns';
import { GenerateReportButton } from './GenerateReportButton';
import { SunburstAnalyticsCard } from './SunburstAnalyticsCard'; // ADDED: Import SunburstAnalyticsCard


type SortableKeys = 'title' | 'total_score';

interface ScoreSet {
    slug: string;
    name: { en_GB: string };
}

// Interface for dynamic PS codes
interface ProblemStatement {
    name: string; // e.g., Char-ps-1
    tag: string; // e.g., char-ps-1
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

const TECHNICAL_SLUG = "nmWNmZPb";
const JURY_SLUG = "JljrBVpd";
const ELIGIBILITY_SLUG = "Gnmrzagy"; // Assuming the eligibility slug based on the console log
const ALL_STATEMENTS_VALUE = '__all__'; // Safe placeholder for "All Statements" in Select

const SkeletonRow = () => (
    <TableRow>
        <TableCell><Skeleton className="h-5 w-5" /></TableCell>
        <TableCell><Skeleton className="h-5 w-8" /></TableCell>
        <TableCell><Skeleton className="h-5 w-full" /></TableCell>
        <TableCell><Skeleton className="h-5 w-full" /></TableCell>
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

interface LeaderboardProps {
    config: { apiKey: string };
}

// --- NEW Pagination Component ---
interface PaginationProps {
    currentPage: number;
    lastPage: number;
    total: number;
    perPage: number;
    changePage: (newPage: number) => void;
    setPerPage: (perPage: number) => void;
    disabled: boolean;
}

const PaginationControls: React.FC<PaginationProps> = ({
    currentPage,
    lastPage,
    total,
    perPage,
    changePage,
    setPerPage,
    disabled
}) => {
    const pageNumbers = useMemo(() => {
        const delta = 2; // Show 2 pages on each side of the current page
        const range: (number | string)[] = []; // FIX: Explicitly type range

        for (let i = Math.max(2, currentPage - delta); i <= Math.min(lastPage - 1, currentPage + delta); i++) {
            range.push(i);
        }

        if (currentPage - delta > 2) {
            range.unshift('...');
        }
        if (currentPage + delta < lastPage - 1) {
            range.push('...');
        }

        if (lastPage > 1) {
            if (!range.includes(1)) range.unshift(1);
            if (!range.includes(lastPage)) range.push(lastPage);
        }

        return range.filter((p, i) => p !== '...' || range[i - 1] !== '...');
    }, [currentPage, lastPage]);

    return (
        <div className="flex items-center justify-between space-x-2 py-4 flex-wrap">
            <div className="flex items-center space-x-2">
                <Select value={perPage.toString()} onValueChange={(v) => setPerPage(Number(v))} disabled={disabled}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="10">10/page</SelectItem>
                        <SelectItem value="20">20/page</SelectItem>
                        <SelectItem value="50">50/page</SelectItem>
                        <SelectItem value="100">100/page</SelectItem>
                    </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {lastPage} ({total} Total)
                </span>
            </div>

            <div className="flex items-center space-x-1">
                <Button variant="outline" size="icon" onClick={() => changePage(1)} disabled={currentPage <= 1 || disabled}>
                    <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => changePage(currentPage - 1)} disabled={currentPage <= 1 || disabled}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>

                {pageNumbers.map((page, index) => (
                    typeof page === 'number' ? (
                        <Button
                            key={index}
                            variant={page === currentPage ? "default" : "outline"}
                            size="icon"
                            onClick={() => changePage(page)}
                            disabled={disabled}
                        >
                            {page}
                        </Button>
                    ) : (
                        <span key={index} className="px-2 text-muted-foreground">...</span>
                    )
                ))}

                <Button variant="outline" size="icon" onClick={() => changePage(currentPage + 1)} disabled={currentPage >= lastPage || disabled}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => changePage(lastPage)} disabled={currentPage >= lastPage || disabled}>
                    <ChevronsRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};
// --- END NEW Pagination Component ---


export function Leaderboard({ config }: LeaderboardProps) {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [filteredApps, setFilteredApps] = useState<FilteredAppRawData[]>([]);
    const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
    const [scoreSets, setScoreSets] = useState<ScoreSet[]>([]);
    const [municipalities, setMunicipalities] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingSets, setIsLoadingSets] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isSyncingAll, setIsSyncingAll] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [isTagging, setIsTagging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedScoreSet, setSelectedScoreSet] = useState<string>("");
    const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAppSlug, setSelectedAppSlug] = useState<string | null>(null);
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
    const [currentScoreSetName, setCurrentScoreSetName] = useState<string>("");

    // NEW STATE: Dynamic list of PS codes
    const [availableChallengeStatements, setAvailableChallengeStatements] = useState<ProblemStatement[]>([]);

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

    // CHANGED: challengeStatementFilter is now a string array for multi-select
    const [challengeStatementFilter, setChallengeStatementFilter] = useState<string[]>([]);
    const debouncedChallengeStatementString = useDebounce(challengeStatementFilter.join(','), 500);

    // FIX: Define renderScore here, as it's used in the table body.
    const renderScore = (scoreEntry: ScoreBreakdown | undefined): string => {
        if (!scoreEntry) return 'N/A';
        // Assuming ScoreBreakdown.score might be a formatted string (e.g., "3/5") or we format rawValue
        if (scoreEntry.score && scoreEntry.score.includes('/')) return scoreEntry.score;
        return scoreEntry.rawValue.toFixed(2);
    };

    const isChallengeFilterApplicable = useMemo(() => {
        return selectedScoreSet === TECHNICAL_SLUG || selectedScoreSet === JURY_SLUG;
    }, [selectedScoreSet]);

    // Check if score filters are applied (for conditional PDF content and conditional chart display)
    const isScoreFilterApplied = useMemo(() => {
        const parsedMin = debouncedMinScore ? parseFloat(debouncedMinScore) : undefined;
        const parsedMax = debouncedMaxScore ? parseFloat(debouncedMaxScore) : undefined;
        return parsedMin !== undefined || parsedMax !== undefined;
    }, [debouncedMinScore, debouncedMaxScore]);

    const isAnySyncing = isSyncing || isSyncingAll;

    // FETCH MUNICIPALITY AND PS CODES
    useEffect(() => {
        const fetchMuniAndPsCodes = async () => {
            if (isAnySyncing || isLoadingSets) return;
            const psCodes = await getChallengeStatements(municipalityFilter);

            // Format for use in UI (tag is the PS code itself)
            const psData: ProblemStatement[] = psCodes.map(code => ({ name: code, tag: code }));
            setAvailableChallengeStatements(psData);
        };
        fetchMuniAndPsCodes();
    }, [debouncedMunicipalityFilter, isAnySyncing, isLoadingSets]);


    useEffect(() => {
        const fetchData = async () => {
            if (!config.apiKey) { setError("API key is not configured."); setIsLoadingSets(false); return; }
            setIsLoadingSets(true);
            try {
                const [sets, muniData] = await Promise.all([getScoreSets(config), getMunicipalities()]);
                setScoreSets(sets);
                setMunicipalities(muniData);
                if (sets.length > 0) {
                    const technicalSet = sets.find(set => set.slug === TECHNICAL_SLUG);
                    const defaultSet = technicalSet || sets[0];

                    setSelectedScoreSet(defaultSet.slug);
                    setCurrentScoreSetName(defaultSet.name.en_GB);
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
            // Pass the comma-separated string for filtering
            const response = await getLeaderboardPage(selectedScoreSet, pagination.currentPage, pagination.perPage, sortConfig, debouncedTitleSearch, debouncedTagFilter, parsedMin, parsedMax, debouncedMunicipalityFilter, debouncedChallengeStatementString);
            setLeaderboard(response.data as LeaderboardEntry[]);
            setPagination(p => ({ ...p, currentPage: response.current_page, lastPage: response.last_page, total: response.total }));
        } catch (err: any) {
            setError(err.message || "Failed to load leaderboard data.");
        } finally {
            setIsLoading(false);
        }
    }, [selectedScoreSet, pagination.currentPage, pagination.perPage, sortConfig, debouncedTitleSearch, debouncedTagFilter, debouncedMinScore, debouncedMaxScore, debouncedMunicipalityFilter, debouncedChallengeStatementString]);

    const fetchAnalyticsData = useCallback(async () => {
        if (!selectedScoreSet) return;
        setIsAnalyticsLoading(true);
        const parsedMin = debouncedMinScore ? parseFloat(debouncedMinScore) : undefined;
        const parsedMax = debouncedMaxScore ? parseFloat(debouncedMaxScore) : undefined;
        try {
            // Pass the comma-separated string for filtering
            const minimalData = await getAllLeaderboardDataForAnalytics(selectedScoreSet, debouncedTitleSearch, debouncedTagFilter, parsedMin, parsedMax, debouncedMunicipalityFilter, debouncedChallengeStatementString);
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
    }, [selectedScoreSet, debouncedTitleSearch, debouncedTagFilter, debouncedMinScore, debouncedMaxScore, debouncedMunicipalityFilter, debouncedChallengeStatementString]);

    useEffect(() => {
        // Clear filter if not applicable to the current score set
        if (!isChallengeFilterApplicable && challengeStatementFilter.length > 0) {
            setChallengeStatementFilter([]);
        }

        // Logic to clear/reset invalid challenge filters based on current municipality
        const availableTags = availableChallengeStatements.map(cs => cs.tag);
        const newFilters = challengeStatementFilter.filter(tag => availableTags.includes(tag));

        if (municipalityFilter !== 'all') {
            // If switching to single-select, enforce 0 or 1 selection
            if (newFilters.length > 1) {
                setChallengeStatementFilter(newFilters.slice(0, 1));
            } else if (newFilters.length === 0 && challengeStatementFilter.length > 0) {
                // Clear any non-available tags
                setChallengeStatementFilter([]);
            }
        } else if (newFilters.length !== challengeStatementFilter.length) {
            // In multi-select mode, just clean out invalid tags
            setChallengeStatementFilter(newFilters);
        }


        if (pagination.currentPage !== 1) setPagination(p => ({ ...p, currentPage: 1 })); else fetchLeaderboard();
        fetchAnalyticsData();
    }, [selectedScoreSet, pagination.perPage, sortConfig, debouncedTitleSearch, debouncedTagFilter, debouncedMinScore, debouncedMaxScore, debouncedMunicipalityFilter, debouncedChallengeStatementString, isChallengeFilterApplicable, availableChallengeStatements]);

    useEffect(() => { fetchLeaderboard(); }, [pagination.currentPage]);

    const handlePageChange = (newPage: number) => {
        if (newPage > 0 && newPage <= pagination.lastPage) {
            setPagination(prev => ({ ...prev, currentPage: newPage }));
        }
    };

    const handlePerPageChange = (newPerPage: number) => {
        setPagination(prev => ({ ...prev, perPage: newPerPage, currentPage: 1 }));
    };

    const handleSync = async () => {
        if (!config.apiKey || !selectedScoreSet) return;
        setIsSyncing(true);
        setError(null);
        try {
            toast({ title: "Sync Started", description: `Fetching leaderboard data for ${currentScoreSetName}. This may take a while...` });
            const result = await syncLeaderboard(config, selectedScoreSet);
            toast({ title: "Sync Complete", description: `Synchronized ${result.syncedCount} applications for ${currentScoreSetName}.` });
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

    const handleSyncAll = async () => {
        if (!config.apiKey) return;
        setIsConfirmModalOpen(false);
        setIsSyncingAll(true);
        setError(null);
        try {
            toast({ title: "Full Sync Started", description: "Clearing ALL data and fetching ALL score sets. This will take significant time and API calls. Please ensure you've run the SQL migration." });
            const result = await syncAllLeaderboards(config);
            toast({ title: "Full Sync Complete", description: `Synchronized ${result.syncedCount} applications across all score sets.` });
            setLastSyncTime(new Date().toISOString());

            const muniData = await getMunicipalities();
            setMunicipalities(muniData);
            setPagination(p => ({ ...p, currentPage: 1 }));
        } catch (err: any) {
            setError(err.message || "Full synchronization failed. Check if app_municipality_map is populated.");
            toast({ title: "Full Sync Failed", description: err.message, variant: "destructive" });
        } finally {
            setIsSyncingAll(false);
        }
    };

    const handleViewDetails = (slug: string) => { setSelectedAppSlug(slug); setIsModalOpen(true); };
    const handleSort = (key: SortableKeys) => { setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' })); };
    const renderSortArrow = (column: SortableKeys) => (sortConfig.key !== column ? <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" /> : sortConfig.direction === 'asc' ? '▲' : '▼');
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
    // Removed uniqueCriteria columns. Total columns is fixed based on new layout.
    const totalColumns = 6;

    // UI Logic for Challenge Selects
    const isMultiSelect = municipalityFilter === 'all';

    // The Select component's value for single-select. Maps [] to ALL_STATEMENTS_VALUE.
    const singlePsValue = !isMultiSelect && challengeStatementFilter.length === 0 ? ALL_STATEMENTS_VALUE : challengeStatementFilter[0];

    const handleSingleSelectChange = (tag: string) => {
        // If ALL_STATEMENTS_VALUE is selected, clear the state array. Otherwise, set the tag.
        setChallengeStatementFilter(tag === ALL_STATEMENTS_VALUE ? [] : [tag]);
    };

    const handleMultiSelectClick = (tag: string) => {
        setChallengeStatementFilter(prev => prev.includes(tag)
            ? prev.filter(t => t !== tag)
            : [...prev, tag]
        );
    };

    // Determine if table should show individual criteria scores or simplified view
    const isDetailedView = selectedScoreSet !== TECHNICAL_SLUG && selectedScoreSet !== JURY_SLUG;


    return (
        <Card className="mt-6 shadow-lg">
            <CardHeader>
                <div className="md:flex justify-between items-start">
                    <div>
                        <CardTitle className="flex items-center gap-2"><Trophy className="w-6 h-6" /> Leaderboard & Analytics</CardTitle>
                        <CardDescription>Analyze and manage applications synchronized from GoodGrants.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 mt-4 md:mt-0 flex-wrap">
                        {/* Conditional PDF Generation Flag: isScoreFilterApplied */}
                        <GenerateReportButton
                            filteredApps={filteredApps}
                            municipalityFilter={debouncedMunicipalityFilter}
                            challengeStatementFilter={debouncedChallengeStatementString} // PASS STRING
                            lastSyncTime={lastSyncTime}
                            scoreSetName={currentScoreSetName}
                            minScore={debouncedMinScore}
                            maxScore={debouncedMaxScore}
                            disabled={isAnySyncing || isAnalyticsLoading}
                            skipScoreDistribution={isScoreFilterApplied}
                        />

                        {/* Sync All Button and Modal */}
                        <AlertDialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isAnySyncing}>
                                    <RefreshCw className="mr-2 h-4 w-4" /> Sync All
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action will **truncate the entire leaderboard_entries table** in your database and then initiate a sync for **all** available score sets from the API. This process is resource-intensive and will take a significant amount of time.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel disabled={isAnySyncing}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleSyncAll} disabled={isAnySyncing}>
                                        {isSyncingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                        {isSyncingAll ? 'Syncing All...' : 'Confirm Full Sync'}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>

                        {/* Original Sync Button */}
                        <Button onClick={handleSync} disabled={isAnySyncing || !selectedScoreSet}>
                            {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            {isSyncing ? 'Syncing Current...' : 'Sync Current'}
                        </Button>

                        <Select value={selectedScoreSet} onValueChange={(slug) => {
                            const set = scoreSets.find(s => s.slug === slug);
                            if (set) setCurrentScoreSetName(set.name.en_GB);
                            setSelectedScoreSet(slug);
                        }} disabled={isLoadingSets || isAnySyncing}>
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
                                {/* Filter Row 1 */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-4">
                                    <Input placeholder="Search title..." value={titleSearch} onChange={(e) => setTitleSearch(e.target.value)} className="pl-4" disabled={isAnySyncing} />
                                    <Select value={municipalityFilter} onValueChange={setMunicipalityFilter} disabled={isAnySyncing || municipalities.length === 0}>
                                        <SelectTrigger><SelectValue placeholder="Filter Municipality" /></SelectTrigger>
                                        <SelectContent><SelectItem value="all">All Municipalities</SelectItem>{cleanMunicipalities.map(muni => <SelectItem key={muni} value={muni}>{muni}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <Input type="number" placeholder="Min Score" value={minScore} onChange={(e) => setMinScore(e.target.value)} disabled={isAnySyncing} />
                                    <Input type="number" placeholder="Max Score" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} disabled={isAnySyncing} />
                                </div>
                                {/* Filter Row 2: Challenge Statement Filter */}
                                {isChallengeFilterApplicable && availableChallengeStatements.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                                        {isMultiSelect ? (
                                            <div className="flex flex-col space-y-1 xl:col-span-full">
                                                <label className="text-sm font-medium leading-none">Challenge Statements (Multi-select)</label>
                                                <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-white overflow-y-auto max-h-32">
                                                    <Button
                                                        variant={challengeStatementFilter.length === 0 ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={() => setChallengeStatementFilter([])}
                                                        disabled={isAnySyncing}
                                                        className='text-xs'
                                                    >
                                                        All Statements
                                                    </Button>
                                                    {availableChallengeStatements.map(cs => (
                                                        <Button
                                                            key={cs.tag}
                                                            variant={challengeStatementFilter.includes(cs.tag) ? "default" : "outline"}
                                                            size="sm"
                                                            onClick={() => handleMultiSelectClick(cs.tag)}
                                                            disabled={isAnySyncing}
                                                            className='text-xs'
                                                        >
                                                            {cs.tag}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <Select
                                                value={singlePsValue}
                                                onValueChange={handleSingleSelectChange}
                                                disabled={isAnySyncing || availableChallengeStatements.length === 0}
                                            >
                                                <SelectTrigger><SelectValue placeholder="Filter Challenge Statement (Single)" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value={ALL_STATEMENTS_VALUE}>All Statements</SelectItem>
                                                    {availableChallengeStatements.map(cs => (
                                                        <SelectItem key={cs.tag} value={cs.tag}>{cs.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                        <div className='hidden sm:block' />
                                        <div className='hidden sm:block' />
                                        <div className='hidden sm:block' />
                                    </div>
                                )}
                            </div>

                            {/* NEW: Pagination Controls ABOVE the table */}
                            <PaginationControls
                                currentPage={pagination.currentPage}
                                lastPage={pagination.lastPage}
                                total={pagination.total}
                                perPage={pagination.perPage}
                                changePage={handlePageChange}
                                setPerPage={handlePerPageChange}
                                disabled={isLoading || isAnySyncing}
                            />

                            <div className="rounded-md border overflow-x-auto">
                                <Table className="min-w-[700px]">
                                    <TableHeader><TableRow>
                                        <TableHead className="w-12"><Checkbox checked={selectedSlugs.length > 0 && eligibleRows.length > 0 && selectedSlugs.length === eligibleRows.length} onCheckedChange={handleSelectAll} disabled={eligibleRows.length === 0 || isAnySyncing} /></TableHead>
                                        <TableHead className="w-16">Rank</TableHead>
                                        <TableHead className="cursor-pointer w-[30%]" onClick={() => handleSort('title')}>Application Title & Tags {renderSortArrow('title')}</TableHead>
                                        {/* CONDITIONAL COLUMN: Score Breakdown (only for Eligibility, etc.) */}
                                        {isDetailedView && (<TableHead className="text-center w-[150px] border-l">Score Breakdown</TableHead>)}
                                        {/* NEW COLUMN: Problem Statement */}
                                        {isChallengeFilterApplicable && (<TableHead className="w-[150px] border-l">Problem Statement</TableHead>)}
                                        <TableHead className="cursor-pointer text-center w-[100px] border-l" onClick={() => handleSort('total_score')}>Total Score {renderSortArrow('total_score')}</TableHead>
                                        <TableHead className="w-16 text-center">Actions</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                        {isLoading || isAnySyncing ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
                                            : error ? <TableRow><TableCell colSpan={totalColumns} className="h-24 text-center text-red-500"><AlertCircle className="mx-auto h-6 w-6 mb-2" />{error}</TableCell></TableRow>
                                                : leaderboard.length > 0 ? leaderboard.map((entry, index) => {
                                                    const rank = (pagination.currentPage - 1) * pagination.perPage + index + 1;

                                                    // Get the PS code from the entry's tags
                                                    const psCodeDisplay = entry.tags.find(t => availableChallengeStatements.some(cs => cs.tag === t)) || 'N/A';

                                                    return (<TableRow key={entry.slug}>
                                                        <TableCell>{isEligibleForTagging(entry) && <Checkbox checked={selectedSlugs.includes(entry.slug)} onCheckedChange={(c) => handleSelectRow(entry.slug, !!c)} />}</TableCell>
                                                        <TableCell className="font-bold text-lg">{rank}</TableCell>
                                                        <TableCell><div>{entry.title}</div><div className="flex flex-wrap gap-1 mt-2">{entry.tags.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div></TableCell>

                                                        {/* CONDITIONAL COLUMN: Score Breakdown (only for Eligibility, etc.) */}
                                                        {isDetailedView && (
                                                            <TableCell className="text-center border-l">
                                                                <TooltipProvider><Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <ScrollText className='h-4 w-4 mx-auto text-muted-foreground cursor-help' />
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p className="font-bold">Breakdown:</p>
                                                                        {entry.scoreBreakdown.map(c => <div key={c.name}>{c.name}: <span className="font-mono">{renderScore(c)}</span></div>)}
                                                                    </TooltipContent>
                                                                </Tooltip></TooltipProvider>
                                                            </TableCell>
                                                        )}

                                                        {/* NEW COLUMN: Problem Statement */}
                                                        {isChallengeFilterApplicable && <TableCell className="border-l text-sm"><Badge variant="outline">{psCodeDisplay}</Badge></TableCell>}

                                                        <TableCell className="text-center border-l">
                                                            <TooltipProvider><Tooltip>
                                                                <TooltipTrigger asChild><span className="cursor-help font-semibold text-lg text-green-600">{entry.totalScore.toFixed(2)}</span></TooltipTrigger>
                                                                {/* For Technical/Jury, Total Score tooltip shows breakdown */}
                                                                {!isDetailedView && (
                                                                    <TooltipContent>
                                                                        <p className="font-bold">Breakdown:</p>
                                                                        {entry.scoreBreakdown.map(c => <div key={c.name}>{c.name}: <span className="font-mono">{renderScore(c)}</span></div>)}
                                                                    </TooltipContent>
                                                                )}
                                                            </Tooltip></TooltipProvider>
                                                        </TableCell>
                                                        <TableCell className="text-center"><Button variant="ghost" size="icon" onClick={() => handleViewDetails(entry.slug)}><Eye className="h-4 w-4" /></Button></TableCell>
                                                    </TableRow>);
                                                })
                                                    : <TableRow><TableCell colSpan={totalColumns} className="h-24 text-center">No results found for the current filters.</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* NEW: Pagination Controls BELOW the table */}
                            <PaginationControls
                                currentPage={pagination.currentPage}
                                lastPage={pagination.lastPage}
                                total={pagination.total}
                                perPage={pagination.perPage}
                                changePage={handlePageChange}
                                setPerPage={handlePerPageChange}
                                disabled={isLoading || isAnySyncing}
                            />
                        </div>
                    </TabsContent>
                    <TabsContent value="analytics">
                        <div className="my-4 p-4 border rounded-lg bg-muted/40">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
                                <Input placeholder="Search title..." value={titleSearch} onChange={(e) => setTitleSearch(e.target.value)} className="pl-4" disabled={isAnySyncing} />
                                <Select value={municipalityFilter} onValueChange={setMunicipalityFilter} disabled={isAnySyncing || municipalities.length === 0}>
                                    <SelectTrigger><SelectValue placeholder="Filter Municipality" /></SelectTrigger>
                                    <SelectContent><SelectItem value="all">All Municipalities</SelectItem>{cleanMunicipalities.map(muni => <SelectItem key={muni} value={muni}>{muni}</SelectItem>)}</SelectContent>
                                </Select>
                                <Input type="number" placeholder="Min Score" value={minScore} onChange={(e) => setMinScore(e.target.value)} disabled={isAnySyncing} />
                                <Input type="number" placeholder="Max Score" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} disabled={isAnySyncing} />
                            </div>
                            {/* Filter Row 2: Challenge Statement Filter in Analytics */}
                            {isChallengeFilterApplicable && availableChallengeStatements.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                                    {isMultiSelect ? (
                                        <div className="flex flex-col space-y-1 xl:col-span-full">
                                            <label className="text-sm font-medium leading-none">Challenge Statements (Multi-select)</label>
                                            <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-white overflow-y-auto max-h-32">
                                                <Button
                                                    variant={challengeStatementFilter.length === 0 ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => setChallengeStatementFilter([])}
                                                    disabled={isAnySyncing}
                                                    className='text-xs'
                                                >
                                                    All Statements
                                                </Button>
                                                {availableChallengeStatements.map(cs => (
                                                    <Button
                                                        key={cs.tag}
                                                        variant={challengeStatementFilter.includes(cs.tag) ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={() => handleMultiSelectClick(cs.tag)}
                                                        disabled={isAnySyncing}
                                                        className='text-xs'
                                                    >
                                                        {cs.tag}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <Select
                                            value={singlePsValue}
                                            onValueChange={handleSingleSelectChange}
                                            disabled={isAnySyncing || availableChallengeStatements.length === 0}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Filter Challenge Statement (Single)" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={ALL_STATEMENTS_VALUE}>All Statements</SelectItem>
                                                {availableChallengeStatements.map(cs => (
                                                    <SelectItem key={cs.tag} value={cs.tag}>{cs.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    <div className='hidden sm:block' />
                                    <div className='hidden sm:block' />
                                    <div className='hidden sm:block' />
                                </div>
                            )}
                        </div>
                        {/* ADDED: Sunburst Analytics Card */}
                        <SunburstAnalyticsCard
                            filteredApps={filteredApps}
                            isLoading={isAnalyticsLoading}
                            municipalityFilter={debouncedMunicipalityFilter}
                        />
                        <ScoreAnalyticsCard
                            leaderboard={filteredApps as unknown as AnalyticsLeaderboardEntry[]}
                            municipalityFilter={debouncedMunicipalityFilter}
                            isLoading={isAnalyticsLoading}
                            scoreSetName={currentScoreSetName}
                            filteredApps={filteredApps}
                            skipScoreDistribution={isScoreFilterApplied}
                        />
                    </TabsContent>
                </Tabs>
            </CardContent>
            <ApplicationDetailsInquiryModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} applicationSlug={selectedAppSlug} />
        </Card>
    );
}