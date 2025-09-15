"use client"

import { useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { Upload, FileText, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface CSVUploaderProps {
  onFileSelect: (file: File | null) => void
  selectedFile: File | null
}

export function CSVUploader({ onFileSelect, selectedFile }: CSVUploaderProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0])
      }
    },
    [onFileSelect],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".csv"],
    },
    multiple: false,
  })

  const removeFile = () => {
    onFileSelect(null)
  }

  if (selectedFile) {
    return (
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-center justify-between">
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
      </div>
    )
  }

  return (
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
  )
}
