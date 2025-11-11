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
import { RefreshCw, Trophy, AlertCircle, ChevronLeft, ChevronRight, ArrowUpDown, ScrollText, ChevronsLeft, ChevronsRight, ChartNoAxesCombined, FileDown, Loader2, Eye, MapPin, Zap, Circle, User, Layers } from 'lucide-react';
import { getLeaderboardPage, getScoreSets, syncLeaderboard, syncAllLeaderboards, getMunicipalities, getChallengeStatements, LeaderboardEntry, ScoreBreakdown, AnalyticsLeaderboardEntry, getAllLeaderboardDataForAnalytics } from '../actions/leaderboard';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import type { AppRawData } from '../actions/analysis';
import { getRawApplicationsBySlugs } from '../actions/analysis';
import { useToast } from "./ui/use-toast";
import { Badge } from './ui/badge';
import { ApplicationDetailsInquiryModal } from './ApplicationDetailsInquiryModal';
import { ScoreAnalyticsCard } from './ScoreAnalyticsCard';
import { LeaderboardBreakdowns, FilteredAppRawData, BreakdownKey, processBreakdownData, dimensionMap, extractFieldValue } from './LeaderboardBreakdowns';
import { GenerateReportButton } from './GenerateReportButton';
import { SunburstAnalyticsCard } from './SunburstAnalyticsCard'; 
import Link from 'next/link';

// PDF Imports (Using the user's working structure)
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import * as XLSX from "xlsx";
import JSZip from "jszip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Label } from './ui/label';
import { bangla } from '@/lib/utils';

// Required Breakdown Keys for the multi-table PDF export
const PDF_BREAKDOWN_KEYS: BreakdownKey[] = ['municipality', 'psCode', 'gender', 'age', 'applicantCategory'];

// --- START Unicode Font Configuration ---
const BANGLA_FONT_NAME = 'BanglaUnicodeFont';
const BANGLA_FONT_BASE64 = bangla; 

// Ensure jspdf-autotable is imported and registered
if (typeof window !== 'undefined') {
    require('jspdf-autotable');
}
// --- END Unicode Font Configuration ---


type SortableKeys = 'title' | 'total_score';

interface ScoreSet {
    slug: string;
    name: { en_GB: string };
}

interface ProblemStatement {
    name: string; 
    tag: string; 
}

const BREAKDOWN_OPTIONS: { value: BreakdownKey; label: string; }[] = [
    { value: 'municipality', label: 'Municipality' },
    { value: 'psCode', label: 'Challenge Statement' },
    { value: 'gender', label: 'Gender' },
    { value: 'age', label: 'Age Range' },
    { value: 'category', label: 'Category (Digital/Non-Digital)' },
    { value: 'applicantCategory', label: 'Applicant Type (Institution/Individual)' },
];

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
const ALL_STATEMENTS_VALUE = '__all__'; 

const SkeletonRow = () => (
    <TableRow>
        <TableCell><Skeleton className="h-5 w-5" /></TableCell>
        <TableCell><Skeleton className="h-5 w-8" /></TableCell>
        <TableCell><Skeleton className="h-5 w-full" /></TableCell>
        <TableCell><Skeleton className="h-5 w-full" /></TableCell>
        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
    </TableRow>
);

const extractFormattedValue = (app: FilteredAppRawData, slug: string): string => {
    const rawFields = (app.raw_fields as any[]) || [];
    const field = rawFields.find((f: any) => f.slug === slug);
    const value = field?.value;
    if (typeof value === "object" && value !== null) {
        return field?.translated?.en_GB || (value.en_GB || value.en || JSON.stringify(value));
    }
    return value !== null && value !== undefined ? String(value) : "";
};

/**
 * Helper to extract PS Code value when the slug is an array of possibilities.
 * This function is critical for correctly grouping PS Codes.
 */
const extractPsCodeValue = (app: FilteredAppRawData, possibleSlugs: string[]): string => {
    const rawFields = (app.raw_fields as any[]) || [];
    const field = rawFields.find((f: any) => possibleSlugs.includes(f.slug));
    if (field && field.value !== null && field.value !== undefined) {
        // Return the raw string value (e.g., 'Char-ps-1'), trimming any extra info
        return typeof field.value === 'string' ? field.value.split(" - [")[0].trim() : String(field.value);
    }
    return 'N/A';
};


interface PaginationProps { currentPage: number; lastPage: number; total: number; perPage: number; changePage: (newPage: number) => void; setPerPage: (perPage: number) => void; disabled: boolean;}
const ManagerPaginationControls: React.FC<PaginationProps> = ({
    currentPage,
    lastPage,
    total,
    perPage,
    changePage,
    setPerPage,
    disabled
}) => {
    const pageNumbers = useMemo(() => {
        const delta = 2; 
        const range: (number | string)[] = []; 

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


export function Leaderboard({ config }: { config: { apiKey: string } }) {
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
    
    const [error, setError] = useState<string | null>(null);
    const [selectedScoreSet, setSelectedScoreSet] = useState<string>("");
    const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAppSlug, setSelectedAppSlug] = useState<string | null>(null);
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
    const [currentScoreSetName, setCurrentScoreSetName] = useState<string>("");
    const [isExporting, setIsExporting] = useState(false); 
    
    const [selectedBreakdown, setSelectedBreakdown] = useState<BreakdownKey>('municipality');

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

    const [challengeStatementFilter, setChallengeStatementFilter] = useState<string[]>([]);
    const debouncedChallengeStatementString = useDebounce(challengeStatementFilter.join(','), 500);
    const [availableChallengeStatements, setAvailableChallengeStatements] = useState<ProblemStatement[]>([]);

    const renderScore = (scoreEntry: ScoreBreakdown | undefined): string => {
        if (!scoreEntry) return 'N/A';
        if (scoreEntry.score && scoreEntry.score.includes('/')) return scoreEntry.score;
        return scoreEntry.rawValue.toFixed(2);
    };

    const isChallengeFilterApplicable = useMemo(() => {
        return selectedScoreSet === TECHNICAL_SLUG || selectedScoreSet === JURY_SLUG;
    }, [selectedScoreSet]);

    const isScoreFilterApplied = useMemo(() => {
        const parsedMin = debouncedMinScore ? parseFloat(debouncedMinScore) : undefined;
        const parsedMax = debouncedMaxScore ? parseFloat(debouncedMaxScore) : undefined;
        return parsedMin !== undefined || parsedMax !== undefined;
    }, [debouncedMinScore, debouncedMaxScore]);

    const isAnySyncing = isSyncing || isSyncingAll;

    useEffect(() => {
        const fetchMuniAndPsCodes = async () => {
            if (isAnySyncing || isLoadingSets) return;
            const psCodes = await getChallengeStatements(municipalityFilter);

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
        if (!isChallengeFilterApplicable && challengeStatementFilter.length > 0) {
            setChallengeStatementFilter([]);
        }

        const availableTags = availableChallengeStatements.map(cs => cs.tag);
        const newFilters = challengeStatementFilter.filter(tag => availableTags.includes(tag));

        if (municipalityFilter !== 'all') {
            if (newFilters.length > 1) {
                setChallengeStatementFilter(newFilters.slice(0, 1));
            } else if (newFilters.length === 0 && challengeStatementFilter.length > 0) {
                setChallengeStatementFilter([]);
            }
        } else if (newFilters.length !== challengeStatementFilter.length) {
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

    /**
     * Helper to group applications by a dimension value for PDF tables.
     * @param apps - Array of applications.
     * @param key - The breakdown key ('municipality', 'gender', 'psCode', etc.).
     * @returns A map of { Dimension Value: Application[] }
     */
    const getBreakdownGroupedApps = (apps: FilteredAppRawData[], key: BreakdownKey): Map<string, FilteredAppRawData[]> => {
        const groups = new Map<string, FilteredAppRawData[]>();
        const normalizeApplicantCategory = (value: string): string => {
            const v = value.toLowerCase();
            if (v.includes('academia')) return 'Education Institute';
            if (v.includes('municipal administration') || v.includes('private organization') || v.includes('civil society') || v.includes('ngo/ingo')) return 'Institution';
            return 'Individual';
        };
        
        apps.forEach(app => {
            let value: string = 'N/A';
            const dim = dimensionMap[key];

            switch (key) {
                case 'municipality':
                    value = app.municipality || 'N/A';
                    break;
                case 'category':
                    value = app.category?.name?.en_GB || 'Uncategorized';
                    break;
                case 'psCode':
                    // **FIXED:** Use the dedicated PS Code extractor to correctly handle multi-slug arrays.
                    value = extractPsCodeValue(app, dim.slug as string[]) || 'N/A';
                    break;
                case 'gender':
                case 'age':
                case 'applicantCategory':
                    value = extractFormattedValue(app, dim.slug as string) || 'N/A';
                    if (key === 'applicantCategory') value = normalizeApplicantCategory(value);
                    if (key === 'age') {
                        // Re-use the abbreviation logic from LeaderboardBreakdowns for consistent grouping
                        value = value.toLowerCase().includes('below 18') ? '< 18' : value.toLowerCase().includes('above 65') ? '> 65' : value;
                    }
                    break;
            }

            if (!groups.has(value)) {
                groups.set(value, []);
            }
            groups.get(value)?.push(app);
        });

        // Sort applications within each group by score
        groups.forEach(group => group.sort((a, b) => b.totalScore - a.totalScore));
        
        return groups;
    };

    /**
     * Prints a universal page number footer on all pages.
     */
    const addUniversalFooter = (doc: jsPDF, fontName: string) => {
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setFont(fontName, 'normal');
            doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 10, doc.internal.pageSize.height - 10, { align: 'right' });
        }
    };


   const handleExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    setIsExporting(true);
    try {
        const slugsToExport = selectedSlugs.length > 0 ? selectedSlugs : filteredApps.map(app => app.slug);
        const appsToExport = filteredApps.filter(app => slugsToExport.includes(app.slug));
        
        if (appsToExport.length === 0) {
            toast({ title: "No Data", description: "No applications found to export.", variant: "destructive" });
            return;
        }
        
        const fileNameBase = selectedSlugs.length > 0 ? `selected_apps` : 'all_filtered_apps';

        const dataToExport = appsToExport.map((app) => {
            const row: Record<string, any> = {
                Title: app.title,
                'Total Score': app.totalScore.toFixed(2),
                Municipality: app.municipality || 'N/A',
                Category: app.category?.name?.en_GB || 'Uncategorized',
                Status: app.status,
                'Local Status': app.local_status,
            };
            app.raw_fields?.forEach((field: any) => {
                const label = field.label?.en_GB?.replace('*', '') || field.slug;
                row[label] = extractFormattedValue(app, field.slug);
            });
            return row;
        });

        if (format === 'pdf') {
            if (typeof window === 'undefined') {
                throw new Error("PDF export is only supported on the client side.");
            }

            const doc = new jsPDF('p', 'mm', 'a4');
            let y = 10;
            
            // --- START Unicode Font Integration ---
            if (BANGLA_FONT_BASE64) {
                doc.addFileToVFS(`${BANGLA_FONT_NAME}.ttf`, BANGLA_FONT_BASE64);
                doc.addFont(`${BANGLA_FONT_NAME}.ttf`, BANGLA_FONT_NAME, 'normal');
                doc.setFont(BANGLA_FONT_NAME, 'normal');
             
            } else {
                doc.text(`NOTE: PDF may not display Bangla correctly without embedding the font Base64 string.`, 10, y + 2);
                doc.setFont('Helvetica', 'normal');
            }
            y += 5;
            // --- END Unicode Font Integration ---

            doc.setFontSize(16);
            doc.text(`Application Leaderboard Report`, 10, y);
            y += 7;
            doc.setFontSize(10);
            doc.text(`Source: ${currentScoreSetName}`, 10, y);
            y += 5;
            doc.text(`Target: ${appsToExport.length} Applications (${selectedSlugs.length > 0 ? 'Selected' : 'All Filtered'})`, 10, y);
            y += 5;

            const appTableHeaders = ["#", "Title", "Score", "Municipality", "Category"];
            const baseAppTableData = appsToExport.map((app, index) => ([
                (index + 1).toString(),
                app.title,
                app.totalScore.toFixed(2),
                app.municipality || 'N/A',
                app.category?.name?.en_GB || 'Uncategorized',
            ]));

            // --- 1. Main Leaderboard Table (All Selected/Filtered Apps) ---
            autoTable(doc, {
                startY: y,
                head: [appTableHeaders],
                body: baseAppTableData,
                theme: 'striped',
                headStyles: { fillColor: [52, 73, 94], font: BANGLA_FONT_NAME, fontStyle: 'normal' },
                styles: { font: BANGLA_FONT_NAME, fontStyle: 'normal', cellWidth: 'wrap' },
                columnStyles: {
                    1: { cellWidth: 70 }, // Title column width (to enable wrap)
                    0: { cellWidth: 10 },
                    2: { cellWidth: 20 },
                    3: { cellWidth: 35 },
                    4: { cellWidth: 35 },
                },
                margin: { top: 5 },
                // REMOVED didDrawPage to prevent conflicts. Footer is added at the end.
            });

            // Start Y for the breakdown section (must be based on the end of the previous table)
            let currentY = (doc as any).lastAutoTable.finalY + 10;


            // --- 2. Multiple Breakdown Tables (Table per breakdown value) ---
            const breakdownKeysToExport: BreakdownKey[] = ['municipality', 'psCode', 'gender', 'age', 'applicantCategory'];
            // Safe lower limit on the page for starting a new breakdown group title/table
            const PAGE_BOTTOM_LIMIT = doc.internal.pageSize.height - 35; // leaves room for title + padding + footer

            // Loop through each major breakdown dimension (municipality, pscode, etc.)
            for (const key of breakdownKeysToExport) {
                const groups = getBreakdownGroupedApps(appsToExport, key);
                const breakdownTitle = dimensionMap[key].label;
                // Sort groups by key name for ordered tables
                const sortedGroups = Array.from(groups.keys()).sort();

                if (sortedGroups.length === 0 || (sortedGroups.length === 1 && sortedGroups[0] === 'N/A')) continue;
                
                // Add a page break to cleanly start the next DIMENSION report
                if (doc.internal.pages.length === 1 || currentY > PAGE_BOTTOM_LIMIT) {
                    doc.addPage(); 
                    currentY = 10;
                }
                
                doc.setFontSize(16);
                doc.text(`Breakdown Analysis: ${breakdownTitle}`, 10, currentY);
                currentY += 10;

                // Loop through each VALUE group (e.g., "Dhaka", "Male", etc.)
                for (const groupName of sortedGroups) {
                    if (groupName === 'N/A') continue;

                    const groupApps = groups.get(groupName) || [];
                    if (groupApps.length === 0) continue;
                    
                    // CRITICAL FIX: Check if the title and minimum space for a small table will fit.
                    // This forces a page break *before* printing the title if space is insufficient.
                    if (currentY > PAGE_BOTTOM_LIMIT) {
                        doc.addPage();
                        currentY = 10;
                    }

                    doc.setFontSize(12);
                    doc.text(`${breakdownTitle} Value: ${groupName} (${groupApps.length} Applications)`, 10, currentY);
                    currentY += 5; // Advance Y after printing the title line

                    // Data for the sub-table (Title, Score, Category)
                    const groupTableData = groupApps.map((app, index) => ([
                        (index + 1).toString(),
                        app.title,
                        app.totalScore.toFixed(2),
                        app.category?.name?.en_GB || 'Uncategorized',
                    ]));
                    
                    autoTable(doc, {
                        startY: currentY, // Table starts directly after the title
                        head: [["#", "Application Title", "Total Score", "Category"]],
                        body: groupTableData,
                        theme: 'striped',
                        headStyles: { fillColor: [22, 160, 133], font: BANGLA_FONT_NAME, fontStyle: 'normal' },
                        styles: { font: BANGLA_FONT_NAME, fontStyle: 'normal', cellWidth: 'wrap' },
                        columnStyles: {
                            1: { cellWidth: 80 }, // Title column width (to enable wrap)
                            0: { cellWidth: 10 },
                            2: { cellWidth: 20 },
                            3: { cellWidth: 40 },
                        },
                        margin: { top: 5 },
                        // REMOVED didDrawPage to prevent conflicts. Footer is added at the end.
                    });

                    // Update Y position for the NEXT title/element
                    currentY = (doc as any).lastAutoTable.finalY + 10;
                }
            }

            // --- Finalizing PDF: Add Universal Footer ---
            addUniversalFooter(doc, BANGLA_FONT_NAME);
            doc.save(`${fileNameBase}_full_breakdown_report.pdf`);
        } else {
            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Applications");
            XLSX.writeFile(workbook, `${fileNameBase}.${format}`);
        }

        toast({ title: "Export successful!", description: `${appsToExport.length} applications exported to ${format.toUpperCase()}.` });
    } catch (err: any) {
        console.error(err);
        toast({ title: "Export Failed", description: `Could not generate export file: ${err.message}`, variant: "destructive" });
    } finally {
        setIsExporting(false);
        setSelectedSlugs([]);
    }
};


    const handleViewDetails = (slug: string) => { setSelectedAppSlug(slug); setIsModalOpen(true); };
    const handleSort = (key: SortableKeys) => { setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' })); };
    const renderSortArrow = (column: SortableKeys) => (sortConfig.key !== column ? <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" /> : sortConfig.direction === 'asc' ? '▲' : '▼');
    
    const handleSelectRow = (slug: string, checked: boolean) => setSelectedSlugs(prev => checked ? [...prev, slug] : prev.filter(s => s !== slug));
    const handleSelectAll = (checked: boolean) => setSelectedSlugs(checked ? leaderboard.map(r => r.slug) : []);

    const cleanMunicipalities = municipalities.filter(muni => muni && muni.trim() !== "");
    const isDetailedView = selectedScoreSet !== TECHNICAL_SLUG && selectedScoreSet !== JURY_SLUG;
    const isMultiSelect = municipalityFilter === 'all';
    
    const singlePsValue = !isMultiSelect && challengeStatementFilter.length === 0 ? ALL_STATEMENTS_VALUE : challengeStatementFilter[0];
    const handleSingleSelectChange = (tag: string) => { setChallengeStatementFilter(tag === ALL_STATEMENTS_VALUE ? [] : [tag]); };
    const handleMultiSelectClick = (tag: string) => { setChallengeStatementFilter(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]); };
    
    const totalSelected = selectedSlugs.length;
    const isAllSelected = totalSelected > 0 && totalSelected === leaderboard.length;
    const exportTargetCount = selectedSlugs.length > 0 ? selectedSlugs.length : filteredApps.length;
    const currentScoreSetNameForDisplay = useMemo(() => scoreSets.find(s => s.slug === selectedScoreSet)?.name.en_GB || "Loading...", [scoreSets, selectedScoreSet]);

    return (
        <Card className="mt-6 shadow-lg">
            <CardHeader>
                <div className="md:flex justify-between items-start">
                    <div>
                        <div className='flex items-center gap-2'>
                            <CardTitle className="flex items-center gap-2"><Trophy className="w-6 h-6" /> Leaderboard & Analytics</CardTitle>
                        <Link href={"/scoring-analysis"}><Button variant="destructive" >
                            <ChartNoAxesCombined className="mr-2 h-4 w-4" />Scoring Analysis
                        </Button></Link>

                        </div>
                        
                        <CardDescription>Analyze and manage applications synchronized from GoodGrants.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 mt-4 md:mt-0 flex-wrap">
                        <GenerateReportButton
                            filteredApps={filteredApps}
                            municipalityFilter={debouncedMunicipalityFilter}
                            challengeStatementFilter={debouncedChallengeStatementString}
                            lastSyncTime={lastSyncTime}
                            scoreSetName={currentScoreSetNameForDisplay}
                            minScore={debouncedMinScore}
                            maxScore={debouncedMaxScore}
                            disabled={isAnySyncing || isAnalyticsLoading}
                            skipScoreDistribution={isScoreFilterApplied}
                        />

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
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-4">
                                    <Input placeholder="Search title..." value={titleSearch} onChange={(e) => setTitleSearch(e.target.value)} className="pl-4" disabled={isAnySyncing} />
                                    <Select value={municipalityFilter} onValueChange={setMunicipalityFilter} disabled={isAnySyncing || municipalities.length === 0}>
                                        <SelectTrigger><SelectValue placeholder="Filter Municipality" /></SelectTrigger>
                                        <SelectContent><SelectItem value="all">All Municipalities</SelectItem>{cleanMunicipalities.map(muni => <SelectItem key={muni} value={muni}>{muni}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <Input type="number" placeholder="Min Score" value={minScore} onChange={(e) => setMinScore(e.target.value)} disabled={isAnySyncing} />
                                    <Input type="number" placeholder="Max Score" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} disabled={isAnySyncing} />
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button disabled={isExporting || isLoading || isAnySyncing} className="w-full">
                                                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                                                Export ({exportTargetCount} Apps)
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleExport("csv")}>As CSV</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleExport("xlsx")}>As XLSX</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleExport("pdf")}>As PDF Report</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>

                                </div>
                                {isChallengeFilterApplicable && availableChallengeStatements.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                                        {isMultiSelect ? (
                                            <div className="flex flex-col space-y-1 xl:col-span-full">
                                                <Label className="text-sm font-medium leading-none">Challenge Statements (Multi-select)</Label>
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

                            <ManagerPaginationControls
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
                                        <TableHead className="w-12">
                                            <Checkbox 
                                                checked={isAllSelected} 
                                                onCheckedChange={handleSelectAll} 
                                                disabled={leaderboard.length === 0 || isLoading || isAnySyncing} 
                                            />
                                        </TableHead>
                                        <TableHead className="w-16">Rank</TableHead>
                                        <TableHead className="cursor-pointer w-[30%]" onClick={() => handleSort('title')}>Application Title & Tags {renderSortArrow('title')}</TableHead>
                                        {isDetailedView && (<TableHead className="text-center w-[150px] border-l">Score Breakdown</TableHead>)}
                                        {isChallengeFilterApplicable && (<TableHead className="w-[150px] border-l">Problem Statement</TableHead>)}
                                        <TableHead className="cursor-pointer text-center w-[100px] border-l" onClick={() => handleSort('total_score')}>Total Score {renderSortArrow('total_score')}</TableHead>
                                        <TableHead className="w-16 text-center">Actions</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                        {isLoading || isAnySyncing ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
                                            : error ? <TableRow><TableCell colSpan={6} className="h-24 text-center text-red-500"><AlertCircle className="mx-auto h-6 w-6 mb-2" />{error}</TableCell></TableRow>
                                                : leaderboard.length > 0 ? leaderboard.map((entry, index) => {
                                                    const rank = (pagination.currentPage - 1) * pagination.perPage + index + 1;
                                                    const psCodeDisplay = entry.tags.find(t => availableChallengeStatements.some(cs => cs.tag === t)) || 'N/A';
                                                    const isSelected = selectedSlugs.includes(entry.slug);

                                                    return (<TableRow key={entry.slug} data-state={isSelected && "selected"}>
                                                        <TableCell><Checkbox checked={isSelected} onCheckedChange={(c) => handleSelectRow(entry.slug, !!c)} /></TableCell>
                                                        
                                                        <TableCell className="font-bold text-lg">{rank}</TableCell>
                                                        <TableCell><div>{entry.title}</div><div className="flex flex-wrap gap-1 mt-2">{entry.tags.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div></TableCell>
                                                        
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
                                                        {isChallengeFilterApplicable && <TableCell className="border-l text-sm"><Badge variant="outline">{psCodeDisplay}</Badge></TableCell>}
                                                        <TableCell className="text-center border-l">
                                                            <TooltipProvider><Tooltip>
                                                                <TooltipTrigger asChild><span className="cursor-help font-semibold text-lg text-green-600">{entry.totalScore.toFixed(2)}</span></TooltipTrigger>
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
                                                    : <TableRow><TableCell colSpan={6} className="h-24 text-center">No results found for the current filters.</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </div>

                            <ManagerPaginationControls
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-4">
                                <Input placeholder="Search title..." value={titleSearch} onChange={(e) => setTitleSearch(e.target.value)} className="pl-4" disabled={isAnySyncing} />
                                <Select value={municipalityFilter} onValueChange={setMunicipalityFilter} disabled={isAnySyncing || municipalities.length === 0}>
                                    <SelectTrigger><SelectValue placeholder="Filter Municipality" /></SelectTrigger>
                                    <SelectContent><SelectItem value="all">All Municipalities</SelectItem>{cleanMunicipalities.map(muni => <SelectItem key={muni} value={muni}>{muni}</SelectItem>)}</SelectContent>
                                </Select>
                                <Input type="number" placeholder="Min Score" value={minScore} onChange={(e) => setMinScore(e.target.value)} disabled={isAnySyncing} />
                                <Input type="number" placeholder="Max Score" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} disabled={isAnySyncing} />
                                <Select value={selectedBreakdown} onValueChange={(v) => setSelectedBreakdown(v as BreakdownKey)} disabled={isAnySyncing || isAnalyticsLoading}>
                                    <SelectTrigger><SelectValue placeholder="Select Breakdown Dimension" /></SelectTrigger>
                                    <SelectContent>
                                        {BREAKDOWN_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            {isChallengeFilterApplicable && availableChallengeStatements.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                                    {isMultiSelect ? (
                                        <div className="flex flex-col space-y-1 xl:col-span-full">
                                            <Label className="text-sm font-medium leading-none">Challenge Statements (Multi-select)</Label>
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
                        <SunburstAnalyticsCard
                            filteredApps={filteredApps}
                            isLoading={isAnalyticsLoading}
                            municipalityFilter={debouncedMunicipalityFilter}
                        />
                        <ScoreAnalyticsCard
                            leaderboard={filteredApps as unknown as AnalyticsLeaderboardEntry[]}
                            municipalityFilter={debouncedMunicipalityFilter}
                            isLoading={isAnalyticsLoading}
                            scoreSetName={currentScoreSetNameForDisplay}
                            filteredApps={filteredApps}
                            skipScoreDistribution={isScoreFilterApplied}
                        />
                        <LeaderboardBreakdowns 
                            filteredApps={filteredApps} 
                            isLoading={isAnalyticsLoading} 
                            selectedBreakdown={selectedBreakdown} 
                        />
                    </TabsContent>
                </Tabs>
            </CardContent>
            <ApplicationDetailsInquiryModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} applicationSlug={selectedAppSlug} />
        </Card>
    );
}