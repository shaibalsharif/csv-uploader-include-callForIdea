"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { Upload, FileText, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"

interface CSVUploaderProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  config: { apiKey: string; baseUrl: string; formSlug: string; applicantSlug: string; }; // FIX: Added config
  onComplete: (file: File, mode: 'validate' | 'parse') => void; // FIX: Added onComplete
}

export function CSVUploader({ onFileSelect, selectedFile, config, onComplete }: CSVUploaderProps) {
  const [processingMode, setProcessingMode] = useState<'validate' | 'parse'>('validate');

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".csv"],
    },
    multiple: false,
  });

  const removeFile = () => {
    onFileSelect(null);
  };
  
  const handleProcess = () => {
      if (selectedFile) {
          onComplete(selectedFile, processingMode);
      }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>1. Upload CSV</CardTitle>
        <CardDescription>Upload the raw CSV data from GoodGrants.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedFile ? (
          <>
            <div className="flex items-center justify-between border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-primary" />
                <div>
                  <div className="font-medium">{selectedFile.name}</div>
                  <div className="text-sm text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={removeFile}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center space-x-4 pt-2">
                <Select value={processingMode} onValueChange={(value: 'validate' | 'parse') => setProcessingMode(value)}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select Processing Mode" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="validate">Validate</SelectItem>
                        <SelectItem value="parse">Parse & Submit</SelectItem>
                    </SelectContent>
                </Select>
                <Button onClick={handleProcess}>
                    Start {processingMode === 'validate' ? 'Validation' : 'Submission'}
                </Button>
            </div>
          </>
        ) : (
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer transition-colors",
              isDragActive && "border-primary bg-primary/5",
            )}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <div className="space-y-2">
              <div className="text-lg font-medium">{isDragActive ? "Drop your CSV file here" : "Upload CSV File"}</div>
              <div className="text-sm text-muted-foreground">Drag and drop your CSV file here, or click to browse</div>
              <div className="text-xs text-muted-foreground">Supports .csv files only</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
