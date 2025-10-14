// csv-uploader-include-callForIdea/actions/reportGeneration.ts

"use server";

import type { FilteredAppRawData } from '@/components/LeaderboardBreakdowns';

interface ReportData {
  filteredApps: FilteredAppRawData[];
  municipalityFilter: string;
  lastSyncTime: string | null;
  scoreSetName: string;
}

// Helper to extract field value
const extractFieldValue = (app: FilteredAppRawData, slug: string): string => {
  const rawFields = (app.raw_fields as any[]) || [];
  const field = rawFields.find((f: any) => f.slug === slug);
  const value = field?.value;
  if (typeof value === 'object' && value !== null) {
    return field?.translated?.en_GB || value.en_GB || value.en || JSON.stringify(value);
  }
  return value !== null && value !== undefined && typeof value === 'string' ? value.split(" - [")[0].trim() : "N/A";
};

const extractPsCodeValue = (app: FilteredAppRawData, possibleSlugs: string[]): string => {
  const rawFields = (app.raw_fields as any[]) || [];
  const field = rawFields.find((f: any) => possibleSlugs.includes(f.slug));
  return field?.value || "N/A";
};

const abbreviateAgeLabel = (label: string): string => {
  if (label.toLowerCase().includes('below 18')) return '< 18';
  if (label.toLowerCase().includes('above 65')) return '> 65';
  return label.replace(/\s*years\s*/, '-years').replace(/\s/g, '').replace(/^-/, '').trim();
};

export async function generatePDFReport(reportData: ReportData): Promise<string> {
  // This is a server action that will be called from the client
  // We return a base64 string that the client can use to create a download
  const { filteredApps, municipalityFilter, lastSyncTime, scoreSetName } = reportData;
  
  // Create a simple data structure that can be sent to client
  // The actual PDF generation will happen on the client side
  const reportContent = {
    metadata: {
      generatedAt: new Date().toISOString(),
      lastSyncTime: lastSyncTime || 'N/A',
      scoreSetName,
      municipalityFilter: municipalityFilter === 'all' ? 'All Municipalities' : municipalityFilter,
      totalApplications: filteredApps.length,
    },
    scoreDistribution: {
      'Score = 6': filteredApps.filter(a => a.totalScore === 6).length,
      'Score ≥ 5': filteredApps.filter(a => a.totalScore >= 5).length,
      'Score ≥ 4': filteredApps.filter(a => a.totalScore >= 4).length,
      'Score < 4': filteredApps.filter(a => a.totalScore < 4).length,
    },
    municipalBreakdown: filteredApps.reduce((acc, app) => {
      const muni = app.municipality || 'N/A';
      acc[muni] = (acc[muni] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    categoryBreakdown: filteredApps.reduce((acc, app) => {
      const cat = app.category?.name?.en_GB || 'Uncategorized';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    genderBreakdown: filteredApps.reduce((acc, app) => {
      const gender = extractFieldValue(app, 'rojNQzOz');
      acc[gender] = (acc[gender] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    ageBreakdown: filteredApps.reduce((acc, app) => {
      const age = abbreviateAgeLabel(extractFieldValue(app, 'xjzONPwj'));
      acc[age] = (acc[age] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    psCodeBreakdown: filteredApps.reduce((acc, app) => {
      const psCode = extractPsCodeValue(app, ['gkknPnQp', 'jDJaNYGG', 'RjAnzBZJ', 'OJBPQyGP']);
      if (psCode !== 'N/A') {
        acc[psCode] = (acc[psCode] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>),
  };
  
  return JSON.stringify(reportContent);
}