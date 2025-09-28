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
import { RefreshCw, Trophy, AlertCircle, ChevronLeft, ChevronRight, ArrowUpDown, Tag, Search } from 'lucide-react';
import { getLeaderboardData, getScoreSets } from '../actions/leaderboard';
import { addEligibleTagToApplications } from '../actions/application';
import { useToast } from "./ui/use-toast";

interface EnrichedLeaderboardEntry {
  slug: string;
  tags: string;
  applicantName: string;
  municipality: string;
  totalScore: number;
  title: string;
  scoreBreakdown: { name: string; score: string }[];
}

interface ScoreSet {
    slug: string;
    name: { en_GB: string };
}

interface LeaderboardProps {
    config: { apiKey: string };
}

// --- Custom Hook for Debouncing ---
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
        <TableCell><Skeleton className="h-5 w-40" /></TableCell>
        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
        <TableCell><Skeleton className="h-5 w-56" /></TableCell>
        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
    </TableRow>
);

export function Leaderboard({ config }: LeaderboardProps) {
    const [leaderboard, setLeaderboard] = useState<EnrichedLeaderboardEntry[]>([]);
    const [scoreSets, setScoreSets] = useState<ScoreSet[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isLoadingSets, setIsLoadingSets] = useState(true);
    const [isTagging, setIsTagging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedScoreSet, setSelectedScoreSet] = useState<string>("");
    const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
    const { toast } = useToast();
    
    const [pagination, setPagination] = useState({ currentPage: 1, lastPage: 1, total: 0, perPage: 20 });
    const [sortConfig, setSortConfig] = useState<{ key: keyof EnrichedLeaderboardEntry; direction: 'asc' | 'desc' }>({ key: 'totalScore', direction: 'desc' });
    const [titleSearch, setTitleSearch] = useState("");
    const debouncedTitleSearch = useDebounce(titleSearch, 500);

    const isMounted = useRef(false);
    useEffect(() => {
        if (isMounted.current) {
            setPagination(p => ({ ...p, currentPage: 1 }));
        } else {
            isMounted.current = true;
        }
    }, [debouncedTitleSearch]);

    useEffect(() => {
        const fetchScoreSets = async () => {
            if (!config.apiKey) { setError("API key is not configured."); setIsLoadingSets(false); return; }
            setIsLoadingSets(true);
            try {
                const data = await getScoreSets(config);
                setScoreSets(data);
                if (data.length > 0) {
                    const eligibilitySet = data.find(set => set.name.en_GB === 'Eligibility Shortlisting');
                    setSelectedScoreSet(eligibilitySet ? eligibilitySet.slug : data[0].slug);
                }
            } catch (err: any) { setError("Failed to load score sets."); } 
            finally { setIsLoadingSets(false); }
        };
        fetchScoreSets();
    }, [config]);

    const fetchLeaderboard = useCallback(async () => {
        if (!config.apiKey || !selectedScoreSet) return;
        setIsLoadingData(true);
        setError(null);
        try {
            const response = await getLeaderboardData(config, selectedScoreSet, pagination.currentPage, pagination.perPage, debouncedTitleSearch);
            setLeaderboard(response.data);
            setPagination(p => ({ ...p, currentPage: response.current_page, lastPage: response.last_page, total: response.total }));
        } catch (err: any) {
            setError(err.message || "Failed to load leaderboard data.");
        } finally {
            setIsLoadingData(false);
        }
    }, [config, selectedScoreSet, pagination.currentPage, pagination.perPage, debouncedTitleSearch]);

    useEffect(() => {
        if (selectedScoreSet) {
            fetchLeaderboard();
        }
    }, [selectedScoreSet, pagination.currentPage, pagination.perPage, debouncedTitleSearch, fetchLeaderboard]);

    const sortedLeaderboard = useMemo(() => {
        let sortableItems = [...leaderboard];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [leaderboard, sortConfig]);

    const handleSort = (key: keyof EnrichedLeaderboardEntry) => {
        setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
    };

    const renderSortArrow = (column: keyof EnrichedLeaderboardEntry) => {
        if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
        return sortConfig.direction === 'asc' ? '▲' : '▼';
    };

    const changePage = (newPage: number) => {
        if (newPage > 0 && newPage <= pagination.lastPage) {
            setSelectedSlugs([]);
            setPagination(prev => ({...prev, currentPage: newPage}));
        }
    };

    const isEligibleForTagging = (entry: EnrichedLeaderboardEntry) => {
        return entry.totalScore >= 4 && !entry.tags?.includes('Eligible-1');
    };

    const eligibleRows = useMemo(() => sortedLeaderboard.filter(isEligibleForTagging), [sortedLeaderboard]);

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
            await addEligibleTagToApplications(config, selectedSlugs);
            toast({ title: "Success", description: `${selectedSlugs.length} applications tagged successfully.` });
            setSelectedSlugs([]);
            fetchLeaderboard();
        } catch (err: any) {
            toast({ title: "Tagging Failed", description: err.message, variant: "destructive" });
        } finally {
            setIsTagging(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5" /> Leaderboard</CardTitle>
                        <CardDescription>Top ranked applications based on the selected score set.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                         {selectedSlugs.length > 0 && (
                            <Button onClick={handleTagSelected} disabled={isTagging}>
                                <Tag className="mr-2 h-4 w-4"/> Tag {selectedSlugs.length} Selected as Eligible-1
                            </Button>
                        )}
                        <Select value={pagination.perPage.toString()} onValueChange={(value) => setPagination(p => ({...p, perPage: Number(value), currentPage: 1}))}>
                            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10">10 / page</SelectItem>
                                <SelectItem value="20">20 / page</SelectItem>
                                <SelectItem value="50">50 / page</SelectItem>
                                <SelectItem value="100">100 / page</SelectItem>
                            </SelectContent>
                        </Select>
                        {isLoadingSets ? (<Skeleton className="h-10 w-[220px]" />) : (
                            <Select value={selectedScoreSet} onValueChange={(slug) => {setPagination(p => ({...p, currentPage: 1})); setSelectedScoreSet(slug)}} disabled={scoreSets.length === 0}>
                                <SelectTrigger className="w-[220px]"><SelectValue placeholder="Select a score set" /></SelectTrigger>
                                <SelectContent>
                                    {scoreSets.map(set => <SelectItem key={set.slug} value={set.slug}>{set.name.en_GB}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                        <Button variant="outline" size="icon" onClick={fetchLeaderboard} disabled={isLoadingData || !selectedScoreSet}>
                            <RefreshCw className={`h-4 w-4 ${isLoadingData ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="my-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by application title (searches all pages)..."
                            value={titleSearch}
                            onChange={(e) => setTitleSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">
                                    <Checkbox
                                        checked={selectedSlugs.length > 0 && eligibleRows.length > 0 && selectedSlugs.length === eligibleRows.length}
                                        onCheckedChange={handleSelectAll}
                                        disabled={eligibleRows.length === 0}
                                        aria-label="Select all eligible rows"
                                    />
                                </TableHead>
                                <TableHead className="w-16">Index</TableHead>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('applicantName')}><div className="flex items-center">Applicant {renderSortArrow('applicantName')}</div></TableHead>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('municipality')}><div className="flex items-center">Municipality {renderSortArrow('municipality')}</div></TableHead>
                                <TableHead>Application Title</TableHead>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('totalScore')}><div className="flex items-center">Score {renderSortArrow('totalScore')}</div></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoadingData ? (
                                Array.from({ length: pagination.perPage }).map((_, i) => <SkeletonRow key={i} />)
                            ) : error ? (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center text-red-500"><AlertCircle className="mx-auto h-6 w-6 mb-2" />{error}</TableCell></TableRow>
                            ) : sortedLeaderboard.length > 0 ? (
                                sortedLeaderboard.map((entry, index) => {
                                    const isEligible = isEligibleForTagging(entry);
                                    return (
                                    <TableRow key={entry.slug}>
                                        <TableCell>
                                            {isEligible && (
                                                <Checkbox
                                                    checked={selectedSlugs.includes(entry.slug)}
                                                    onCheckedChange={(checked) => handleSelectRow(entry.slug, !!checked)}
                                                    aria-label={`Select row for ${entry.title}`}
                                                />
                                            )}
                                        </TableCell>
                                        <TableCell className="font-bold text-lg">{(pagination.currentPage - 1) * pagination.perPage + index + 1}</TableCell>
                                        <TableCell>{entry.applicantName}</TableCell>
                                        <TableCell>{entry.municipality}</TableCell>
                                        <TableCell>{entry.title}</TableCell>
                                        <TableCell>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="cursor-help font-semibold">{entry.totalScore.toFixed(2)}</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <div className="p-2 text-xs space-y-1">
                                                            <p className="font-bold mb-1">Score Breakdown:</p>
                                                            {entry.scoreBreakdown.length > 0 ? entry.scoreBreakdown.map(crit => (
                                                                <div key={crit.name} className="flex justify-between">
                                                                    <span>{crit.name}:</span>
                                                                    <span className="font-mono ml-4">{crit.score}</span>
                                                                </div>
                                                            )) : <p>No breakdown available.</p>}
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </TableCell>
                                    </TableRow>
                                )})
                            ) : (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center">No results found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex items-center justify-end space-x-2 py-4">
                    <span className="text-sm text-muted-foreground">Page {pagination.currentPage} of {pagination.lastPage} ({pagination.total} entries)</span>
                    <Button variant="outline" size="sm" onClick={() => changePage(pagination.currentPage - 1)} disabled={isLoadingData || pagination.currentPage <= 1}><ChevronLeft className="h-4 w-4" /> Previous</Button>
                    <Button variant="outline" size="sm" onClick={() => changePage(pagination.currentPage + 1)} disabled={isLoadingData || pagination.currentPage >= pagination.lastPage}>Next <ChevronRight className="h-4 w-4" /></Button>
                </div>
            </CardContent>
        </Card>
    );
}

