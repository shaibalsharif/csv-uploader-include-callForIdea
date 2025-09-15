"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Upload, FileText, Settings, Database, AlertCircle, XCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CSVUploader } from "@/components/csv-uploader"
import { ProcessingDashboard } from "@/components/processing-dashboard"
import { BatchHistory } from "@/components/batch-history"
import { FailedSubmissions } from "@/components/failed-submissions"

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"upload" | "history" | "failed">("upload")
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [processingMode, setProcessingMode] = useState<"handsfree" | "interruption">("handsfree")
  const [isCompleted, setIsCompleted] = useState(false)

  const [config, setConfig] = useState({
    apiKey: "",
    baseUrl: "",
    formSlug: "",
    applicantSlug: "",
  })
  const [configLoaded, setConfigLoaded] = useState(false)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch("/api/config")
        const envConfig = await response.json()

        setConfig({
          apiKey: envConfig.GOODGRANTS_API_KEY || "",
          baseUrl: envConfig.GOODGRANTS_BASE_URL || "",
          formSlug: envConfig.GOODGRANTS_FORM_SLUG || "",
          applicantSlug: envConfig.GOODGRANTS_APPLICANT_SLUG || "",
        })
        setConfigLoaded(true)
      } catch (error) {
        console.error("Failed to load configuration:", error)
        setConfigLoaded(true)
      }
    }

    loadConfig()
  }, [])

  const handleReset = () => {
    setCsvFile(null);
    setIsCompleted(false);
  }

  const handleComplete = () => {
    setIsCompleted(true);
  }

  const isConfigComplete = config.apiKey && config.formSlug && config.baseUrl && config.applicantSlug

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">GoodGrants CSV Bulk Uploader</h1>
          <p className="text-muted-foreground">
            Upload and process CSV files to submit applications to GoodGrants with automated tagging
          </p>
        </div>

        <div className="flex gap-4 mb-6">
          <Button
            variant={activeTab === "upload" ? "default" : "outline"}
            onClick={() => {
              setActiveTab("upload");
              handleReset();
            }}
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload & Process
          </Button>
          <Button
            variant={activeTab === "history" ? "default" : "outline"}
            onClick={() => {
              setActiveTab("history");
              handleReset();
            }}
            className="flex items-center gap-2"
          >
            <Database className="w-4 h-4" />
            Batch History
          </Button>
          <Button
            variant={activeTab === "failed" ? "default" : "outline"}
            onClick={() => {
              setActiveTab("failed");
              handleReset();
            }}
            className="flex items-center gap-2"
          >
            <XCircle className="w-4 h-4" />
            Failed Submissions
          </Button>
        </div>

        {activeTab === "upload" && (
          <div className="space-y-6">
            {!csvFile || isCompleted ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      GoodGrants API Configuration
                    </CardTitle>
                    <CardDescription>Configuration loaded from environment variables</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!configLoaded ? (
                      <div className="text-center py-4">Loading configuration...</div>
                    ) : !isConfigComplete ? (
                      <Alert>
                        <AlertCircle className="w-4 h-4" />
                        <AlertDescription>
                          Missing required environment variables. Please ensure the following are set:
                          GOODGRANTS_API_KEY, GOODGRANTS_BASE_URL, GOODGRANTS_FORM_SLUG, GOODGRANTS_APPLICANT_SLUG
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>API Key</Label>
                          <Input
                            type="password"
                            value={config.apiKey ? "••••••••••••••••" : "Not configured"}
                            disabled
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Base URL</Label>
                          <Input value={config.baseUrl || "Not configured"} disabled />
                        </div>
                        <div className="space-y-2">
                          <Label>Form Slug</Label>
                          <Input value={config.formSlug || "Not configured"} disabled />
                        </div>
                        <div className="space-y-2">
                          <Label>Applicant Slug</Label>
                          <Input value={config.applicantSlug || "Not configured"} disabled />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      CSV File Upload
                    </CardTitle>
                    <CardDescription>Select your CSV file containing application data</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CSVUploader onFileSelect={setCsvFile} selectedFile={csvFile} />
                  </CardContent>
                </Card>
              </>
            ) : (
              <ProcessingDashboard
                csvFile={csvFile}
                processingMode={processingMode}
                config={config}
                onComplete={handleComplete}
              />
            )}
          </div>
        )}

        {activeTab === "history" && <BatchHistory />}
        {activeTab === "failed" && <FailedSubmissions />}
      </div>
    </div>
  )
}