"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Calendar, FileText } from "lucide-react"
import { ApplicationDetailsModal } from "./application-details-modal"
import { getBatches } from "@/actions/history";

interface BatchRecord {
  id: string
  file_name: string
  created_at: string
  total_applications: number
  completed_applications: number
  error_applications: number
  skipped_applications: number
  processing_mode: "handsfree" | "interruption"
  status: "completed" | "partial" | "failed"
}

export function BatchHistory() {
  const [batches, setBatches] = useState<BatchRecord[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchBatches()
  }, [])

  const fetchBatches = async () => {
    try {
      setIsLoading(true)
      const data = await getBatches();
      const transformedBatches: BatchRecord[] = data.map((batch: any) => ({
        ...batch,
        status:
          batch.error_applications > 0
            ? "partial"
            : batch.completed_applications === batch.total_applications
              ? "completed"
              : "failed",
      }))
      setBatches(transformedBatches)
    } catch (error) {
      console.error("Error fetching batches:", error)
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
      case "partial":
        return "secondary"
      case "failed":
        return "destructive"
      default:
        return "outline"
    }
  }

  const handleViewDetails = (batchId: string) => {
    setSelectedBatchId(batchId)
    setIsDetailsModalOpen(true)
  }

  return (
    <div className="space-y-6 ">
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Batch Processing History
          </CardTitle>
          <CardDescription>View previous CSV upload and processing sessions</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Loading batch history...</p>
            </div>
          ) : batches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No batch history found</p>
              <p className="text-sm">Process your first CSV file to see history here</p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="space-y-4">
                {batches.map((batch) => (
                  <Card key={batch.id} className="border-border">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold mb-1">{batch.file_name}</h3>
                          <p className="text-sm text-muted-foreground">{formatDate(batch.created_at)}</p>
                        </div>
                        <Badge variant={getStatusColor(batch.status)}>{batch.status}</Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold">{batch.total_applications}</div>
                          <div className="text-xs text-muted-foreground">Total</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">{batch.completed_applications}</div>
                          <div className="text-xs text-muted-foreground">Completed</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-600">{batch.error_applications}</div>
                          <div className="text-xs text-muted-foreground">Errors</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-yellow-600">{batch.skipped_applications}</div>
                          <div className="text-xs text-muted-foreground">Skipped</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Mode: {batch.processing_mode}</span>
                          <span>•</span>
                          <span>
                            Success Rate: {Math.round((batch.completed_applications / batch.total_applications) * 100)}%
                          </span>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => handleViewDetails(batch.id)}>
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <ApplicationDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        batchId={selectedBatchId}
      />
    </div>
  )
}