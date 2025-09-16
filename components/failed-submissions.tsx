"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, Download, XCircle, CheckCircle, Clock, ChevronUp, ChevronDown } from "lucide-react"
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
const csvHeaderToApiSlugMapping: { [key: string]: string | null } = {
  "Name of the idea - [title]": "title",
  "Digital/Non-Digital Idea - [Category]": "category_slug",
  "Full Name - [lOoZYQWa]": "lOoZYQWa",
  "Applicant Category - [JvKDGVwE]": "JvKDGVwE",
  "Academic Type - [XaeOykJy]": "XaeOykJy",
  "Specify Institute Type - [QeYYdGmk]": "QeYYdGmk",
  "Institution / Organization Name - [vQzDWbRR]": "vQzDWbRR",
  "Select age range - [xjzONPwj]": "xjzONPwj",
  "Gender - [rojNQzOz]": "rojNQzOz",
  "Your municipality of residence (optional) - [lWNmRmMJ]": "lWNmRmMJ",
  "Name of the Municipality (optional) - [eZoqyOKw]": "eZoqyOKw",
  "Ward no. (optional) - [DolgLaOe]": "DolgLaOe",
  "Phone no. - [OLVQXPpn]": "OLVQXPpn",
  "Municipality - [rDkKljjz]": "rDkKljjz",
  "Challange statement* - [RjAnzBZJ]": "RjAnzBZJ",
  "Description of The Idea - [GqVZgKbW]": "GqVZgKbW",
  "Implementation Roadmap - [kZwoWjrv]": "kZwoWjrv",
  "Do you want to Implement it yourself? - [GgJbpwlm]": "GgJbpwlm",
};
const getErrorTitles = (errorMessage: string) => {
  try {
    const match = errorMessage.match(/\{.*\}/s); // extract JSON object from string
    if (!match) return [];

    const errorJson = JSON.parse(match[0]);
    const errors = errorJson.errors || {};

    const fieldSlugs = Object.keys(errors).map(key => {
      // if key starts with "application_fields." then strip it
      if (key.startsWith("application_fields.")) return key.replace("application_fields.", "");
      return key;
    });

    // map slug to human-readable titles
    const fieldTitles = fieldSlugs.map(slug => {
      const mappingEntry = Object.entries(csvHeaderToApiSlugMapping).find(([title, mappedSlug]) => mappedSlug === slug);
      return mappingEntry ? mappingEntry[0] : slug;
    });

    return fieldTitles;
  } catch (err) {
    console.error("Failed to parse error message", err);
    return [];
  }
};

export function FailedSubmissions() {
  const [failedApplications, setFailedApplications] = useState<FailedSubmissionRecord[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortAsc, setSortAsc] = useState<boolean>(false)
  const [showResolved, setShowResolved] = useState<boolean>(true)
  const [showUnresolved, setShowUnresolved] = useState<boolean>(true)

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

  // Sorting handler
  const toggleSort = () => setSortAsc(!sortAsc)

  const sortedApplications = [...failedApplications]
    .filter(app => (showResolved && app.is_resolved) || (showUnresolved && !app.is_resolved))
    .sort((a, b) => {
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
      return sortAsc ? dateA - dateB : dateB - dateA
    })

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allUnresolvedIds = sortedApplications
        .filter(app => !app.is_resolved)
        .map(app => app.id)
      setSelectedIds(allUnresolvedIds)
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
      <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            Failed Submissions
          </CardTitle>
          <CardDescription>
            View and manage applications that failed to submit ({unresolvedCount} unresolved)
          </CardDescription>
        </div>

        <div className="flex gap-4 flex-wrap items-center">
          <div className="flex gap-2">
            <Checkbox checked={showUnresolved} onCheckedChange={(checked) => setShowUnresolved(!!checked)} />
            <span>Unresolved</span>
            <Checkbox checked={showResolved} onCheckedChange={(checked) => setShowResolved(!!checked)} />
            <span>Resolved</span>
          </div>

          <Button onClick={toggleSort} variant="outline">
            <Clock className="w-4 h-4 mr-2" />
            Sort by Date {sortAsc ? <ChevronUp className="inline w-4 h-4" /> : <ChevronDown className="inline w-4 h-4" />}
          </Button>

          <Button onClick={handleDownloadCsv} disabled={selectedIds.length === 0} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Download ({selectedIds.length})
          </Button>

        </div>
      </CardHeader>
      <CardHeader>
        <div className="w-full">
          <Button
            className="px-6 w-fit"
            onClick={handleMarkResolved}
            disabled={selectedIds.length === 0}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Mark as Resolved ({selectedIds.length}/{sortedApplications.filter(app => !app.is_resolved).length})
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Loading failed submissions...</p>
          </div>
        ) : sortedApplications.length === 0 ? (
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
                      checked={
                        selectedIds.length ===
                        sortedApplications.filter(app => !app.is_resolved).length
                      }
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    />
                  </TableHead>
                  <TableHead>#</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Error Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Batch ID</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedApplications.map((app, index) => {
                  const isDisabled = app.is_resolved;
                  return (
                    <TableRow
                      key={app.id}
                      className={isDisabled ? "opacity-50 cursor-not-allowed" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(app.id)}
                          disabled={isDisabled}
                          onCheckedChange={(checked) => handleSelectOne(app.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{app.title}</TableCell>
                      <TableCell className="text-red-500 max-w-[300px] truncate text-wrap">
                        {getErrorTitles(app.error_message).join(", ") || app.error_message}
                      </TableCell>
                      <TableCell>
                        <Badge variant={isDisabled ? "default" : "destructive"}>
                          {app.is_resolved ? "Resolved" : "Unresolved"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate">
                        {app.batch_id}
                      </TableCell>
                      <TableCell className="text-xs">{formatDate(app.created_at)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
