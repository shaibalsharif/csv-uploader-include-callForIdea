// csv-uploader-include-callForIdea/components/DuplicateFinder.tsx

"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, CheckCircle, Archive, AlertCircle, RefreshCw, SkipForward, ChevronDown, ChevronUp } from 'lucide-react';
import { getRawApplicationsForScan, getApplicationDetailsFromDB } from '@/actions/analysis';
import type { AppRawData } from '@/actions/analysis';
import { archiveApplication } from '@/actions/application';
import { useToast } from '@/components/ui/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from "@/components/ui/separator";

interface DuplicateGroup {
    primary: AppRawData;
    duplicates: AppRawData[];
}

type ExpandedDetails = Record<string, { primary: AppRawData, duplicate: AppRawData } | 'loading' | null>;

const FIELD_SLUGS = {
    fullName: 'lOoZYQWa',
    ageRange: 'xjzONPwj',
    municipality: 'rDkKljjz',
    description: 'GqVZgKbW',
};

const municipalityChallengeSlugs: Record<string, string> = {
    "Gaibandha": "RjAnzBZJ",
    "Sirajganj": "OJBPQyGP",
    "Charghat": "jDJaNYGG",
    "Chapainawabganj": "gkknPnQp",
};

// --- Helper Functions (Shared) ---
const extractValue = (app: AppRawData, slug: string): string => {
    const rawFields = (app.raw_fields as any[]) || [];
    const field = rawFields.find((f: any) => f.slug === slug);
    if (!field) return '';
    const value = field.value;
    if (typeof value === 'object' && value !== null) {
        return field.translated?.en_GB || value.en_GB || value.en || '';
    }
    return String(value || '');
};

const normalizeApplication = (app: AppRawData) => {
    const muniName = extractValue(app, FIELD_SLUGS.municipality).split(' - ')[0].trim();
    const challengeSlug = municipalityChallengeSlugs[muniName] || null;

    const challengeStatement = challengeSlug ? extractValue(app, challengeSlug) : '';

    return {
        key: `${extractValue(app, FIELD_SLUGS.fullName)}|${extractValue(app, FIELD_SLUGS.ageRange)}|${muniName}|${challengeStatement}|${extractValue(app, FIELD_SLUGS.description)}`,
        data: {
            fullName: extractValue(app, FIELD_SLUGS.fullName),
            ageRange: extractValue(app, FIELD_SLUGS.ageRange),
            municipality: muniName,
            challengeStatement: challengeStatement,
            descriptionSnippet: extractValue(app, FIELD_SLUGS.description).substring(0, 50) + '...',
        },
    };
};

const formatRawFieldValue = (field: any) => {
    if (!field || field.value === null || field.value === undefined) return "N/A";
    let value = field.value;
    if (typeof value === "object" && value !== null) {
        return field.translated?.en_GB || value.en_GB || value.en || JSON.stringify(value);
    }
    return String(value);
};

// --- In-line Comparison Component ---
const FieldComparison = ({ apps }: { apps: { primary: AppRawData, duplicate: AppRawData } }) => {
    const fieldsMap = new Map<string, { primary: string, duplicate: string }>();
    const primaryFields = (apps.primary.raw_fields as any[]) || [];
    const duplicateFields = (apps.duplicate.raw_fields as any[]) || [];

    const allSlugs = [...new Set([...primaryFields.map(f => f.slug), ...duplicateFields.map(f => f.slug)])];

    for (const slug of allSlugs) {
        const primaryField = primaryFields.find(f => f.slug === slug);
        const duplicateField = duplicateFields.find(f => f.slug === slug);

        const primaryValue = formatRawFieldValue(primaryField);
        const duplicateValue = formatRawFieldValue(duplicateField);
        const label = primaryField?.label?.en_GB?.replace('*', '') || duplicateField?.label?.en_GB?.replace('*', '') || slug;

        if (primaryValue === "N/A" && duplicateValue === "N/A") continue;

        fieldsMap.set(label, { primary: primaryValue, duplicate: duplicateValue });
    }

    return (
        <CardContent className="pt-4 pb-2">
            <h4 className="font-bold mb-2 text-sm">Full Field Comparison</h4>
            <div className="grid grid-cols-3 text-xs font-semibold border-b pb-1">
                <div>Field</div>
                <div className="text-primary">Original Value</div>
                <div className="text-destructive">Duplicate Value</div>
            </div>
            <ScrollArea className="h-56">
                <div className="text-xs">
                    {Array.from(fieldsMap.entries()).map(([label, values], index) => {
                        const isDifferent = values.primary !== values.duplicate;

                        return (
                            <div key={index} className={`grid grid-cols-3 py-1.5 border-b last:border-b-0 ${isDifferent ? 'bg-yellow-50/20 dark:bg-yellow-900/10' : ''}`}>
                                <div className="font-medium text-muted-foreground">{label}</div>
                                <div className={`break-words ${isDifferent ? 'font-bold text-primary' : 'text-foreground'}`}>
                                    {values.primary}
                                </div>
                                <div className={`break-words ${isDifferent ? 'font-bold text-destructive' : 'text-foreground'}`}>
                                    {values.duplicate}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
        </CardContent>
    );
};


// --- Main Duplicate Finder Component ---
export function DuplicateFinder({ config }: { config: { apiKey: string } }) {
    const [scanState, setScanState] = useState<'idle' | 'scanning' | 'complete' | 'error'>('idle');
    const [applications, setApplications] = useState<AppRawData[]>([]);
    const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
    const [archiveLoading, setArchiveLoading] = useState<Record<string, boolean>>({});
    const [archiveComplete, setArchiveComplete] = useState<Record<string, boolean>>({});

    const [currentGroupIndex, setCurrentGroupIndex] = useState(0);

    const [expandedSlugs, setExpandedSlugs] = useState<ExpandedDetails>({});

    const { toast } = useToast();

    const startScan = useCallback(async () => {
        if (!config.apiKey) {
            setScanState('error');
            toast({ title: "Configuration Error", description: "API Key is missing.", variant: "destructive" });
            return;
        }

        setScanState('scanning');
        setApplications([]);
        setDuplicateGroups([]);
        setArchiveComplete({});
        setArchiveLoading({});
        setCurrentGroupIndex(0);
        setExpandedSlugs({});

        try {
            const rawApps: AppRawData[] = await getRawApplicationsForScan();
            setApplications(rawApps);

            if (rawApps.length === 0) {
                setScanState('complete');
                toast({ title: "Scan Complete", description: "No eligible applications found in the database to scan. Ensure the DB is synced and applications belong to the target account.", variant: "default" });
                return;
            }

            const groups: Record<string, AppRawData[]> = {};

            for (const app of rawApps) {
                // Skip if already archived in the DB (only happens if the user refreshes mid-scan)
                if (app.local_status !== 'active') continue;

                const { key } = normalizeApplication(app);

                if (!groups[key]) {
                    groups[key] = [];
                }
                groups[key].push(app);
            }

            const duplicates: DuplicateGroup[] = Object.values(groups)
                .filter(group => group.length > 1)
                .map(group => {
                    const sortedGroup = group.sort((a, b) =>
                        new Date(extractValue(a, 'updated_at') || '2000-01-01').getTime() - new Date(extractValue(b, 'updated_at') || '2000-01-01').getTime()
                    );

                    return {
                        primary: sortedGroup[0],
                        duplicates: sortedGroup.slice(1),
                    };
                });

            setDuplicateGroups(duplicates);

            setScanState('complete');
            if (duplicates.length === 0) {
                toast({ title: "Scan Complete", description: `Scanned ${rawApps.length} eligible applications. No duplicates found.`, variant: "default" });
            } else {
                toast({ title: "Duplicates Found!", description: `Found ${duplicates.length} groups with duplicates. Review and archive the redundant ones.`, variant: "destructive" });
            }
        } catch (err) {
            console.error(err);
            setScanState('error');
            toast({ title: "Scan Failed", description: "An error occurred during the scan.", variant: "destructive" });
        }
    }, [config.apiKey, toast]);

    useEffect(() => {
        if (scanState === 'idle') {
            startScan();
        }
    }, [scanState, startScan]);

    const handleSkip = useCallback(() => {
        setCurrentGroupIndex(prev => prev + 1);
        toast({ title: "Skipped", description: `Review of duplicate group ${currentGroupIndex + 1} skipped.`, variant: "default" });
    }, [currentGroupIndex, toast]);

    const advanceGroup = useCallback(() => {
        setCurrentGroupIndex(prev => prev + 1);
    }, []);

    const handleShowDetails = useCallback(async (primarySlug: string, duplicateSlug: string) => {
        const key = `${primarySlug}-${duplicateSlug}`;

        if (expandedSlugs[key]) {
            setExpandedSlugs(prev => {
                const newState = { ...prev };
                delete newState[key];
                return newState;
            });
            return;
        }

        setExpandedSlugs(prev => ({ ...prev, [key]: 'loading' }));

        try {
            const [primaryDetails, duplicateDetails] = await Promise.all([
                getApplicationDetailsFromDB(primarySlug),
                getApplicationDetailsFromDB(duplicateSlug),
            ]);

            if (primaryDetails && duplicateDetails) {
                setExpandedSlugs(prev => ({ ...prev, [key]: { primary: primaryDetails, duplicate: duplicateDetails } as { primary: AppRawData, duplicate: AppRawData } }));
            } else {
                throw new Error("Failed to load details from DB.");
            }
        } catch (error) {
            toast({ title: "Fetch Failed", description: "Could not fetch details from the local database.", variant: "destructive" });
            setExpandedSlugs(prev => {
                const newState = { ...prev };
                delete newState[key];
                return newState;
            });
        }
    }, [expandedSlugs, toast]);


    const handleMarkDuplicateAndArchive = async (slug: string) => {
        setArchiveLoading(prev => ({ ...prev, [slug]: true }));
        try {
            await archiveApplication(config, slug);
            toast({ title: "Archived", description: `Application ${slug} has been successfully archived.`, variant: "default" });

            const currentGroup = duplicateGroups[currentGroupIndex];

            // Optimistic update of the local group status
            const updatedDuplicates = currentGroup.duplicates.map(dup =>
                dup.slug === slug ? { ...dup, local_status: 'archived' } : dup
            );

            // Update the state with the new group
            const newDuplicateGroups = duplicateGroups.map((group, index) =>
                index === currentGroupIndex ? { ...group, duplicates: updatedDuplicates } : group
            );

            setDuplicateGroups(newDuplicateGroups);

            // Check if all remaining duplicates in the current group are now archived
            const allArchived = updatedDuplicates.every(dup => dup.local_status === 'archived');
            if (allArchived) {
                advanceGroup();
            }

        } catch (error) {
            toast({ title: "Archive Failed", description: `Could not archive application ${slug}.`, variant: "destructive" });
        } finally {
            setArchiveLoading(prev => ({ ...prev, [slug]: false }));
        }
    };

    const renderDuplicateItem = (primarySlug: string, app: AppRawData) => {
        const normalized = normalizeApplication(app);
        // UPDATED: Check local_status directly from the application data object
        const isArchived = app.local_status === 'archived';
        const isProcessing = archiveLoading[app.slug];

        const detailKey = `${primarySlug}-${app.slug}`;
        const expandedState = expandedSlugs[detailKey];
        const isExpanded = !!expandedState && expandedState !== 'loading';

        return (
            <Card key={app.slug} className={`p-0 ${isArchived ? 'bg-green-50/50 dark:bg-green-900/10' : 'bg-red-50/50 dark:bg-red-900/10'}`}>
                <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-sm">
                            Duplicate: {app.title}
                            <Badge variant="outline" className="ml-2 text-xs">{app.slug}</Badge>
                        </h4>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1 mb-3">
                        <p><strong>Name:</strong> {normalized.data.fullName} | <strong>Age:</strong> {normalized.data.ageRange}</p>
                        <p><strong>Municipality:</strong> {normalized.data.municipality} | <strong>Challenge:</strong> {normalized.data.challengeStatement || 'N/A'}</p>
                        <p><strong>Description Snippet:</strong> {normalized.data.descriptionSnippet}</p>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleShowDetails(primarySlug, app.slug)}
                        >
                            {expandedState === 'loading' ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : isExpanded ? (
                                <ChevronUp className="mr-2 h-4 w-4" />
                            ) : (
                                <ChevronDown className="mr-2 h-4 w-4" />
                            )}
                            {expandedState === 'loading' ? 'Loading Details...' : isExpanded ? 'Hide Comparison' : 'Show Comparison'}
                        </Button>
                        {isArchived ? (
                            <Badge className="bg-green-500 text-white hover:bg-green-600">Archived <CheckCircle className="ml-1 h-3 w-3" /></Badge>
                        ) : (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleMarkDuplicateAndArchive(app.slug)}
                                disabled={isProcessing}
                            >
                                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
                                {isProcessing ? "Archiving..." : "Mark Duplicate & Archive"}
                            </Button>
                        )}
                    </div>
                </CardContent>

                {expandedState === 'loading' && (
                    <CardContent className="p-4 pt-0">
                        <Skeleton className="h-56 w-full mt-2" />
                    </CardContent>
                )}
                {isExpanded && (
                    <FieldComparison apps={expandedState} />
                )}
            </Card>
        );
    };

    const renderContent = () => {
        if (scanState === 'scanning') {
            return (
                <div className="text-center py-12">
                    <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
                    <CardTitle>Scanning Applications...</CardTitle>
                    <CardDescription>Matching applications based on core fields to find duplicates.</CardDescription>
                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                </div>
            );
        }

        if (scanState === 'error') {
            return (
                <div className="text-center py-12 text-red-500">
                    <AlertCircle className="w-10 h-10 mx-auto mb-4" />
                    <CardTitle>Scan Error</CardTitle>
                    <CardDescription>Could not complete the duplicate scan. Check the console for details or try again.</CardDescription>
                    <Button onClick={startScan} className='mt-4'><RefreshCw className="mr-2 h-4 w-4" />Try Again</Button>
                </div>
            );
        }

        if (scanState === 'complete') {
            if (duplicateGroups.length === 0) {
                return (
                    <div className="text-center py-12">
                        <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-4" />
                        <CardTitle>No Duplicates Found</CardTitle>
                        <CardDescription>All {applications.length} eligible applications appear to be unique based on the defined criteria.</CardDescription>
                        <Button onClick={startScan} className='mt-4'><RefreshCw className="mr-2 h-4 w-4" />Re-scan</Button>
                    </div>
                );
            }

            if (currentGroupIndex >= duplicateGroups.length) {
                const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + group.duplicates.length, 0);
                return (
                    <div className="text-center py-12">
                        <CheckCircle className="w-10 h-10 text-primary mx-auto mb-4" />
                        <CardTitle>Review Complete!</CardTitle>
                        <CardDescription>You have reviewed all {duplicateGroups.length} duplicate groups ({totalDuplicates} total duplicates).</CardDescription>
                        <Button onClick={startScan} className='mt-4'><RefreshCw className="mr-2 h-4 w-4" />Start New Scan</Button>
                    </div>
                );
            }


            const currentGroup = duplicateGroups[currentGroupIndex];
            const primaryNormalized = normalizeApplication(currentGroup.primary);
            const totalRemaining = duplicateGroups.length - currentGroupIndex;

            return (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <CardTitle>
                            Reviewing Duplicate Group {currentGroupIndex + 1} of {duplicateGroups.length}
                            <Badge variant="outline" className="ml-2">({totalRemaining} remaining)</Badge>
                        </CardTitle>
                        <div className="flex gap-2">
                            <Button onClick={handleSkip} variant="outline">
                                <SkipForward className="mr-2 h-4 w-4" /> Skip Issue
                            </Button>
                            <Button onClick={startScan} variant="ghost"><RefreshCw className="h-4 w-4" /></Button>
                        </div>
                    </div>

                    <div className="p-4 border rounded-xl shadow-md bg-green-50 dark:bg-green-900/10">
                        <h3 className="font-bold text-lg text-green-700 dark:text-green-300 mb-2">
                            Original Application (Keep Active)
                        </h3>
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold text-base">
                                {currentGroup.primary.title}
                                <Badge variant="default" className="ml-2 text-xs">{currentGroup.primary.slug}</Badge>
                            </h4>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                            <p><strong>Name:</strong> {primaryNormalized.data.fullName} | <strong>Age:</strong> {primaryNormalized.data.ageRange}</p>
                            <p><strong>Municipality:</strong> {primaryNormalized.data.municipality} | <strong>Challenge:</strong> {primaryNormalized.data.challengeStatement || 'N/A'}</p>
                            <p><strong>Description Snippet:</strong> {primaryNormalized.data.descriptionSnippet}</p>
                        </div>
                    </div>

                    <ScrollArea className="h-64 border p-4 rounded-xl">
                        <div className="space-y-4">
                            {currentGroup.duplicates.map(app => renderDuplicateItem(currentGroup.primary.slug, app))}
                        </div>
                    </ScrollArea>
                </div>
            );
        }

        return (
            <div className="text-center py-12">
                <Zap className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
                <CardTitle>Duplicate Finder Ready</CardTitle>
                <CardDescription>Click scan to analyze existing applications in the database.</CardDescription>
                <Button onClick={startScan} className='mt-4'><RefreshCw className="mr-2 h-4 w-4" />Start Scan</Button>
            </div>
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    Find Duplicates
                </CardTitle>
                <CardDescription>Scan database applications for redundant entries and archive them.</CardDescription>
            </CardHeader>
            <CardContent>
                {renderContent()}
            </CardContent>
        </Card>
    );
}