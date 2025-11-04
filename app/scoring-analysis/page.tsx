// shaibalsharif/csv-uploader-include-callforidea/csv-uploader-include-callForIdea-fe61227ec0c792d529ac1bafca0fb8d9e4e0fee4/app/scoring-analysis/page.tsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, RefreshCw, FileText, XCircle, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { parseCSV as parseCsvServer } from '@/actions/parse'; 
import { computeAggregates, normalizeRow, AggregatedData, RawScoringRow } from '@/lib/scoring-utils';
import { getScoringData, updateScoringData, getAvailableScoreSets } from '@/actions/scoring-analysis'; 
import { ScoringDashboard } from '@/components/ScoringDashboard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; 


export default function ScoringAnalysisPage() {
  const DEFAULT_SCORE_SET = 'Jury Evaluation';
    
  const [data, setData] = useState<RawScoringRow[] | null>(null); 
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  
  const [aggregatedData, setAggregatedData] = useState<AggregatedData | null>(null);
  const [availableScoreSets, setAvailableScoreSets] = useState<string[]>([]);
  const [currentScoreSet, setCurrentScoreSet] = useState<string>(DEFAULT_SCORE_SET);
  const [scoreSetNameInput, setScoreSetNameInput] = useState<string>(DEFAULT_SCORE_SET);
  
  const { toast } = useToast();
  
  const loadScoreSetsAndData = useCallback(async (setOverride?: string, isRefresh = false) => {
    setIsProcessingUpload(true);
    let loadedSetName = setOverride || currentScoreSet;

    try {
        const sets = await getAvailableScoreSets();
        setAvailableScoreSets(sets);
        
        if (!sets.includes(loadedSetName)) {
            loadedSetName = sets.length > 0 ? sets[0] : DEFAULT_SCORE_SET;
        }
        
        setCurrentScoreSet(loadedSetName);
        setScoreSetNameInput(loadedSetName); 

        const { data: dbData } = await getScoringData(loadedSetName);
        
        if (dbData && dbData.length > 0) {
            setAggregatedData(computeAggregates(dbData));
            
            if (setOverride) {
                 toast({ title: "Score Set Switched", description: `Switched to score set: '${loadedSetName}'.`, duration: 3000 });
            } else if (isRefresh) {
                 toast({ title: "Data Refreshed", description: `Reloaded ${dbData.length} records for score set '${loadedSetName}'.`, duration: 3000 });
            }
        } else {
            setAggregatedData(null);
            if (sets.length > 0) {
                 toast({ title: "No Data Found", description: `Score set '${loadedSetName}' is currently empty.`, variant: "default", duration: 3000 });
            } else {
                 toast({ title: "Setup Required", description: "Database is empty. Please upload the first score set.", variant: "default", duration: 3000 });
            }
        }
    } catch (err) {
        console.error("Error loading initial data:", err);
        toast({ title: "DB Load Failed", description: "Could not load prior data from the database.", variant: "destructive" });
        setAggregatedData(null);
    } finally {
        setIsProcessingUpload(false);
    }
  }, [currentScoreSet, toast]);
  
  useEffect(() => {
    loadScoreSetsAndData();
  }, []); 

  const handleScoreSetChange = (setName: string) => {
      if (setName !== currentScoreSet) {
          setCurrentScoreSet(setName);
          loadScoreSetsAndData(setName); 
      }
  }
  
  const handleDataRefresh = () => {
      loadScoreSetsAndData(currentScoreSet, true);
  }
  
  const handleFileProcessing = async (file: File) => {
    setUploadedFile(file);
    setIsProcessingUpload(true);
    setData(null);
    setScoreSetNameInput(DEFAULT_SCORE_SET); 

    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      let parsedData: any[] = [];
      
      if (ext === "csv") {
        const text = await file.text();
        parsedData = await parseCsvServer(text);
        
      } else if (ext === "xlsx" || ext === "xls") {
         const data = await file.arrayBuffer();
         const wb = XLSX.read(data, { type: "array" });
         const first = wb.SheetNames[0];
         parsedData = XLSX.utils.sheet_to_json(wb.Sheets[first], { defval: "" });
      } else {
          throw new Error("Unsupported file type. Please use CSV or XLSX.");
      }

      if (!parsedData || parsedData.length === 0) {
          throw new Error("No valid data rows found after parsing.");
      }
      
      const detectedScoreSet = parsedData[0]["Score set"] || parsedData[0]["Score Set"];
      
      if (detectedScoreSet) {
          setScoreSetNameInput(detectedScoreSet); 
      }
      
      const normalizedData = parsedData.map(r => normalizeRow(r)).filter(r => r.application_id && r.reviewer_email && r.scoring_criterion);
      
      if (normalizedData.length === 0) {
          throw new Error("No valid scoring records found after normalization.");
      }
      
      setData(normalizedData);
      
      toast({ title: "File Processed", description: `${normalizedData.length} records ready to be ingested for score set '${detectedScoreSet || scoreSetNameInput}'.`, duration: 3000 });
      
    } catch (error) {
        console.error("File processing error:", error);
        toast({ title: "File Error", description: `Failed to process file: ${error instanceof Error ? error.message : String(error)}`, variant: "destructive" });
        setUploadedFile(null);
        setData(null);
    } finally {
        setIsProcessingUpload(false);
    }
  };
  
  const handleIngest = async () => {
    if (!data || !uploadedFile) return;
    setIsProcessingUpload(true);
    
    const nameToUse = scoreSetNameInput.trim() || DEFAULT_SCORE_SET;
    
    try {
        await updateScoringData(data, nameToUse); 
        
        toast({ title: "Success", description: `Successfully loaded ${data.length} records for score set '${nameToUse}'.`, duration: 3000 });
        
        await loadScoreSetsAndData(nameToUse, true); 
        
        setUploadedFile(null);
        setData(null); 
        
    } catch (error) {
        toast({ title: "DB Error", description: `Failed to save data to DB: ${error instanceof Error ? error.message : String(error)}`, variant: "destructive" });
    } finally {
        setIsProcessingUpload(false);
    }
  };
  
  const handleClearScoreSet = async () => {
      const confirmation = window.confirm(`Are you sure you want to delete the entire '${currentScoreSet}' score set data? This cannot be undone.`);
      if (!confirmation) return;
      
      setIsProcessingUpload(true);
      try {
          await updateScoringData([], currentScoreSet); 
          
          toast({ title: "Score Set Cleared", description: `Successfully cleared scoring data for '${currentScoreSet}'.`, duration: 3000 });
          
          await loadScoreSetsAndData(); 
          
      } catch (error) {
          toast({ title: "DB Error", description: "Failed to clear data from DB.", variant: "destructive" });
      } finally {
          setIsProcessingUpload(false);
      }
  }

  const handleClearUpload = () => {
    setUploadedFile(null);
    setData(null);
    toast({ title: "Upload Cleared", description: "File preview reset.", duration: 2000 });
  };
  
  const hasData = aggregatedData !== null;
  const showProcessingCard = uploadedFile || data;
  
  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold tracking-tight">Scoring Analysis</h2>
      
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
                <Label htmlFor="score-set-select">Current Score Set:</Label>
                <Select value={currentScoreSet} onValueChange={handleScoreSetChange} disabled={isProcessingUpload || availableScoreSets.length === 0}>
                    <SelectTrigger id="score-set-select" className="w-[200px]">
                        <SelectValue placeholder={DEFAULT_SCORE_SET} />
                    </SelectTrigger>
                    <SelectContent>
                        {availableScoreSets.map(set => (
                            <SelectItem key={set} value={set}>{set}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            
            {hasData && (
                 <Button onClick={handleClearScoreSet} variant="ghost" size="sm" disabled={isProcessingUpload} className="text-destructive hover:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Clear Set
                </Button>
            )}
            
            <Button onClick={handleDataRefresh} variant="outline" size="sm" disabled={isProcessingUpload}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh Data
            </Button>
        </div>
        
        <div className="flex items-center space-x-2">
            <input 
                id="file-upload-input"
                type="file" 
                accept=".csv, .xlsx, .xls"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileProcessing(file);
                    e.target.value = ''; 
                }}
                style={{ display: 'none' }} 
            />
            <Button onClick={() => document.getElementById('file-upload-input')?.click()} disabled={isProcessingUpload}>
                <Upload className="mr-2 h-4 w-4" /> Upload New File
            </Button>
        </div>
      </div>
      
      {showProcessingCard && (
           <Card>
              <CardHeader>
                  <CardTitle>File Processing - Ready to Ingest</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className='mb-4'>
                    <Label htmlFor="score-set-input" className="mb-2 block">Name for this new Score Set (Replaces data if name exists)</Label>
                    <Input 
                        id="score-set-input"
                        value={scoreSetNameInput}
                        onChange={(e) => setScoreSetNameInput(e.target.value)}
                        placeholder={DEFAULT_SCORE_SET}
                        disabled={isProcessingUpload}
                        className="max-w-md"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between border border-border rounded-lg p-3">
                      <div className="flex items-center gap-3">
                          <FileText className="w-6 h-6 text-primary" />
                          <div>
                              <div className="font-medium">{uploadedFile?.name || 'File Uploading...'}</div>
                              <div className="text-sm text-muted-foreground">{data ? `${data.length} valid records processed` : 'Processing or normalizing data...'}</div>
                          </div>
                      </div>
                      <div className="flex gap-2">
                          <Button onClick={handleClearUpload} variant="outline" size="sm" disabled={isProcessingUpload}>
                              <XCircle className="w-4 h-4 mr-1" /> Cancel
                          </Button>
                          <Button onClick={handleIngest} disabled={!data || isProcessingUpload || !scoreSetNameInput.trim()}>
                              {isProcessingUpload ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                              {isProcessingUpload ? "Loading..." : `Load & Analyze ('${scoreSetNameInput.trim()}')`}
                          </Button>
                      </div>
                  </div>
              </CardContent>
          </Card>
      )}

      {!hasData && !showProcessingCard ? (
        <Card className="p-8 text-center mt-6">
            <AlertCircle className="w-6 h-6 text-muted-foreground mx-auto mb-3" />
            <CardTitle>No Data Loaded for Analysis</CardTitle>
            <CardDescription>
                The score set **{currentScoreSet}** is empty. Upload a scoring file to start the analysis.
            </CardDescription>
        </Card>
      ) : hasData && (
        <Tabs defaultValue="overview">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview" className="text-sm">Overview</TabsTrigger>
                <TabsTrigger value="reviewer" className="text-sm">Reviewer Breakdown</TabsTrigger>
                <TabsTrigger value="application" className="text-sm">Application Details</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview">
                 <ScoringDashboard data={aggregatedData} initialTab="overview" />
            </TabsContent>
            
            <TabsContent value="reviewer">
                 <ScoringDashboard data={aggregatedData} initialTab="reviewer" />
            </TabsContent>
            
            <TabsContent value="application">
                 <ScoringDashboard data={aggregatedData} initialTab="application" />
            </TabsContent>
        </Tabs>
      )}
    </div>
  );
}