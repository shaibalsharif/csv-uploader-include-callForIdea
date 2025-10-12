// csv-uploader-include-callForIdea/components/DuplicateComparisonModal.tsx

import { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Zap } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getApplicationDetailsFromDB, AppRawData } from '@/actions/analysis'; // NEW IMPORT

// Adjusted ApplicationData to match AppRawData structure, using raw_fields directly
interface ApplicationData extends AppRawData {
    // raw_fields is stored as raw_fields, containing all the detail data
}

interface DuplicateComparisonModalProps {
    isOpen: boolean;
    onClose: () => void;
    // [primarySlug, duplicateSlug]
    slugs: [string, string] | null; 
    config: { apiKey: string }; // Config is kept but no longer used for fetching
}

// Helper to format the display value for raw fields
const formatRawFieldValue = (field: any) => {
    if (!field || field.value === null || field.value === undefined) return "N/A";
    let value = field.value;
    // Note: The raw_fields structure in the DB uses the same keys as the API response.
    if (typeof value === "object" && value !== null) {
        return field.translated?.en_GB || value.en_GB || value.en || JSON.stringify(value);
    }
    return String(value);
};

export function DuplicateComparisonModal({ isOpen, onClose, slugs }: DuplicateComparisonModalProps) {
    const [apps, setApps] = useState<{ primary: ApplicationData | null, duplicate: ApplicationData | null }>({ primary: null, duplicate: null });
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    
    // Flag to track if data has been fetched for the current slugs
    const fetchedSlugsRef = useRef<string | null>(null);

    const fetchDetails = useCallback(async (primarySlug: string, duplicateSlug: string) => {
        const currentSlugsKey = `${primarySlug}-${duplicateSlug}`;
        
        // Prevent re-fetching if the component re-renders due to parent state change
        if (fetchedSlugsRef.current === currentSlugsKey) {
            return;
        }

        setIsLoading(true);
        setApps({ primary: null, duplicate: null });

        try {
            // UPDATED: Fetching data from local database action
            const [primaryDetails, duplicateDetails] = await Promise.all([
                getApplicationDetailsFromDB(primarySlug),
                getApplicationDetailsFromDB(duplicateSlug),
            ]);
            
            setApps({
                primary: primaryDetails as ApplicationData,
                duplicate: duplicateDetails as ApplicationData,
            });
            
            fetchedSlugsRef.current = currentSlugsKey;

            toast({ title: "Details Loaded", description: "Fetched application data from local database." });
        } catch (error) {
            console.error("Error fetching comparison data from DB:", error);
            toast({ 
                title: "Fetch Failed", 
                description: "Could not fetch one or both application details from the local database.", 
                variant: "destructive" 
            });
            onClose();
        } finally {
            setIsLoading(false);
        }
    }, [onClose, toast]);

    useEffect(() => {
        if (isOpen && slugs) {
            // Reset ref when the modal opens with new slugs
            fetchedSlugsRef.current = null; 
            fetchDetails(slugs[0], slugs[1]);
        }
    }, [isOpen, slugs, fetchDetails]);
    
    // Renders one column of the comparison table
    const renderApplicationDetails = (app: ApplicationData | null, title: string) => {
        if (isLoading) return <Skeleton className="h-[60vh] w-full" />;
        if (!app) return <p className="text-center text-muted-foreground">Application data unavailable (check DB sync/eligibility).</p>;

        // The raw_fields in the DB is an array of objects
        const fields = (app.raw_fields as any[]) || [];

        return (
            <CardContent className="h-full space-y-4">
                <h3 className="font-bold text-lg text-center">{title}</h3>
                <ScrollArea className="h-[50vh] border p-2 rounded-md">
                    <dl className="space-y-1">
                        <div className="py-1 border-b"><dt className="font-semibold">Title</dt><dd className="break-words">{app.title}</dd></div>
                        <div className="py-1 border-b"><dt className="font-semibold">Slug</dt><dd className="font-mono text-xs break-words">{app.slug}</dd></div>
                        <div className="py-1 border-b"><dt className="font-semibold">Status</dt><dd>{app.status}</dd></div>
                        <div className="py-1 border-b"><dt className="font-semibold">Applicant</dt><dd>{app.applicant_name || 'N/A'}</dd></div>
                        <div className="py-1 border-b"><dt className="font-semibold">Email</dt><dd className="text-xs break-words">{app.applicant_email || 'N/A'}</dd></div>
                        
                        <h4 className="font-bold pt-4 pb-2 border-t mt-4">Form Fields</h4>
                        {fields.map((field, index) => (
                            <div key={field.slug || index} className="py-1 border-b">
                                <dt className="text-sm font-medium text-muted-foreground">{field.label?.en_GB?.replace('*', '') || field.slug}</dt>
                                <dd className="text-sm break-words">{formatRawFieldValue(field)}</dd>
                            </div>
                        ))}
                    </dl>
                </ScrollArea>
            </CardContent>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-6">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5" /> Local Application Data Comparison
                    </DialogTitle>
                    <DialogDescription>
                        Data retrieved from the local <strong>goodgrants_applications</strong> table. Compare the original with the duplicate to confirm archiving.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden">
                    <Card className="flex flex-col h-full overflow-hidden">
                        <CardHeader><CardTitle className="text-primary">{apps.primary?.title || 'Original Application'}</CardTitle></CardHeader>
                        {renderApplicationDetails(apps.primary, "Original")}
                    </Card>
                    <Card className="flex flex-col h-full overflow-hidden">
                        <CardHeader><CardTitle className="text-destructive">{apps.duplicate?.title || 'Duplicate Application'}</CardTitle></CardHeader>
                        {renderApplicationDetails(apps.duplicate, "Duplicate")}
                    </Card>
                </div>
                
                <DialogFooter>
                    <DialogClose asChild>
                         <Button onClick={onClose} disabled={isLoading}>
                            Back to Duplicate List
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}