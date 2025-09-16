import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Clock, Tag, AlertTriangle, ListFilter, MapPin } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { submitApplication, addTags } from "@/actions/application";
import { parseCSV as parseCsvServer } from "@/actions/parse";
import { createBatchAndApplications } from "@/actions/history";

interface ProcessingDashboardProps {
  csvFile: File;
  processingMode: "handsfree" | "interruption";
  config: {
    apiKey: string;
    baseUrl: string;
    formSlug: string;
    applicantSlug: string;
  };
  onComplete: () => void;
}

interface ApplicationData {
  id: string;
  title: string;
  status: "pending" | "processing" | "completed" | "error" | "skipped";
  data: Record<string, any>;
  tags: string[];
  error?: string;
  applicationId?: string;
  applicationSlug?: string;
}

const municipalityMappings = {
  "Gaibandha": {
    label: "Gaibandha",
    fieldSlug: "RjAnzBZJ",
  },
  "Sirajganj": {
    label: "Sirajganj",
    fieldSlug: "OJBPQyGP",
  },
  "Charghat": {
    label: "Charghat",
    fieldSlug: "jDJaNYGG",
  },
  "Chapainawabganj": {
    label: "Chapainawabganj",
    fieldSlug: "gkknPnQp",
  }
};
type MunicipalitySlug = keyof typeof municipalityMappings;

const allAgeRanges = [
  "Above 65 years",
  "56 - 65 years",
  "Below 18",
  "36 - 45 years",
  "26 - 35 years",
  "46 - 55 years",
  "18 - 25 years"
];

const normalizeAgeRange = (age: string): string => {
  const cleaned = age.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (cleaned.includes("above65")) return "Above 65 years";
  if (cleaned.includes("below18")) return "Below 18";
  if (cleaned.includes("5665")) return "56 - 65 years";
  if (cleaned.includes("4655")) return "46 - 55 years";
  if (cleaned.includes("3645")) return "36 - 45 years";
  if (cleaned.includes("2635")) return "26 - 35 years";
  if (cleaned.includes("1825")) return "18 - 25 years";
  return age;
};

// Helper function to validate key data fields in an application
const formatPhoneNumber = (number: string): string => {
  if (!number) return "";
  let cleanNumber = number.replace(/\D/g, "");
  if (cleanNumber.startsWith("0")) {
    cleanNumber = cleanNumber.substring(1);
  } else if (cleanNumber.startsWith("880")) {
    cleanNumber = cleanNumber.substring(3);
  } else if (cleanNumber.startsWith("88")) {
    cleanNumber = cleanNumber.substring(2);
  }
  if (cleanNumber.length === 10) {
    return `+880${cleanNumber}`;
  }
  return number;
};
const validateApplicationData = (data: Record<string, any>, selectedMunicipality: string | null): string[] => {
  const errors: string[] = [];

  const checkValue = (key: string) => data[key] && String(data[key]).trim() !== "";
  const findKey = (partialKey: string) => Object.keys(data).find(key => key.includes(partialKey));


  // Check required fields based on the CSV headers
  const titleKey = findKey("Name of the idea");
  if (!titleKey || !checkValue(titleKey)) {
    errors.push("Title is missing or invalid.");
  }
  const categoryKey = findKey("Digital/Non-Digital Idea");
  if (!categoryKey || !checkValue(categoryKey)) {
    errors.push("Category is missing or invalid.");
  }
  const fullNameKey = findKey("Full Name");
  if (!fullNameKey || !checkValue(fullNameKey)) {
    errors.push("Full Name is missing or invalid.");
  }
  const ageRangeKey = findKey("Select age range");
  if (!ageRangeKey || !allAgeRanges.includes(normalizeAgeRange(data[ageRangeKey]))) {
    errors.push("Age range is missing or invalid.");
  }
  const phoneKey = findKey("Phone no.");
  if (!phoneKey || !checkValue(phoneKey) || !formatPhoneNumber(data[phoneKey])) {
    errors.push("Phone number is missing or invalid.");
  }
  const implementKey = findKey("Do you want to Implement it yourself?");
  if (!implementKey || !checkValue(implementKey)) {
    errors.push("Self-implementation question is missing or invalid.");
  }

  // Dynamic challenge statement check based on selected municipality
  if (selectedMunicipality) {
    const fieldSlug = municipalityMappings[selectedMunicipality as MunicipalitySlug]?.fieldSlug;
    if (fieldSlug) {
      const challengeKey = findKey(`Challange statement* - [${fieldSlug}]`);
      if (!challengeKey || !checkValue(challengeKey)) {
        errors.push("Challenge statement is missing or invalid.");
      }
    }
  }

  return errors;
};

export function ProcessingDashboard({ csvFile, processingMode, config, onComplete }: ProcessingDashboardProps) {
  const [applications, setApplications] = useState<ApplicationData[]>([]);
  const [batches, setBatches] = useState<ApplicationData[][]>([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [originalCsvContent, setOriginalCsvContent] = useState<string>("");
  const [municipalityConfirmation, setMunicipalityConfirmation] = useState<{ confirmed: boolean; detected: string | null; selected: string | null }>({
    confirmed: false,
    detected: null,
    selected: null,
  });
  const [showErrorConfirmation, setShowErrorConfirmation] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<ApplicationData | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    if (csvFile && !hasProcessedRef.current) {
      hasProcessedRef.current = true;
      parseCSV();
    }
  }, [csvFile]);

  const handleApplicationSelect = (application: ApplicationData) => {
    setSelectedApplication(application);
    setIsDetailsModalOpen(true);
  };

  const handleDetailsModalClose = () => {
    setSelectedApplication(null);
    setIsDetailsModalOpen(false);
  };

  const parseCSV = async () => {
    try {
      addLog("Parsing CSV file using server-side parser...");
      const text = await csvFile.text();
      setOriginalCsvContent(text);

      const parsedData = await parseCsvServer(text);

      const validData = parsedData.filter(row => Object.values(row).some(value => value && String(value).trim() !== ""));

      if (!validData || validData.length === 0) {
        addLog("No valid data found in the CSV file.");
        setApplications([]);
        setBatches([]);
        return;
      }

      let detectedMunicipality: string | null = null;
      if (validData[0] && validData[0]["Municipality - [rDkKljjz]"]) {
        const municipalityValue = validData[0]["Municipality - [rDkKljjz]"];
        const cleanName = municipalityValue.split(" - [")[0].trim();
        if (Object.keys(municipalityMappings).includes(cleanName)) {
          detectedMunicipality = cleanName;
        }
      }

      setMunicipalityConfirmation({
        confirmed: false,
        detected: detectedMunicipality,
        selected: detectedMunicipality,
      });

      const parsedApplications: ApplicationData[] = validData.map((row, index) => {
        const titleHeader = Object.keys(row).find((h) => h.includes("Name of the idea"));
        const title = titleHeader ? row[titleHeader] : `Application ${index + 1}`;

        const tags = extractTags(row);

        return {
          id: `app-${index + 1}`,
          title,
          status: "pending",
          data: row,
          tags,
        };
      });

      setApplications(parsedApplications);
      addLog(`Parsed ${parsedApplications.length} applications from CSV`);

      const batchedApplications: ApplicationData[][] = [];
      for (let i = 0; i < parsedApplications.length; i += 20) {
        batchedApplications.push(parsedApplications.slice(i, i + 20));
      }
      setBatches(batchedApplications);
      addLog(`Divided into ${batchedApplications.length} batches of 20 applications.`);

    } catch (error) {
      addLog(`❌ Failed to parse CSV: ${error instanceof Error ? error.message : "Unknown error"}`);
      setApplications([]);
    }
  };

  const extractTags = (data: Record<string, any>): string[] => {
    const tags: string[] = [];
    const validTagLabels = [
      "56 - 65 years", "Char-PS-2", "Siraj-PS-2", "Chapai-PS-2", "Gaib-PS-3",
      "Gaib-PS-1", "Char-PS-3", "Chapai-PS-3", "Siraj-PS-3", "Gaib-PS-2",
      "Below 18", "Chapai-PS-1", "36 - 45 years", "26 - 35 years", "non-digital",
      "Char-PS-1", "46 - 55 years", "Female", "Siraj-PS-1", "18 - 25 years",
      "Male", "digital", "Sirajganj", "Charghat", "Gaibandha", "Chapai Nawabganj",
      "academia", "NGO/iNGO", "Personal Level"
    ];

    const categoryField = Object.keys(data).find(key => key.includes("Digital/Non-Digital Idea"));
    if (categoryField) {
      const categoryValue = data[categoryField] || "";
      if (categoryValue.toLowerCase().includes("non-digital")) {
        tags.push("non-digital");
      } else if (categoryValue.toLowerCase().includes("digital") && !categoryValue.toLowerCase().includes("non-digital")) {
        tags.push("digital");
      }
    }

    Object.values(data).forEach((value) => {
      if (typeof value === "string" && value.includes(" - [")) {
        const cleanLabel = value.split(" - [")[0].trim();
        if (validTagLabels.includes(cleanLabel)) {
          tags.push(cleanLabel);
        }
      } else if (typeof value === "string" && allAgeRanges.includes(normalizeAgeRange(value))) {
        tags.push(normalizeAgeRange(value));
      }
    });

    return [...new Set(tags)];
  };

  const getSlugFromFormattedString = (str: string): string | null => {
    const match = str.match(/\[(.*?)\]/);
    return match ? match[1] : null;
  };


  const startProcessing = async () => {
    setIsProcessing(true);
    addLog(`Starting batch processing...`);
    await processBatch(batches[currentBatchIndex], currentBatchIndex);
  };

  const processBatch = async (batch: ApplicationData[], batchIndex: number) => {
    addLog(`Submitting batch ${batchIndex + 1} of ${batches.length}...`);

    const updatedApplications = [...applications];

    for (const app of batch) {
      const appIndex = applications.findIndex(a => a.id === app.id);
      try {
        setApplications((prev) => prev.map((a, i) => (i === appIndex ? { ...a, status: "processing" } : a)));
        addLog(`Processing application: ${app.title}`, app.id);

        const formattedData = { ...app.data };
        const applicationFields: Record<string, any> = {};
        let title = "";
        let categorySlug = "";

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

        const selectedMunicipalitySlug = municipalityMappings[municipalityConfirmation.selected as MunicipalitySlug].fieldSlug;
        const newCsvHeaderToApiSlugMapping = {
          ...csvHeaderToApiSlugMapping,
          [`Challange statement* - [${selectedMunicipalitySlug}]`]: selectedMunicipalitySlug
        };

        for (const [csvHeader, apiSlug] of Object.entries(newCsvHeaderToApiSlugMapping)) {
          let value = formattedData[csvHeader];

          if (value !== undefined && value !== null && value.trim() !== "") {
            if (apiSlug === "title") {
              title = value;
            } else if (apiSlug === "category_slug") {
              categorySlug = getSlugFromFormattedString(value) || "";
            } else if (apiSlug === "OLVQXPpn") {
              const formattedPhoneNumber = formatPhoneNumber(value);
              if (formattedPhoneNumber) {
                applicationFields[apiSlug] = formattedPhoneNumber;
              } else {
                throw new Error(`Invalid phone number format for ${csvHeader}: ${value}`);
              }
            } else if (apiSlug === "xjzONPwj") {
              const normalizedValue = normalizeAgeRange(value);
              const finalValue = getSlugFromFormattedString(value) || normalizedValue;
              if (apiSlug) {
                applicationFields[apiSlug] = finalValue;
              }
            } else {
              const finalValue = getSlugFromFormattedString(value) || value;
              if (apiSlug) {
                applicationFields[apiSlug] = finalValue;
              }
            }
          }
        }

        const submitResult = await submitApplication(config, title, categorySlug, applicationFields);
        updatedApplications[appIndex] = {
          ...updatedApplications[appIndex],
          status: "completed",
          applicationId: submitResult.id,
          applicationSlug: submitResult.slug
        };

        addLog(`✅ Successfully submitted: ${app.title} (ID: ${submitResult.id})`, app.id);

        if (app.tags.length > 0) {
          addLog(`🏷️ Adding ${app.tags.length} tags...`, app.id);
          await addTags(config, submitResult.slug, app.tags);
          addLog(`✅ Tags added successfully`, app.id);
        }
      } catch (error) {
        updatedApplications[appIndex] = {
          ...updatedApplications[appIndex],
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error"
        };
        addLog(`❌ Error processing ${app.title}: ${error}`, app.id);
      }
    }
    setApplications(updatedApplications);

    addLog(`Batch ${batchIndex + 1} of ${batches.length} completed.`);

    if (batchIndex < batches.length - 1) {
      setCurrentBatchIndex(batchIndex + 1);
      setIsProcessing(false);
      addLog(`Ready to process next batch.`);
    } else {
      const completedCount = updatedApplications.filter(app => app.status === "completed").length;
      const errorCount = updatedApplications.filter(app => app.status === "error").length;
      const skippedCount = updatedApplications.filter(app => app.status === "skipped").length;

      if (errorCount > 3) {
        setShowErrorConfirmation(true);
      } else {
        const batchData = {
          fileName: csvFile.name,
          totalApplications: updatedApplications.length,
          completedApplications: completedCount,
          errorApplications: errorCount,
          skippedApplications: skippedCount,
          processingMode,
          originalCsvContent,
          logs: logs,
          configFormSlug: config.formSlug,
          configApplicantSlug: config.applicantSlug,
        };

        try {
          await createBatchAndApplications(batchData, updatedApplications);
          addLog("Batch history saved to database.");
        } catch (error) {
          addLog(`❌ Failed to save batch history: ${error}`);
        }

        setIsProcessing(false);
        setIsCompleted(true);
        addLog("All batches processed.");
        onComplete();
      }
    }
  };

  const handleConfirmBatch = async () => {
    setIsProcessing(true);
    await processBatch(batches[currentBatchIndex], currentBatchIndex);
  };

  const handleSkipBatch = () => {
    const skippedBatch = batches[currentBatchIndex];
    setApplications(prev => prev.map(app => skippedBatch.some(skippedApp => skippedApp.id === app.id) ? { ...app, status: "skipped" } : app));
    addLog(`⏭️ Skipped Batch ${currentBatchIndex + 1} of ${batches.length}.`);

    if (currentBatchIndex < batches.length - 1) {
      setCurrentBatchIndex(currentBatchIndex + 1);
      setIsProcessing(false);
      addLog(`Ready to process next batch.`);
    } else {
      setIsProcessing(false);
      setIsCompleted(true);
      addLog("All batches processed.");
      onComplete();
    }
  };

  const handleMunicipalityConfirm = () => {
    if (municipalityConfirmation.selected) {
      setMunicipalityConfirmation({ ...municipalityConfirmation, confirmed: true });
      addLog(`Confirmed Municipality: ${municipalityConfirmation.selected}`);
    }
  };

  const handleSaveErrors = async () => {
    const completedCount = applications.filter(app => app.status === "completed").length;
    const errorCount = applications.filter(app => app.status === "error").length;
    const skippedCount = applications.filter(app => app.status === "skipped").length;

    const batchData = {
      fileName: csvFile.name,
      totalApplications: applications.length,
      completedApplications: completedCount,
      errorApplications: errorCount,
      skippedApplications: skippedCount,
      processingMode,
      originalCsvContent,
      logs: logs,
      configFormSlug: config.formSlug,
      configApplicantSlug: config.applicantSlug,
    };

    try {
      await createBatchAndApplications(batchData, applications);
      addLog("Batch history with errors saved to database.");
      toast({
        title: "Success",
        description: `Batch with ${errorCount} errors has been saved to history.`,
      });
    } catch (error) {
      addLog(`❌ Failed to save batch history: ${error}`);
      toast({
        title: "Error",
        description: "Failed to save batch history with errors.",
        variant: "destructive"
      });
    }
    setShowErrorConfirmation(false);
    setIsCompleted(true);
    onComplete();
  };

  const handleSkipErrors = async () => {
    const completedCount = applications.filter(app => app.status === "completed").length;
    const skippedCount = applications.filter(app => app.status === "skipped").length + applications.filter(app => app.status === "error").length;

    const batchData = {
      fileName: csvFile.name,
      totalApplications: applications.length,
      completedApplications: completedCount,
      errorApplications: 0,
      skippedApplications: skippedCount,
      processingMode,
      originalCsvContent,
      logs: logs,
      configFormSlug: config.formSlug,
      configApplicantSlug: config.applicantSlug,
    };

    try {
      await createBatchAndApplications(batchData, applications.filter(app => app.status !== "error"));
      addLog("Batch history without errors saved to database.");
      toast({
        title: "Success",
        description: "Batch with errors skipped and not saved to history.",
      });
    } catch (error) {
      addLog(`❌ Failed to save batch history: ${error}`);
      toast({
        title: "Error",
        description: "Failed to save batch history.",
        variant: "destructive"
      });
    }
    setShowErrorConfirmation(false);
    setIsCompleted(true);
    onComplete();
  };

  const addLog = (message: string, appId?: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = appId ? `[${timestamp}] (App: ${appId}) ` : `[${timestamp}] `;
    setLogs((prev) => [...prev, `${prefix}${message}`]);
  };

  const completedCount = applications.filter((app) => app.status === "completed").length;
  const errorCount = applications.filter((app) => app.status === "error").length;
  const skippedCount = applications.filter((app) => app.status === "skipped").length;
  const totalProcessed = completedCount + errorCount + skippedCount;
  const progress = applications.length > 0 ? (totalProcessed / applications.length) * 100 : 0;

  const currentBatch = batches[currentBatchIndex];

  return (
    <div className="space-y-6">
      {applications.length > 0 && !municipalityConfirmation.confirmed ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Confirm Municipality
            </CardTitle>
            <CardDescription>
              The Challange Statement field depends on the Municipality. Please confirm the correct Municipality for this CSV file.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Detected Municipality</Label>
                <Input value={municipalityConfirmation.detected || "Not Detected"} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="municipality-select">Select Municipality</Label>
                <Select
                  value={municipalityConfirmation.selected || ""}
                  onValueChange={(value) => setMunicipalityConfirmation({ ...municipalityConfirmation, selected: value })}
                >
                  <SelectTrigger id="municipality-select">
                    <SelectValue placeholder="Select a municipality" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(municipalityMappings).map(key => (
                      <SelectItem key={key} value={key}>{key}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleMunicipalityConfirm} disabled={!municipalityConfirmation.selected}>Confirm Municipality</Button>
            </div>
          </CardContent>
        </Card>
      ) : isCompleted ? (
        <Card className="flex items-center justify-center min-h-[300px]">
          <CardContent className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <CardTitle>Batch Processing Complete!</CardTitle>
            <CardDescription className="mt-2">All applications have been processed. You can view the full history or start a new upload.</CardDescription>
            <Button onClick={onComplete} className="mt-6">
              Clear and Upload New
            </Button>
          </CardContent>
        </Card>
      ) : showErrorConfirmation ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Failed Applications Found
            </CardTitle>
            <CardDescription>
              There were {errorCount} applications that failed to submit. Do you want to save them to the failed submissions list?
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-between gap-3 pt-4">
            <Button onClick={handleSaveErrors} className="flex-1">
              <CheckCircle className="w-4 h-4 mr-2" />
              Save {errorCount} Errors
            </Button>
            <Button onClick={handleSkipErrors} variant="outline" className="flex-1 bg-transparent">
              <XCircle className="w-4 h-4 mr-2" />
              Discard Errors
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Processing Progress</CardTitle>
                <CardDescription>
                  {completedCount} completed, {errorCount} errors, {skippedCount} skipped out of {applications.length} total
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={progress} className="mb-4" />
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>{completedCount} Completed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span>{errorCount} Errors</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-500" />
                    <span>{skippedCount} Skipped</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>
                    Applications
                    {batches.length > 0 && ` (Batch ${currentBatchIndex + 1} of ${batches.length})`}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-2">
                      {currentBatch?.map((app) => {
                        const validationErrors = municipalityConfirmation.confirmed
                          ? validateApplicationData(app.data, municipalityConfirmation.selected)
                          : [];

                        return (
                          <div
                            key={app.id}
                            onClick={() => handleApplicationSelect(app)}
                            className={cn(
                              "p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted/50",
                              app.status === "processing" ? "border-primary-foreground animate-pulse bg-primary/5 shadow-md" : "border-border",
                              app.status === "completed" ? "border-green-500" : "",
                              app.status === "error" ? "border-red-500" : "",
                              selectedApplication?.id === app.id ? "bg-accent shadow-lg" : ""
                            )}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 font-medium text-sm truncate">
                                {app.title}
                                {validationErrors.length > 0 && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <ul className="list-disc list-inside">
                                        {validationErrors.map((err, i) => (
                                          <li key={i}>{err}</li>
                                        ))}
                                      </ul>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                              <Badge
                                variant={
                                  app.status === "completed"
                                    ? "default"
                                    : app.status === "error"
                                      ? "destructive"
                                      : app.status === "processing"
                                        ? "secondary"
                                        : "outline"
                                }
                              >
                                {app.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Tag className="w-3 h-3" />
                              <span>{app.tags.length} tags</span>
                              {app.applicationId && (
                                <>
                                  <span>•</span>
                                  <Tooltip>
                                    <TooltipTrigger className="truncate">
                                      ID: {app.applicationId.substring(0, 30)}...
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="w-auto break-words max-w-full">
                                      <span>ID: {app.applicationId}</span>
                                    </TooltipContent>
                                  </Tooltip>
                                </>
                              )}
                            </div>
                            {app.error && (
                              <Alert className="mt-2">
                                <AlertTriangle className="w-4 h-4" />
                                <AlertDescription className="text-xs">{app.error}</AlertDescription>
                              </Alert>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
                {batches.length > 0 && !isProcessing && !isCompleted && !showErrorConfirmation && (
                  <CardContent className="flex justify-between gap-3 pt-4">
                    <Button onClick={handleConfirmBatch} className="flex-1" disabled={isProcessing}>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {`Confirm & Submit Batch ${currentBatchIndex + 1}`}
                    </Button>
                    <Button variant="outline" onClick={handleSkipBatch} className="flex-1 bg-transparent" disabled={isProcessing}>
                      <ListFilter className="w-4 h-4 mr-2" />
                      {`Skip Batch ${currentBatchIndex + 1}`}
                    </Button>
                  </CardContent>
                )}
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Processing Logs</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-1 font-mono text-xs">
                      {logs.map((log, index) => {
                        const isError = log.includes("❌");
                        const isSuccess = log.includes("✅");
                        const isWarning = log.includes("⏭️") || log.includes("🏷️");
                        const logClass = cn({
                          "text-red-500": isError,
                          "text-green-500": isSuccess,
                          "text-yellow-500": isWarning,
                          "text-muted-foreground": !(isError || isSuccess || isWarning)
                        });
                        const isNewApplicationLog = log.includes("(App:") && index > 0 && !logs[index - 1].includes(log.split(" ")[1]);

                        return (
                          <div key={index}>
                            {isNewApplicationLog && <div className="mt-2 border-t border-border-foreground pt-1 border-black border-2" />}
                            <div className={logClass}>
                              {log}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      <Dialog open={isDetailsModalOpen} onOpenChange={handleDetailsModalClose}>
        <DialogContent
          className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] max-w-2xl max-h-[90vh] flex flex-col"
        >
          <DialogHeader>
            <DialogTitle>Application Payload</DialogTitle>
            <DialogDescription>
              Review the data being sent for <strong>{selectedApplication?.title}</strong>.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-x-auto">
              {JSON.stringify(selectedApplication?.data, null, 2)}
            </pre>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={handleDetailsModalClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}