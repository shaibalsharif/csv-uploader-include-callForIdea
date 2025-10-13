// csv-uploader-include-callForIdea/components/ApplicationDetailsInquiryModal.tsx

"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Loader2, FileText, AlertCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { getApplicationDetailsLocal } from "@/actions/leaderboard"
import { Separator } from "./ui/separator"

interface ApplicationData {
    slug: string;
    title: string;
    raw_fields: any;
    applicant_name: string;
    applicant_email: string;
    status: string;
    local_status: string;
    [key: string]: any;
}

interface ApplicationDetailsInquiryModalProps {
    isOpen: boolean
    onClose: () => void
    applicationSlug: string | null
}

const formatRawFieldValue = (field: any) => {
    if (!field || field.value === null || field.value === undefined) return "N/A";
    let value = field.value;
    if (typeof value === "object" && value !== null) {
        return field.translated?.en_GB || value.en_GB || value.en || JSON.stringify(value);
    }
    return String(value);
};

export function ApplicationDetailsInquiryModal({ isOpen, onClose, applicationSlug }: ApplicationDetailsInquiryModalProps) {
    const [application, setApplication] = useState<ApplicationData | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const { toast } = useToast()



    const fetchDetails = useCallback(async (slug: string) => {
        setIsLoading(true)
        setApplication(null)
        try {
            const appDetails = await getApplicationDetailsLocal(slug) as ApplicationData | null;
           

            setApplication(appDetails)
        } catch (err) {
            toast({ title: "Error", description: "Failed to fetch application details from local DB.", variant: "destructive" })
            onClose()
        } finally {
            setIsLoading(false)
        }
    }, [onClose, toast])

    useEffect(() => {
        if (isOpen && applicationSlug) {
            fetchDetails(applicationSlug)
        }
    }, [isOpen, applicationSlug, fetchDetails])

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            onClose()
        }
    }

    const fields = (application?.raw_fields as any[]) || [];

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" /> Application Details
                    </DialogTitle>
                    <DialogDescription>
                        Reviewing local data for: <strong>{isLoading ? "..." : application?.title}</strong>
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Loading Details...
                    </div>
                ) : !application ? (
                    <div className="text-center py-12 text-red-500">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                        <p>Application data not found in local database or not eligible.</p>
                    </div>
                ) : (
                    <>
                        <ScrollArea className="flex-1 pr-6 overflow-auto">
                            <CardContent className="px-0 space-y-4">
                                <div>
                                    <h4 className="font-semibold text-base">Metadata</h4>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm pt-2">
                                        <div className="text-muted-foreground">Applicant: <span className="text-foreground font-medium">{application.applicant_name}</span></div>
                                        <div className="text-muted-foreground">Email: <span className="text-foreground text-xs break-words">{application.applicant_email}</span></div>
                                        <div className="text-muted-foreground">Status (GoodGrants): <span className="text-foreground">{application.status}</span></div>
                                        <div className="text-muted-foreground">Status (Local): <span className={`font-semibold ${application.local_status === 'archived' ? 'text-destructive' : 'text-green-500'}`}>{application.local_status}</span></div>
                                    </div>
                                </div>
                                <Separator />
                                <div>
                                    <h4 className="font-semibold text-base mb-2">Application Fields</h4>
                                    <dl>
                                        {fields.map((field, index) => {
                                            const label = field.label?.en_GB
                                            if (label) {
                                                return (
                                                    <div key={field.slug || index} className="grid grid-cols-1 md:grid-cols-3 gap-4 py-3 border-b">
                                                        <dt className="text-sm font-medium text-muted-foreground md:col-span-1">{label.replace("*", "")}</dt>
                                                        <dd className="text-sm text-foreground md:col-span-2 break-words">{formatRawFieldValue(field)}</dd>
                                                    </div>
                                                )
                                            }
                                            return null
                                        })}
                                    </dl>
                                </div>
                            </CardContent>
                        </ScrollArea>
                        <DialogFooter>
                            <Button onClick={onClose}>Close</Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}