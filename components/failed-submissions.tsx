"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, Download, XCircle, CheckCircle, Clock } from "lucide-react"
import { getFailedSubmissions, getFailedCsvContent, markAsResolved } from "@/actions/history"
import { toast } from "@/components/ui/use-toast"

interface FailedSubmissionRecord {
  id: string;
  batch_id: string;
  application_id: string;
  title: string;
  error_message: string;
  is_resolved: boolean;
  created_at: string;
}

export function FailedSubmissions() {
  const [failedApplications, setFailedApplications] = useState<FailedSubmissionRecord[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchFailedSubmissions()
  }, [])

  const fetchFailedSubmissions = async () => {
    try {
      setIsLoading(true)
      const data = await getFailedSubmissions();
      setFailedApplications(data as FailedSubmissionRecord[])
    } catch (error) {
      console.error("Error fetching failed submissions:", error)
      toast({
        title: "Error",
        description: "Failed to fetch failed submissions history.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = failedApplications.map(app => app.id)
      setSelectedIds(allIds)
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id])
    } else {
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id))
    }
  }

  const handleMarkResolved = async () => {
    if (selectedIds.length === 0) return
    try {
      await markAsResolved(selectedIds);
      toast({
        title: "Success",
        description: `${selectedIds.length} submissions marked as resolved.`,
      });
      setSelectedIds([]);
      fetchFailedSubmissions();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to mark submissions as resolved.",
        variant: "destructive",
      })
    }
  }

  const handleDownloadCsv = async () => {
    if (selectedIds.length === 0) return;

    try {
      const csvString = await getFailedCsvContent(selectedIds);
      const blob = new Blob([csvString], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `failed_submissions_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate CSV for download.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const unresolvedCount = failedApplications.filter(app => !app.is_resolved).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            Failed Submissions
          </CardTitle>
          <CardDescription>
            View and manage applications that failed to submit ({unresolvedCount} unresolved)
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleDownloadCsv} 
            disabled={selectedIds.length === 0} 
            variant="outline"
          >
            <Download className="w-4 h-4 mr-2" />
            Download ({selectedIds.length})
          </Button>
          <Button 
            onClick={handleMarkResolved} 
            disabled={selectedIds.length === 0}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Mark as Resolved ({selectedIds.length})
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Loading failed submissions...</p>
          </div>
        ) : failedApplications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No failed submissions found</p>
          </div>
        ) : (
          <ScrollArea className="h-[70vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedIds.length === failedApplications.length}
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    />
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Error Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Batch ID</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failedApplications.map(app => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(app.id)}
                        onCheckedChange={(checked) => handleSelectOne(app.id, !!checked)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{app.title}</TableCell>
                    <TableCell className="text-red-500 max-w-[300px] truncate">{app.error_message}</TableCell>
                    <TableCell>
                      <Badge variant={app.is_resolved ? 'default' : 'destructive'}>
                        {app.is_resolved ? 'Resolved' : 'Unresolved'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate">{app.batch_id}</TableCell>
                    <TableCell className="text-xs">{formatDate(app.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}