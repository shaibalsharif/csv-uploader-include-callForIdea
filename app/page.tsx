"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
//import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Upload, FileText, Settings, Database, AlertCircle, XCircle, Trophy, GanttChartSquare, Zap } from "lucide-react" // Added Trophy
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CSVUploader } from "@/components/csv-uploader"
import { ProcessingDashboard } from "@/components/processing-dashboard"
import { BatchHistory } from "@/components/batch-history"
import { FailedSubmissions } from "@/components/failed-submissions"
import { ApplicationManager } from "@/components/ApplicationManager"
import { Leaderboard } from "@/components/Leaderboard"
import Link from "next/link"
import SpecialButton from "@/components/SpecialButton"
import { DuplicateFinder } from "@/components/DuplicateFinder" // NEW


export default function HomePage() {
  // Added 'leaderboard' to the possible tab states
  const [activeTab, setActiveTab] = useState<"upload" | "history" | "failed" | "manage" | "leaderboard" | "duplicate">("upload")
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

  const renderActiveTab = () => {
    switch (activeTab) {
      case "upload":
        return !csvFile || isCompleted ? (
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
        );
      case "history":
        return <BatchHistory />;
      case "failed":
        return <FailedSubmissions />;
      case "manage":
        return <ApplicationManager config={config} />;
      case "leaderboard": // New case for the leaderboard
        return <Leaderboard config={config} />;
      case "duplicate": // NEW CASE
        return <DuplicateFinder config={config} />;
      default:
        return null;
    }
  }


  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className=" flex justify-between items-center ">


          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">GoodGrants CSV Bulk Uploader</h1>
            <p className="text-muted-foreground">
              Upload, process, manage, and view leaderboards for GoodGrants applications.
            </p>

            <Link className="cursor-pointer" href="/analysis" passHref>
              <SpecialButton label="Open Analysis" />

            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:flex gap-4 mb-6">
          <Button
            variant={activeTab === "upload" ? "default" : "outline"}
            onClick={() => { setActiveTab("upload"); handleReset(); }}
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload & Process
          </Button>
          <Button
            variant={activeTab === "history" ? "default" : "outline"}
            onClick={() => setActiveTab("history")}
            className="flex items-center gap-2"
          >
            <Database className="w-4 h-4" />
            Batch History
          </Button>
          <Button
            variant={activeTab === "failed" ? "default" : "outline"}
            onClick={() => setActiveTab("failed")}
            className="flex items-center gap-2"
          >
            <XCircle className="w-4 h-4" />
            Failed Submissions
          </Button>
          <Button
            variant={activeTab === "manage" ? "default" : "outline"}
            onClick={() => setActiveTab("manage")}
            className="flex items-center gap-2"
          >
            <GanttChartSquare className="w-4 h-4" />
            Manage Applications
          </Button>
          {/* New Leaderboard Button */}
          <Button
            variant={activeTab === "leaderboard" ? "default" : "outline"}
            onClick={() => setActiveTab("leaderboard")}
            className="flex items-center gap-2"
          >
            <Trophy className="w-4 h-4" />
            Leaderboard
          </Button>
          {/* New Duplicate Finder Button (NEW) */}
          <Button
            variant={activeTab === "duplicate" ? "default" : "outline"}
            onClick={() => setActiveTab("duplicate")}
            className="flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Find Duplicates
          </Button>
        </div>

        <div className="space-y-6">
          {renderActiveTab()}
        </div>
      </div>
    </div>
  )
}