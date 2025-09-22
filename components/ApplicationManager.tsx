"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  MoreHorizontal,
  Eye,
  Archive,
  Trash2,
  ArchiveRestore,
  Undo,
  ChevronLeft,
  ChevronRight,
  X,
  Filter,
  CircleX,
  FileDown,
} from "lucide-react"
import {
  getApplications,
  getApplicationDetails,
  archiveApplication,
  unarchiveApplication,
  deleteApplication,
  restoreApplication,
  type FetchParams,
} from "@/actions/application"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { jsPDF } from "jspdf"
import "jspdf-autotable"
import * as XLSX from "xlsx"
import JSZip from "jszip"

// Predefined tags from the API error message
const AVAILABLE_TAGS = [
  "Chapai Nawabganj",
  "Gaibandha",
  "Charghat",
  "Sirajganj",
  "Eligible",
  "Yes",
  "digital",
  "Siraj-PS-1",
  "18 - 25 years",
  "Male",
  "Char-PS-1",
  "46 - 55 years",
  "Female",
  "non-digital",
  "26 - 35 years",
  "Chapai-PS-1",
  "36 - 45 years",
  "Gaib-PS-2",
  "Below 18",
  "Siraj-PS-3",
  "Chapai-PS-3",
  "Char-PS-3",
  "Gaib-PS-1",
  "Gaib-PS-3",
  "Chapai-PS-2",
  "Siraj-PS-2",
  "56 - 65 years",
  "Char-PS-2",
  "to be archived",
  "Citizens",
  "Protect Public Health During Extreme Heatwaves",
  "NGO_iNGO",
  "below-18",
  "26-35-years",
  "46-55-years",
]

// --- Custom Hook for Debouncing ---
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])
  return debouncedValue
}

export const MultiSelectTags = ({
  selectedTags,
  onTagsChange,
}: {
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
}) => {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredTags = AVAILABLE_TAGS.filter(
    (tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()) && !selectedTags.includes(tag),
  )

  const addTag = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      onTagsChange([...selectedTags, tag])
    }
    setSearchTerm("")
  }

  const removeTag = (tagToRemove: string) => {
    onTagsChange(selectedTags.filter((tag) => tag !== tagToRemove))
  }

  return (
    <div className="space-y-2">
      <Label>Tags</Label>

      <Popover>
        <PopoverTrigger asChild>
          <div className="min-h-[40px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm cursor-text">
            {/* Selected tags */}
            <div className="flex flex-wrap gap-1 mb-1">
              {selectedTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                  {tag}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeTag(tag)
                    }}
                    className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>

            {/* Input for searching */}
            <Input
              type="text"
              value={searchTerm}
              placeholder={selectedTags.length === 0 ? "Search and select tags..." : "Add more tags..."}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-6 border-none p-0 shadow-none focus-visible:ring-0"
            />
          </div>
        </PopoverTrigger>

        <PopoverContent className="w-full max-h-60 overflow-auto p-1">
          {filteredTags.length > 0 ? (
            filteredTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => addTag(tag)}
                className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm"
              >
                {tag}
              </button>
            ))
          ) : (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              {searchTerm ? "No matching tags found" : "No more tags available"}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

// --- Type Definitions ---
interface Application {
  slug: string
  title: string
  status: string
  created: string
  updated: string
  tags: string
  applicant: {
    name: string
    email: string
  }
  application_fields?: any[]
  [key: string]: any
}

interface ApplicationManagerProps {
  config: {
    apiKey: string
  }
}

// --- Child Components ---
const SkeletonRow = () => (
  <TableRow>
    <TableCell className="w-10">
      <Skeleton className="h-5 w-5" />
    </TableCell>
    <TableCell>
      <Skeleton className="h-5 w-48" />
      <div className="flex gap-1 mt-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
    </TableCell>
    <TableCell>
      <Skeleton className="h-5 w-32" />
    </TableCell>
    <TableCell>
      <Skeleton className="h-5 w-24" />
    </TableCell>
    <TableCell>
      <Skeleton className="h-5 w-20" />
    </TableCell>
    <TableCell className="text-right">
      <Skeleton className="h-8 w-8 ml-auto rounded-full" />
    </TableCell>
  </TableRow>
)

const ApplicationDetailsView = ({ application }: { application: Application | null }) => {
  if (!application) return <div className="text-center py-8">Loading details...</div>

  const formatDisplayValue = (value: any): string => {
    if (value === null || value === undefined) return "N/A"
    if (typeof value !== "object") return String(value)
    if (Array.isArray(value)) return value.map((item) => item?.en || JSON.stringify(item)).join(", ")
    if (value.hasOwnProperty("en")) return String(value.en)
    return JSON.stringify(value)
  }

  const renderField = (label: string, value: any) => {
    const displayValue = formatDisplayValue(value)
    if (displayValue === "N/A" || displayValue.trim() === "") return null

    return (
      <div key={label} className="grid grid-cols-1 md:grid-cols-3 gap-4 py-3 border-b">
        <dt className="text-sm font-medium text-muted-foreground md:col-span-1">{label.replace("*", "")}</dt>
        <dd className="text-sm text-foreground md:col-span-2">{displayValue}</dd>
      </div>
    )
  }

  const applicationFields = application.application_fields || []

  return (
    <dl>
      {renderField("Title", application.title)}
      {renderField("Applicant Name", application.applicant?.name)}
      {renderField("Applicant Email", application.applicant?.email)}
      {Array.isArray(applicationFields) &&
        applicationFields.map((field) => {
          const label = field.label?.en_GB
          const value = field.value
          if (label && (value || value === false || value === 0)) {
            return renderField(label, value)
          }
          return null
        })}
    </dl>
  )
}

function ApplicationDetailsModal({
  isOpen,
  onClose,
  applicationSlug,
  onDetailFetched,
}: {
  isOpen: boolean
  onClose: () => void
  applicationSlug: string | null
  onDetailFetched: (app: Application) => void
  config: ApplicationManagerProps["config"]
}) {
  const [application, setApplication] = useState<Application | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const config = (window as any).appConfig // Assuming config is globally available or passed via props

  useEffect(() => {
    if (isOpen && applicationSlug) {
      const fetchDetails = async () => {
        setIsLoading(true)
        try {
          const appDetails = await getApplicationDetails(config, applicationSlug)
          setApplication(appDetails)
          onDetailFetched(appDetails) // Pass data back to parent
        } catch (err) {
          toast({ title: "Error", description: "Failed to fetch application details.", variant: "destructive" })
          onClose()
        } finally {
          setIsLoading(false)
        }
      }
      fetchDetails()
    }
  }, [isOpen, applicationSlug, config, onClose, toast, onDetailFetched])

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Application Details</DialogTitle>
          <DialogDescription>
            Reviewing details for: <strong>{isLoading ? "..." : application?.title}</strong>
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-6">
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <ApplicationDetailsView application={application} />
          )}
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" onClick={onClose}>
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Main Component ---
export function ApplicationManager({ config }: ApplicationManagerProps) {
  if (typeof window !== "undefined") {
    ;(window as any).appConfig = config
  }

  const [applications, setApplications] = useState<Application[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([])
  const [isExporting, setIsExporting] = useState(false)
  const { toast } = useToast()
  const detailCache = useRef(new Map<string, Application>())

  const initialFilters = { title: "", tags: [] as string[], status: "", date_after: "", date_before: "" }
  const [filters, setFilters] = useState(initialFilters)
  const debouncedFilters = useDebounce(filters, 500)

  const [params, setParams] = useState<FetchParams>({
    page: 1,
    per_page: 20,
    order: "updated",
    dir: "desc",
    archived: "none",
    deleted: "none",
  })

  const isMounted = useRef(false)
  useEffect(() => {
    if (isMounted.current) {
      setParams((p) => ({ ...p, page: 1 }))
    } else {
      isMounted.current = true
    }
  }, [debouncedFilters, params.archived, params.deleted])

  const [pagination, setPagination] = useState({ currentPage: 1, lastPage: 1, total: 0 })
  const fetchApplications = useCallback(async () => {
    if (!config.apiKey) return
    setIsLoading(true)
    setError(null)
    try {
      const apiFilters = {
        ...debouncedFilters,
        tags: debouncedFilters.tags, // ✅ FIX: keep as array
      }
      const response = await getApplications(config, params, apiFilters)
      setApplications(response.data)
      setPagination({ currentPage: response.current_page, lastPage: response.last_page, total: response.total })
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.")
      toast({ title: "Error", description: "Failed to fetch applications.", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [params, debouncedFilters, config, toast])

  useEffect(() => {
    fetchApplications()
    setSelectedSlugs([])
  }, [fetchApplications])

  const handleAction = async (slug: string, action: "archive" | "delete" | "unarchive" | "undelete") => {
    const actionMap = {
      archive: archiveApplication,
      unarchive: unarchiveApplication,
      delete: deleteApplication,
      undelete: restoreApplication,
    }
    try {
      await actionMap[action](config, slug)
      toast({ title: "Success", description: `Application successfully ${action}d.` })
      fetchApplications()
    } catch (err: any) {
      toast({
        title: "Action Failed",
        description: `Could not complete the action. Please try again.`,
        variant: "destructive",
      })
    }
  }

  const getAndCacheApplicationDetails = useCallback(
    async (slug: string): Promise<Application> => {
      if (detailCache.current.has(slug)) {
        return detailCache.current.get(slug)!
      }
      const details = await getApplicationDetails(config, slug)
      detailCache.current.set(slug, details)
      return details
    },
    [config],
  )

  const handleExport = async (format: "csv" | "xlsx" | "pdf", slugsToExport: string[]) => {
    if (slugsToExport.length === 0) return
    setIsExporting(true)
    try {
      const fullApps = await Promise.all(slugsToExport.map((slug) => getAndCacheApplicationDetails(slug)))

      if (format === "csv" || format === "xlsx") {
        const dataToExport = fullApps.map((app) => {
          const row: Record<string, any> = {
            Title: app.title,
            Applicant: app.applicant.name,
            Email: app.applicant.email,
            Status: app.status,
            Tags: app.tags,
            Updated: new Date(app.updated).toLocaleString(),
          }
          app.application_fields?.forEach((field) => {
            const label = field.label?.en_GB?.replace("*", "") || field.slug
            let value = field.value
            if (typeof value === "object" && value !== null) {
              value = value.en || JSON.stringify(value)
            }
            row[label] = value
          })
          return row
        })
        const worksheet = XLSX.utils.json_to_sheet(dataToExport)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Applications")
        XLSX.writeFile(workbook, `applications.${format}`)
      } else if (format === "pdf") {
        if (fullApps.length === 1) {
          const doc = generatePdf(fullApps[0])
          doc.save(`${fullApps[0].slug}.pdf`)
        } else {
          const zip = new JSZip()
          for (const app of fullApps) {
            const doc = generatePdf(app)
            zip.file(`${app.slug}.pdf`, doc.output("blob"))
          }
          const zipBlob = await zip.generateAsync({ type: "blob" })
          const link = document.createElement("a")
          link.href = URL.createObjectURL(zipBlob)
          link.download = "applications.zip"
          link.click()
        }
      }
      toast({ title: "Export successful!" })
    } catch (err: any) {
      toast({
        title: "Export Failed",
        description: err.message || "Could not generate export file.",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const generatePdf = (app: Application): jsPDF => {
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text(app.title, 14, 22)
    doc.setFontSize(11)
    doc.text(`Applicant: ${app.applicant.name} (${app.applicant.email})`, 14, 30)

    const body =
      app.application_fields?.map((field) => {
        const label = field.label?.en_GB?.replace("*", "") || field.slug
        let value = field.value
        if (typeof value === "object" && value !== null) {
          value = value.en || JSON.stringify(value)
        }
        return [label, value]
      }) || []
    ;(doc as any).autoTable({
      startY: 40,
      head: [["Field", "Value"]],
      body: body,
      theme: "striped",
      headStyles: { fillColor: [22, 160, 133] },
    })

    return doc
  }

  const handleSort = (column: string) => {
    const isAsc = params.order === column && params.dir === "asc"
    setParams((prev) => ({ ...prev, page: 1, order: column, dir: isAsc ? "desc" : "asc" }))
  }

  const renderSortArrow = (column: string) => (params.order === column ? (params.dir === "asc" ? "▲" : "▼") : null)

  const changePage = (newPage: number) => {
    if (newPage > 0 && newPage <= pagination.lastPage) {
      setParams((prev) => ({ ...prev, page: newPage }))
    }
  }

  const handleFilterChange = (field: keyof typeof filters, value: string | string[]) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  const clearFilters = () => {
    setFilters(initialFilters)
  }

  const handleSelectAll = (checked: boolean) => {
    setSelectedSlugs(checked ? applications.map((app) => app.slug) : [])
  }

  const handleSelectRow = (slug: string, checked: boolean) => {
    setSelectedSlugs((prev) => (checked ? [...prev, slug] : prev.filter((s) => s !== slug)))
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Application Management</CardTitle>
          <CardDescription>Browse, preview, filter, and export applications.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              {selectedSlugs.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button disabled={isExporting}>
                      <FileDown className="mr-2 h-4 w-4" /> Export {selectedSlugs.length} Selected
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleExport("csv", selectedSlugs)}>As CSV</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport("xlsx", selectedSlugs)}>As XLSX</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport("pdf", selectedSlugs)}>
                      As PDF (.zip)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <Button
                    variant={params.archived === "none" && params.deleted === "none" ? "default" : "outline"}
                    onClick={() => setParams((p) => ({ ...p, archived: "none", deleted: "none" }))}
                  >
                    Active
                  </Button>
                  <Button
                    variant={params.archived === "only" ? "default" : "outline"}
                    onClick={() => setParams((p) => ({ ...p, archived: "only", deleted: "none" }))}
                  >
                    Archived
                  </Button>
                  <Button
                    variant={params.deleted === "only" ? "default" : "outline"}
                    onClick={() => setParams((p) => ({ ...p, archived: "none", deleted: "only" }))}
                  >
                    Deleted
                  </Button>
                </>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
                <Filter className="mr-2 h-4 w-4" />
                {showFilters ? "Hide" : "Show"} Filters
              </Button>
              <select
                value={params.per_page}
                onChange={(e) => setParams((p) => ({ ...p, per_page: Number(e.target.value), page: 1 }))}
                className="p-1 border rounded bg-background"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {showFilters && (
            <Card className="mb-4 bg-muted/50">
              <CardHeader className="py-4">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">Filter Options</CardTitle>
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <CircleX className="mr-2 h-4 w-4" /> Clear Filters
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title-filter">Title</Label>
                  <Input
                    id="title-filter"
                    placeholder="Search by title..."
                    value={filters.title}
                    onChange={(e) => handleFilterChange("title", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <MultiSelectTags
                    selectedTags={filters.tags}
                    onTagsChange={(tags) => handleFilterChange("tags", tags)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status-filter">Status</Label>
                  <Select
                    value={filters.status}
                    onValueChange={(value) => handleFilterChange("status", value === "all" ? "" : value)}
                  >
                    <SelectTrigger id="status-filter">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resubmission_required">Resubmission Required</SelectItem>
                      <SelectItem value="resubmitted">Resubmitted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date-after">Updated After</Label>
                  <Input
                    id="date-after"
                    type="date"
                    value={filters.date_after}
                    onChange={(e) => handleFilterChange("date_after", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date-before">Updated Before</Label>
                  <Input
                    id="date-before"
                    type="date"
                    value={filters.date_before}
                    onChange={(e) => handleFilterChange("date_before", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedSlugs.length === applications.length && applications.length > 0}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="cursor-pointer w-[40%]" onClick={() => handleSort("title")}>
                    <div className="flex items-center">Title & Tags {renderSortArrow("title")}</div>
                  </TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("updated")}>
                    <div className="flex items-center">Last Updated {renderSortArrow("updated")}</div>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: params.per_page }).map((_, index) => <SkeletonRow key={index} />)
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-red-500">
                      {error}
                    </TableCell>
                  </TableRow>
                ) : applications.length > 0 ? (
                  applications.map((app) => (
                    <TableRow key={app.slug} data-state={selectedSlugs.includes(app.slug) && "selected"}>
                      <TableCell>
                        <Checkbox
                          checked={selectedSlugs.includes(app.slug)}
                          onCheckedChange={(checked) => handleSelectRow(app.slug, !!checked)}
                          aria-label={`Select row ${app.title}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium align-top">
                        <div>{app.title}</div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {app.tags &&
                            app.tags.split(",").map((tag) => (
                              <Badge key={tag.trim()} variant="secondary" className="font-normal">
                                {tag.trim()}
                              </Badge>
                            ))}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">{app.applicant.name}</TableCell>
                      <TableCell className="align-top">{new Date(app.updated).toLocaleDateString()}</TableCell>
                      <TableCell className="align-top">
                        <Badge>{app.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault()
                                setSelectedSlug(app.slug)
                                setIsModalOpen(true)
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" /> Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport("pdf", [app.slug])}>
                              <FileDown className="mr-2 h-4 w-4" /> Export as PDF
                            </DropdownMenuItem>
                            {params.archived === "only" ? (
                              <DropdownMenuItem onClick={() => handleAction(app.slug, "unarchive")}>
                                <ArchiveRestore className="mr-2 h-4 w-4" /> Un-archive
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleAction(app.slug, "archive")}>
                                <Archive className="mr-2 h-4 w-4" /> Archive
                              </DropdownMenuItem>
                            )}
                            {params.deleted === "only" ? (
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleAction(app.slug, "undelete")}
                              >
                                <Undo className="mr-2 h-4 w-4" /> Undelete
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleAction(app.slug, "delete")}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">
                      No applications found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-end space-x-2 py-4">
            <span className="text-sm text-muted-foreground">
              Page {pagination.currentPage} of {pagination.lastPage} ({pagination.total} items)
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => changePage(pagination.currentPage - 1)}
              disabled={isLoading || pagination.currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => changePage(pagination.currentPage + 1)}
              disabled={isLoading || pagination.currentPage >= pagination.lastPage}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <ApplicationDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        applicationSlug={selectedSlug}
        onDetailFetched={(app) => detailCache.current.set(app.slug, app)}
        config={config}
      />
    </>
  )
}
