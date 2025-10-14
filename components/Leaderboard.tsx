// csv-uploader-include-callForIdea/components/Leaderboard.tsx

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Trophy, AlertCircle, ChevronLeft, ChevronRight, ArrowUpDown, Tag, Search, Eye, MapPin, Loader2 } from 'lucide-react';
import { getLeaderboardPage, getScoreSets, syncLeaderboard, getMunicipalities, LeaderboardEntry, ScoreBreakdown, AnalyticsLeaderboardEntry, getAllLeaderboardDataForAnalytics } from '@/actions/leaderboard';
import type { AppRawData } from '@/actions/analysis'; 
import { getRawApplicationsBySlugs } from '@/actions/analysis'; 
import { addEligibleTagToApplications } from '@/actions/application';
import { useToast } from "@/components/ui/use-toast";
import { Badge } from './ui/badge';
import { ApplicationDetailsInquiryModal } from './ApplicationDetailsInquiryModal';
import { ScoreAnalyticsCard } from './ScoreAnalyticsCard'; 
import { LeaderboardBreakdowns, FilteredAppRawData } from './LeaderboardBreakdowns'; // NEW IMPORT

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

// Helper function for dynamic color calculation
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
    const [filteredApps, setFilteredApps] = useState<FilteredAppRawData[]>([]); // NEW STATE for analytics
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

    // Extract unique criteria names for dynamic columns
    const uniqueCriteria = useMemo(() => {
        const criteriaNames = new Set<string>();
        leaderboard.forEach(entry => {
            entry.scoreBreakdown?.forEach(crit => {
                criteriaNames.add(crit.name);
            });
        });
        return Array.from(criteriaNames);
    }, [leaderboard]);

    // Helper to round individual score in the UI.
    const renderScore = (scoreEntry: ScoreBreakdown | undefined): string => {
        if (!scoreEntry) return 'N/A';
        // If score is a formatted string (like "2/2"), return it directly.
        if (scoreEntry.score.includes('/')) {
            return scoreEntry.score;
        }
        // Otherwise, use the rawValue (already rounded server-side) and format explicitly.
        return scoreEntry.rawValue.toFixed(2);
    };
    
    // --- Data Fetching Effects ---

    // Effect for fetching score sets & municipalities
    useEffect(() => {
        const fetchData = async () => {
            if (!config.apiKey) { setError("API key is not configured."); setIsLoadingSets(false); return; }
            setIsLoadingSets(true);
            try {
                const [sets, muniData] = await Promise.all([
                    getScoreSets(config),
                    getMunicipalities(), 
                ]);

                setScoreSets(sets);
                setMunicipalities(muniData); 
                
                if (sets.length > 0) {
                    const eligibilitySet = sets.find(set => set.name.en_GB === 'Eligibility Shortlisting');
                    setSelectedScoreSet(eligibilitySet ? eligibilitySet.slug : sets[0].slug);
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
        
        if (parsedMinScore !== undefined && isNaN(parsedMinScore)) { setError("Invalid Minimum Score entered."); setIsLoading(false); return; }
        if (parsedMaxScore !== undefined && isNaN(parsedMaxScore)) { setError("Invalid Maximum Score entered."); setIsLoading(false); return; }

        try {
            const response = await getLeaderboardPage(
                selectedScoreSet, 
                pagination.currentPage, 
                pagination.perPage, 
                sortConfig,
                debouncedTitleSearch, 
                debouncedTagFilter,
                parsedMinScore,
                parsedMaxScore,
                debouncedMunicipalityFilter
            );
            
            if (response) {
                setLeaderboard(response.data as LeaderboardEntry[]);
                setPagination(p => ({ ...p, currentPage: response.current_page, lastPage: response.last_page, total: response.total }));
                setError(null);
            } else {
                 throw new Error("Received an invalid response from the server.");
            }
        } catch (err: any) {
            setError(err.message || "Failed to load leaderboard data from local DB. Please synchronize data.");
        } finally {
            setIsLoading(false);
        }
    }, [selectedScoreSet, pagination.currentPage, pagination.perPage, sortConfig, debouncedTitleSearch, debouncedTagFilter, debouncedMinScore, debouncedMaxScore, debouncedMunicipalityFilter]);
    
    // NEW: Function to fetch all data for the analytics card and breakdowns
    const fetchAnalyticsData = useCallback(async () => {
        if (!selectedScoreSet) return;
        
        setIsAnalyticsLoading(true);

        const parsedMinScore = debouncedMinScore ? parseFloat(debouncedMinScore) : undefined;
        const parsedMaxScore = debouncedMaxScore ? parseFloat(debouncedMaxScore) : undefined;
        
        // Skip fetch if parsing results in NaN
        if ((parsedMinScore !== undefined && isNaN(parsedMinScore)) || (parsedMaxScore !== undefined && isNaN(parsedMaxScore))) {
            setIsAnalyticsLoading(false);
            setFilteredApps([]);
            return;
        }
        
        try {
            // Step 1: Get filtered slugs, scores, and municipalities (minimal data)
            const minimalData = await getAllLeaderboardDataForAnalytics(
                selectedScoreSet,
                debouncedTitleSearch, 
                debouncedTagFilter,
                parsedMinScore,
                parsedMaxScore,
                debouncedMunicipalityFilter
            );
            
            if (minimalData.length === 0) {
                setFilteredApps([]);
                return;
            }

            // Step 2: Get full raw data for those slugs
            const slugs = minimalData.map(d => d.slug);
            const rawDataList = await getRawApplicationsBySlugs(slugs);

            // Create a Map for quick lookup
            const rawDataMap = rawDataList.reduce((acc, app) => {
                acc[app.slug] = app;
                return acc;
            }, {} as Record<string, AppRawData>);

            // Step 3: Combine and enrich minimal data with raw data
            const combinedData: FilteredAppRawData[] = minimalData.map(min => {
                const rawApp = rawDataMap[min.slug];
                if (!rawApp) return null; // Skip if raw data is missing

                // Merge minimal data (score, muni) with raw data (fields, category)
                return {
                    ...rawApp,
                    totalScore: min.totalScore,
                    municipality: min.municipality,
                } as FilteredAppRawData;
            }).filter((d): d is FilteredAppRawData => d !== null);

            setFilteredApps(combinedData);
        } catch (err) {
            console.error("Failed to load analytics data:", err);
            setFilteredApps([]); // Clear data on error
        } finally {
            setIsAnalyticsLoading(false);
        }
    }, [selectedScoreSet, debouncedTitleSearch, debouncedTagFilter, debouncedMinScore, debouncedMaxScore, debouncedMunicipalityFilter]);

    // Effect to reset page on filter change and fetch data
    useEffect(() => {
        if (pagination.currentPage !== 1) {
            setPagination(p => ({...p, currentPage: 1}));
        } else {
            // Only fetch leaderboard page when filters change or page is 1
            fetchLeaderboard();
        }
        
        // Always fetch analytics data when filters change
        fetchAnalyticsData(); 
        
    }, [selectedScoreSet, pagination.perPage, sortConfig, debouncedTitleSearch, debouncedTagFilter, debouncedMinScore, debouncedMaxScore, debouncedMunicipalityFilter]); 

    // Effect for page change
    useEffect(() => {
        fetchLeaderboard();
    }, [pagination.currentPage]); 
    
    // --- Action Handlers ---

    const handleSync = async () => {
        if (!config.apiKey || !selectedScoreSet) return;
        setIsSyncing(true);
        setError(null);
        
        try {
            toast({ title: "Sync Started", description: "Fetching ALL leaderboard data from GoodGrants. This may take a while...", duration: 5000 });
            const result = await syncLeaderboard(config, selectedScoreSet);
            toast({ title: "Sync Complete", description: `Successfully synchronized ${result.syncedCount} applications.`, duration: 3000 });
            // Re-fetch municipalities after sync as mapping table is updated
            const muniData = await getMunicipalities(); 
            setMunicipalities(muniData);
            setPagination(p => ({...p, currentPage: 1}));
        } catch (err: any) {
            setError(err.message || "Synchronization failed.");
            toast({ title: "Sync Failed", description: err.message || "Failed to synchronize data from GoodGrants API.", variant: "destructive" });
        } finally {
            setIsSyncing(false);
        }
    };
    
    const handleViewDetails = (slug: string) => {
        setSelectedAppSlug(slug);
        setIsModalOpen(true);
    };

    const handleSort = (key: SortableKeys) => {
        setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
        setPagination(p => ({...p, currentPage: 1}));
    };

    const renderSortArrow = (column: SortableKeys) => {
        if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
        return sortConfig.direction === 'asc' ? '▲' : '▼';
    };

    const changePage = (newPage: number) => {
        if (newPage > 0 && newPage <= pagination.lastPage) {
            setSelectedSlugs([]);
            setPagination(prev => ({...prev, currentPage: newPage}));
        }
    };

    const isEligibleForTagging = (entry: LeaderboardEntry) => {
        return !entry.tags?.includes('Eligible-1');
    };

    const eligibleRows = useMemo(() => leaderboard.filter(isEligibleForTagging), [leaderboard]);

    const handleSelectRow = (slug: string, checked: boolean) => {
        setSelectedSlugs(prev => checked ? [...prev, slug] : prev.filter(s => s !== slug));
    };

    const handleSelectAll = (checked: boolean) => {
        setSelectedSlugs(checked ? eligibleRows.map(r => r.slug) : []);
    };
    
    const handleTagSelected = async () => {
        if (selectedSlugs.length === 0) return;
        setIsTagging(true);
        try {
            await addEligibleTagToApplications(config, selectedSlugs,["Eligible-1"]);
            toast({ title: "Success", description: `${selectedSlugs.length} applications tagged successfully.` });
            setSelectedSlugs([]);
            fetchLeaderboard();
        } catch (err: any) {
            toast({ title: "Tagging Failed", description: err.message, variant: "destructive" });
        } finally {
            setIsTagging(false);
        }
    };
    
    // Filter out potential empty strings for safe rendering in SelectItem
    const cleanMunicipalities = municipalities.filter(muni => muni && muni.trim() !== "");

    // Determine if the Municipality column should be displayed
    const showMunicipalityColumn = debouncedMunicipalityFilter === 'all';
    const totalColumns = 6 + uniqueCriteria.length + (showMunicipalityColumn ? 1 : 0);

    return (
        <>
            {/* UPDATED: Pass filteredApps for score analytics */}
            <ScoreAnalyticsCard 
                leaderboard={filteredApps as unknown as AnalyticsLeaderboardEntry[]} 
                municipalityFilter={debouncedMunicipalityFilter} 
                isLoading={isAnalyticsLoading}
            />

            {/* NEW COMPONENT for other breakdowns */}
            <LeaderboardBreakdowns
                filteredApps={filteredApps}
                isLoading={isAnalyticsLoading}
            />

            <Card className="mt-6">
                <CardHeader>
                    <div className="md:flex justify-between items-start">
                        <div>
                            <CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5" /> Leaderboard</CardTitle>
                            <CardDescription>Top ranked applications synchronized from GoodGrants.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2 mt-4 md:mt-0">
                            <Button onClick={handleSync} disabled={isSyncing || !selectedScoreSet} variant="default">
                                {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                {isSyncing ? "Synchronizing..." : "Sync Leaderboard"}
                            </Button>
                            <Select value={pagination.perPage.toString()} onValueChange={(value) => setPagination(p => ({...p, perPage: Number(value), currentPage: 1}))} disabled={isSyncing}>
                                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10 / page</SelectItem>
                                    <SelectItem value="20">20 / page</SelectItem>
                                    <SelectItem value="50">50 / page</SelectItem>
                                    <SelectItem value="100">100 / page</SelectItem>
                                </SelectContent>
                            </Select>
                            {isLoadingSets ? (<Skeleton className="h-10 w-[220px]" />) : (
                                <Select value={selectedScoreSet} onValueChange={(slug) => {setPagination(p => ({...p, currentPage: 1})); setTitleSearch(""); setTagFilter(""); setMinScore(""); setMaxScore(""); setMunicipalityFilter("all"); setSelectedScoreSet(slug)}} disabled={scoreSets.length === 0 || isSyncing}>
                                    <SelectTrigger className="w-[220px]"><SelectValue placeholder="Select a score set" /></SelectTrigger>
                                    <SelectContent>
                                        {scoreSets.map(set => <SelectItem key={set.slug} value={set.slug}>{set.name.en_GB}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="my-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search title"
                                value={titleSearch}
                                onChange={(e) => setTitleSearch(e.target.value)}
                                className="pl-10"
                                disabled={isSyncing}
                            />
                        </div>
                        <Select
                            value={municipalityFilter}
                            onValueChange={setMunicipalityFilter}
                            disabled={isSyncing || municipalities.length === 0}
                        >
                            <SelectTrigger className="w-full">
                                <MapPin className="h-4 w-4 text-muted-foreground mr-2" />
                                <SelectValue placeholder="Filter by Municipality" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Municipalities</SelectItem>
                                {cleanMunicipalities.map(muni => (
                                    <SelectItem key={muni} value={muni}>{muni}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Input
                            type="number"
                            placeholder="Min Score"
                            value={minScore}
                            onChange={(e) => setMinScore(e.target.value)}
                            disabled={isSyncing}
                            className="text-center"
                        />
                        <Input
                            type="number"
                            placeholder="Max Score"
                            value={maxScore}
                            onChange={(e) => setMaxScore(e.target.value)}
                            disabled={isSyncing}
                            className="text-center"
                        />
                        <div className="flex items-center justify-end">
                            {selectedSlugs.length > 0 && (
                                <Button onClick={handleTagSelected} disabled={isTagging || isSyncing}>
                                    <Tag className="mr-2 h-4 w-4"/> Tag {selectedSlugs.length} as Eligible-1
                                </Button>
                            )}
                        </div>
                    </div>
                    <div className="rounded-md border overflow-x-auto">
                        <Table className="min-w-[1200px] md:min-w-full">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">
                                        <Checkbox
                                            checked={selectedSlugs.length > 0 && eligibleRows.length > 0 && selectedSlugs.length === eligibleRows.length}
                                            onCheckedChange={handleSelectAll}
                                            disabled={eligibleRows.length === 0 || isSyncing}
                                        />
                                    </TableHead>
                                    <TableHead className="w-16">Rank</TableHead>
                                    <TableHead className="cursor-pointer w-[30%]" onClick={() => handleSort('title')}>
                                        <div className="flex items-center">Application Title & Tags {renderSortArrow('title')}</div>
                                    </TableHead>
                                    {showMunicipalityColumn && (
                                        <TableHead className="w-[150px] border-l">Municipality</TableHead>
                                    )}
                                    {uniqueCriteria.map(name => (
                                        <TableHead 
                                            key={name} 
                                            className="text-center w-[100px] text-xs font-semibold border-l"
                                        >
                                            {name}
                                        </TableHead>
                                    ))}
                                    <TableHead className="cursor-pointer text-center w-[100px] border-l" onClick={() => handleSort('total_score')}>
                                        <div className="flex items-center justify-center">Total Score {renderSortArrow('total_score')}</div>
                                    </TableHead>
                                    <TableHead className="w-16 text-center">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading || isSyncing ? (
                                    Array.from({ length: pagination.perPage }).map((_, i) => <SkeletonRow key={i} />)
                                ) : error ? (
                                    <TableRow><TableCell colSpan={totalColumns} className="h-24 text-center text-red-500"><AlertCircle className="mx-auto h-6 w-6 mb-2" />{error}</TableCell></TableRow>
                                ) : leaderboard.length > 0 ? (
                                    leaderboard.map((entry, index) => {
                                        const isEligible = isEligibleForTagging(entry);
                                        const rank = (pagination.currentPage - 1) * pagination.perPage + index + 1;
                                        return (
                                        <TableRow key={entry.slug}>
                                            <TableCell>
                                                {isEligible && (
                                                    <Checkbox
                                                        checked={selectedSlugs.includes(entry.slug)}
                                                        onCheckedChange={(checked) => handleSelectRow(entry.slug, !!checked)}
                                                    />
                                                )}
                                            </TableCell>
                                            <TableCell className="font-bold text-lg">{rank}</TableCell>
                                            <TableCell className="w-[30%]">
                                                <div>{entry.title}</div>
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {entry.tags.map(tag => (
                                                        <Badge key={tag} variant="secondary" className="font-normal">{tag}</Badge>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            {showMunicipalityColumn && (
                                                <TableCell className="w-[150px] border-l text-sm">
                                                    <Badge variant="outline" className="font-medium">
                                                        {entry.municipality || 'N/A'}
                                                    </Badge>
                                                </TableCell>
                                            )}
                                            {uniqueCriteria.map(critName => {
                                                const scoreEntry = entry.scoreBreakdown?.find(c => c.name === critName);
                                                const rawValue = scoreEntry?.rawValue || 0;
                                                const maxScore = scoreEntry?.maxScore || 2;
                                                
                                                return (
                                                    <TableCell 
                                                        key={critName} 
                                                        className={`text-center font-mono text-sm w-[100px] p-2 border-l ${getScoreColorClass(rawValue, maxScore)}`}
                                                    >
                                                        {renderScore(scoreEntry) || 'N/A'}
                                                    </TableCell>
                                                );
                                            })}
                                            <TableCell className="text-center w-[100px] border-l">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="cursor-help font-semibold text-green-600">{entry.totalScore.toFixed(2)}</span>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <div className="p-2 text-xs space-y-1">
                                                                <p className="font-bold mb-1">Score Breakdown:</p>
                                                                {entry.scoreBreakdown.length > 0 ? entry.scoreBreakdown.map(crit => (
                                                                    <div key={crit.name} className="flex justify-between">
                                                                        <span>{crit.name}:</span>
                                                                        <span className="font-mono ml-4">{renderScore(crit)}</span>
                                                                    </div>
                                                                )) : <p>No breakdown available.</p>}
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </TableCell>
                                            <TableCell className="w-16 text-center">
                                                <Button variant="ghost" size="icon" onClick={() => handleViewDetails(entry.slug)}>
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )})
                                ) : (
                                    <TableRow><TableCell colSpan={totalColumns} className="h-24 text-center">No results found for the current score set/filters. Try syncing data.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="flex items-center justify-end space-x-2 py-4">
                        <span className="text-sm text-muted-foreground">Page {pagination.currentPage} of {pagination.lastPage} ({pagination.total} entries)</span>
                        <Button variant="outline" size="sm" onClick={() => changePage(pagination.currentPage - 1)} disabled={isLoading || isSyncing || pagination.currentPage <= 1}><ChevronLeft className="h-4 w-4" /> Previous</Button>
                        <Button variant="outline" size="sm" onClick={() => changePage(pagination.currentPage + 1)} disabled={isLoading || isSyncing || pagination.currentPage >= pagination.lastPage}>Next <ChevronRight className="h-4 w-4" /></Button>
                    </div>
                </CardContent>
            </Card>

            <ApplicationDetailsInquiryModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                applicationSlug={selectedAppSlug}
            />
        </>
    );
}