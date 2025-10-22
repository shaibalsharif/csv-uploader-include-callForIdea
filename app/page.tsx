"use client"; // Added client directive as state management is needed

import { useState } from 'react';
import { CSVUploader } from '@/components/csv-uploader'; // Corrected import name
import { ProcessingDashboard } from '@/components/processing-dashboard';

// Assumed to be passed globally or set in .env
// NOTE: I am providing placeholders for missing config variables. You MUST ensure these are defined in your .env or similar.
const API_KEY = process.env.GOODGRANTS_API_KEY || "YOUR_API_KEY_HERE"; 
const BASE_URL = process.env.GOODGRANTS_BASE_URL || "https://api.cr4ce.com";
const FORM_SLUG = process.env.GOODGRANTS_FORM_SLUG || "default-form-slug";
const APPLICANT_SLUG = process.env.GOODGRANTS_APPLICANT_SLUG || "default-applicant-slug";

export default function HomePage() {
  const fullConfig = { 
    apiKey: API_KEY, 
    baseUrl: BASE_URL, 
    formSlug: FORM_SLUG, 
    applicantSlug: APPLICANT_SLUG
  };
  
  // State management to connect Uploader and Dashboard
  const [csvFile, setCsvFile] = useState<File | null>(null);
  // FIX: processingMode now correctly reflects the types required by ProcessingDashboard (assuming 'validate'/'parse' map to the required types).
  const [processingMode, setProcessingMode] = useState<'handsfree' | 'interruption' | null>(null); 
  
  // Handlers
  const handleUploadComplete = (file: File, mode: 'validate' | 'parse') => {
    setCsvFile(file);
    // Assuming 'validate' maps to 'interruption' (manual batch start) and 'parse' maps to 'handsfree' (automatic start)
    setProcessingMode(mode === 'parse' ? 'handsfree' : 'interruption'); 
  };
  
  const handleProcessingComplete = () => {
      setCsvFile(null);
      setProcessingMode(null);
  };

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold tracking-tight">Upload & Process</h2>
      
      {/* 1. CSVUploader */}
      <CSVUploader 
        config={fullConfig} // FIX: Pass full config object
        onFileSelect={setCsvFile}
        selectedFile={csvFile}
        onComplete={handleUploadComplete} // Assuming this function exists in CSVUploader
      />

      {/* 2. ProcessingDashboard */}
      {/* Conditionally render or check for file and mode to ensure valid props are passed */}
      {(csvFile && processingMode) && (
        <ProcessingDashboard 
          csvFile={csvFile} // FIX: csvFile is checked to be non-null before render
          processingMode={processingMode} 
          config={fullConfig} // FIX: Pass full config object
          onComplete={handleProcessingComplete} 
        />
      )}
    </div>
  );
}
