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
import { RefreshCw, Trophy, AlertCircle, ChevronLeft, ChevronRight, ArrowUpDown, Tag, Search } from 'lucide-react';
import { getLeaderboardPage, getScoreSets } from '@/actions/leaderboard';
import { addEligibleTagToApplications } from '@/actions/application';
import { useToast } from "@/components/ui/use-toast";
import { Badge } from './ui/badge';

type SortableKeys = 'title' | 'totalScore';

interface LeaderboardEntry {
  slug: string;
  tags: string[];
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
        <TableCell><Skeleton className="h-5 w-full" /></TableCell>
        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
    </TableRow>
);

export function Leaderboard({ config }: LeaderboardProps) {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [scoreSets, setScoreSets] = useState<ScoreSet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingSets, setIsLoadingSets] = useState(true);
    const [isTagging, setIsTagging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedScoreSet, setSelectedScoreSet] = useState<string>("");
    const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
    const [loadingProgress, setLoadingProgress] = useState<number | null>(null);
    const { toast } = useToast();
    
    const [pagination, setPagination] = useState({ currentPage: 1, lastPage: 1, total: 0, perPage: 20 });
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'asc' | 'desc' }>({ key: 'totalScore', direction: 'desc' });
    const [titleSearch, setTitleSearch] = useState("");
    const debouncedTitleSearch = useDebounce(titleSearch, 500);

    // Effect for fetching score sets
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

    // Main data fetching logic
    const fetchLeaderboard = useCallback(async () => {
        if (!config.apiKey || !selectedScoreSet) return;
        
        setIsLoading(true);
        setError(null);
        try {
            const sortKeyForApi = sortConfig.key === 'totalScore' ? 'auto_score' : sortConfig.key;
            // The search logic is now simplified as the API doesn't support it directly.
            // We pass an empty string for title search to the backend. The filtering happens client-side.
            const response = await getLeaderboardPage(config, selectedScoreSet, pagination.currentPage, pagination.perPage, { key: sortKeyForApi, direction: sortConfig.direction });
            
            if (response && response.data) {
                setLeaderboard(response.data);
                setPagination(p => ({ ...p, currentPage: response.current_page, lastPage: response.last_page, total: response.total }));
            } else {
                 throw new Error("Received an invalid response from the server.");
            }
        } catch (err: any) {
            setError(err.message || "Failed to load leaderboard data.");
        } finally {
            setIsLoading(false);
        }
    }, [config, selectedScoreSet, pagination.currentPage, pagination.perPage, sortConfig]);

    useEffect(() => {
        if (selectedScoreSet) {
            fetchLeaderboard();
        }
    }, [selectedScoreSet, pagination.currentPage, pagination.perPage, sortConfig, fetchLeaderboard]);

    // Client-side filtering for title search
    const filteredData = useMemo(() => {
        if (!debouncedTitleSearch) return leaderboard;
        return leaderboard.filter(entry => entry.title.toLowerCase().includes(debouncedTitleSearch.toLowerCase()));
    }, [leaderboard, debouncedTitleSearch]);


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
        return entry.totalScore >= 4 && !entry.tags?.includes('Eligible-1');
    };

    const eligibleRows = useMemo(() => filteredData.filter(isEligibleForTagging), [filteredData]);

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
                <div className="md:flex justify-between items-start">
                    <div>
                        <CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5" /> Leaderboard</CardTitle>
                        <CardDescription>Top ranked applications based on the selected score set.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 mt-4 md:mt-0">
                         {selectedSlugs.length > 0 && (
                            <Button onClick={handleTagSelected} disabled={isTagging}>
                                <Tag className="mr-2 h-4 w-4"/> Tag {selectedSlugs.length} as Eligible-1
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
                            <Select value={selectedScoreSet} onValueChange={(slug) => {setPagination(p => ({...p, currentPage: 1})); setTitleSearch(""); setSelectedScoreSet(slug)}} disabled={scoreSets.length === 0}>
                                <SelectTrigger className="w-[220px]"><SelectValue placeholder="Select a score set" /></SelectTrigger>
                                <SelectContent>
                                    {scoreSets.map(set => <SelectItem key={set.slug} value={set.slug}>{set.name.en_GB}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                        <Button variant="outline" size="icon" onClick={fetchLeaderboard} disabled={isLoading || !selectedScoreSet}>
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="my-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by title on current page..."
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
                                    />
                                </TableHead>
                                <TableHead className="w-16">Rank</TableHead>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('title')}>
                                    <div className="flex items-center">Application Title & Tags {renderSortArrow('title')}</div>
                                </TableHead>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('totalScore')}>
                                    <div className="flex items-center">Score {renderSortArrow('totalScore')}</div>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: pagination.perPage }).map((_, i) => <SkeletonRow key={i} />)
                            ) : error ? (
                                <TableRow><TableCell colSpan={4} className="h-24 text-center text-red-500"><AlertCircle className="mx-auto h-6 w-6 mb-2" />{error}</TableCell></TableRow>
                            ) : filteredData.length > 0 ? (
                                filteredData.map((entry, index) => {
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
                                        <TableCell>
                                            <div>{entry.title}</div>
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {entry.tags.map(tag => (
                                                    <Badge key={tag} variant="secondary" className="font-normal">{tag}</Badge>
                                                ))}
                                            </div>
                                        </TableCell>
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
                                <TableRow><TableCell colSpan={4} className="h-24 text-center">No results found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex items-center justify-end space-x-2 py-4">
                    <span className="text-sm text-muted-foreground">Page {pagination.currentPage} of {pagination.lastPage} ({pagination.total} entries)</span>
                    <Button variant="outline" size="sm" onClick={() => changePage(pagination.currentPage - 1)} disabled={isLoading || pagination.currentPage <= 1}><ChevronLeft className="h-4 w-4" /> Previous</Button>
                    <Button variant="outline" size="sm" onClick={() => changePage(pagination.currentPage + 1)} disabled={isLoading || pagination.currentPage >= pagination.lastPage}>Next <ChevronRight className="h-4 w-4" /></Button>
                </div>
            </CardContent>
        </Card>
    );
}

