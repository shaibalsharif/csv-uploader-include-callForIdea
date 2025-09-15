"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { FileText, Tag, Loader2, Download } from "lucide-react"
import { getBatchDetails } from "@/actions/history"
import { Button } from "@/components/ui/button"

interface ApplicationDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  batchId: string | null
}

interface ApplicationData {
  id: string;
  application_id: string;
  title: string;
  status: "pending" | "processing" | "completed" | "error" | "skipped";
  data: Record<string, any>;
  error_message: string | null;
}

interface BatchDetails {
  id: string;
  created_at: string;
  file_name: string;
  total_applications: number;
  completed_applications: number;
  error_applications: number;
  skipped_applications: number;
  processing_mode: string;
  logs: string[];
  applications: ApplicationData[];
}

export function ApplicationDetailsModal({ isOpen, onClose, batchId }: ApplicationDetailsModalProps) {
  const [batchDetails, setBatchDetails] = useState<BatchDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isOpen && batchId) {
      fetchBatchDetails(batchId)
    }
  }, [isOpen, batchId])

  const fetchBatchDetails = async (id: string) => {
    try {
      setIsLoading(true)
      const data = await getBatchDetails(id)
      setBatchDetails(data as BatchDetails)
    } catch (error) {
      console.error("Failed to fetch batch details:", error)
      setBatchDetails(null)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "default"
      case "error":
        return "destructive"
      case "skipped":
        return "outline"
      default:
        return "secondary"
    }
  }

  const handleDownloadCsv = () => {
    if (batchId) {
      window.open(`/api/batch-details/${batchId}/original`, '_blank');
    }
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle>Batch Details</DialogTitle>
          {batchDetails && (
            <div className="text-sm text-muted-foreground mt-1">
              <p>File: {batchDetails.file_name}</p>
              <p>Processed At: {formatDate(batchDetails.created_at)}</p>
            </div>
          )}
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : !batchDetails ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>Failed to load batch details.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold ">Applications ({batchDetails.applications.length})</h3>
                <Button variant="outline" size="sm" onClick={handleDownloadCsv}>
                    <Download className="w-4 h-4 mr-2" />
                    Download Original CSV
                </Button>
              </div>
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
                  {batchDetails.applications.map((app) => (
                    <div key={app.id} className="border p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          <h4 className="font-medium">{app.title}</h4>
                        </div>
                        <Badge variant={getStatusColor(app.status)}>{app.status}</Badge>
                      </div>
                      <div className="grid grid-cols-2 text-sm text-muted-foreground gap-2">
                        <div className="truncate">
                          Name:{" "}
                          <span className="text-foreground">
                            {app.data["Full Name - [lOoZYQWa]"] || "N/A"}
                          </span>
                        </div>
                        <div className="truncate">
                          Gender:{" "}
                          <span className="text-foreground">
                            {app.data["Gender - [rojNQzOz]"]?.split(" - [")[0] || "N/A"}
                          </span>
                        </div>
                        <div className="truncate">
                          Municipality:{" "}
                          <span className="text-foreground">
                            {app.data["Municipality - [rDkKljjz]"]?.split(" - [")[0] || "N/A"}
                          </span>
                        </div>
                        <div className="truncate">
                          Category:{" "}
                          <span className="text-foreground">
                            {app.data["Digital/Non-Digital Idea - [Category]"]?.split(" - [")[0] || "N/A"}
                          </span>
                        </div>
                        <div className="truncate">
                          Slug:{" "}
                          <span className="text-foreground">
                            {app.application_id || "N/A"}
                          </span>
                        </div>
                      </div>
                      {app.error_message && (
                        <div className="mt-2 text-xs text-red-500">
                          Error: {app.error_message}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
            
            <div className="flex flex-col">
              <h3 className="text-lg font-semibold mb-3">Processing Logs</h3>
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-2 font-mono text-xs">
                  {batchDetails.logs.map((log, index) => (
                    <div key={index} className="text-muted-foreground">
                      {log}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}