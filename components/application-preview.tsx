"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { CheckCircle, SkipForward, Tag, FileText } from "lucide-react"

interface ApplicationData {
  id: string
  title: string
  status: "pending" | "processing" | "completed" | "error" | "skipped"
  data: Record<string, any>
  tags: string[]
  error?: string
  applicationId?: string
}

interface ApplicationPreviewProps {
  application: ApplicationData
  onConfirm: () => void
  onSkip: () => void
  isProcessing: boolean
}

export function ApplicationPreview({ application, onConfirm, onSkip, isProcessing }: ApplicationPreviewProps) {
  const formatFieldName = (key: string) => {
    return key.split(" - [")[0].trim()
  }

  const formatFieldValue = (value: any) => {
    if (typeof value === "string" && value.includes(" - [")) {
      return value.split(" - [")[0].trim()
    }
    return value
  }

  return (
    <Card className="border-2 border-primary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Application Preview
        </CardTitle>
        <CardDescription>Review the application details before submission</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Application Title */}
        <div>
          <h3 className="text-lg font-semibold mb-2">{application.title}</h3>
        </div>

        {/* Tags */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-4 h-4" />
            <span className="font-medium">Tags ({application.tags.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {application.tags.map((tag, index) => (
              <Badge key={index} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        {/* Application Fields */}
        <div>
          <h4 className="font-medium mb-3">Application Fields</h4>
          <ScrollArea className="h-64">
            <div className="space-y-3">
              {Object.entries(application.data).map(([key, value]) => {
                if (!value || value === "") return null

                return (
                  <div key={key} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="font-medium text-sm text-muted-foreground">{formatFieldName(key)}</div>
                    <div className="md:col-span-2 text-sm">{formatFieldValue(value)}</div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button onClick={onConfirm} disabled={isProcessing} className="flex-1">
            <CheckCircle className="w-4 h-4 mr-2" />
            {isProcessing ? "Processing..." : "Confirm & Submit"}
          </Button>
          <Button variant="outline" onClick={onSkip} disabled={isProcessing} className="flex-1 bg-transparent">
            <SkipForward className="w-4 h-4 mr-2" />
            Skip This Application
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
