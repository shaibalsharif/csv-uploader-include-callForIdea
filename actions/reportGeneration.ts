"use server";

import type { FilteredAppRawData } from '@/components/LeaderboardBreakdowns';

// CORRECTED: Slugs for the four challenge statement fields
const CHALLENGE_STATEMENT_SLUGS = ['gkknPnQp', 'jDJaNYGG', 'RjAnzBZJ', 'OJBPQyGP'];

// --- Type Definitions ---
interface ReportDataRequest {
  filteredApps: FilteredAppRawData[];
  municipalityFilter: string;
  challengeStatementFilter: string; // ADDED: New filter for challenge statement (comma-separated string)
  lastSyncTime: string | null;
  scoreSetName: string;
  minScore: string;
  maxScore: string;
}

// --- Helper Functions ---
const extractFieldValue = (app: FilteredAppRawData, slug: string): string => {
  const rawFields = (app.raw_fields as any[]) || [];
  const field = rawFields.find((f: any) => f.slug === slug);
  const value = field?.value;
  if (typeof value === 'object' && value !== null) {
    return field?.translated?.en_GB || value.en_GB || value.en || "N/A";
  }
  return value !== null && value !== undefined ? String(value).split(" - [")[0].trim() : "N/A";
};

const extractPsCodeAndLabel = (app: FilteredAppRawData, possibleSlugs: string[]): string => {
    const field = (app.raw_fields as any[])?.find((f: any) => possibleSlugs.includes(f.slug));
    if (!field) return "N/A";
    const code = field.value ? String(field.value).split(" - [")[0].trim() : "N/A";
    const label = field.translated?.en_GB || "";
    if (code === "N/A") return "N/A";
    // We expect the PS code to be the primary differentiator, so we return the code itself
    return code; 
};


const abbreviateAgeLabel = (label: string): string => {
  if (label.toLowerCase().includes('below 18')) return '< 18';
  if (label.toLowerCase().includes('above 65')) return '> 65';
  return label.replace(/\s*years\s*/, '-years').replace(/\s/g, '').replace(/^-/, '').trim();
};

// --- Main Server Action ---
export async function generatePDFReport(reportData: ReportDataRequest): Promise<string> {
  // UPDATED: Destructure new parameter
  const { filteredApps, municipalityFilter, challengeStatementFilter, lastSyncTime, scoreSetName, minScore, maxScore } = reportData;

  const createBreakdown = (extractor: (app: FilteredAppRawData) => string) =>
    filteredApps.reduce((acc, app) => {
        const key = extractor(app);
        if (key !== 'N/A') {
            acc[key] = (acc[key] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);

  const reportContent = {
    metadata: {
      generatedAt: new Date().toISOString(),
      lastSyncTime: lastSyncTime || 'N/A',
      scoreSetName,
      municipalityFilter: municipalityFilter === 'all' ? 'All Municipalities' : municipalityFilter,
      challengeStatementFilter: challengeStatementFilter, // ADDED: Add to metadata
      minScore: minScore || null,
      maxScore: maxScore || null,
      totalApplications: filteredApps.length,
    },
    scoreDistribution: {
      'Score = 6': filteredApps.filter(a => a.totalScore === 6).length,
      'Score >= 5': filteredApps.filter(a => a.totalScore >= 5).length,
      'Score >= 4': filteredApps.filter(a => a.totalScore >= 4).length,
      'Score < 4': filteredApps.filter(a => a.totalScore < 4).length,
    },
    municipalBreakdown: createBreakdown(app => app.municipality || 'N/A'),
    categoryBreakdown: createBreakdown(app => app.category?.name?.en_GB || 'Uncategorized'),
    genderBreakdown: createBreakdown(app => extractFieldValue(app, 'rojNQzOz')),
    ageBreakdown: createBreakdown(app => abbreviateAgeLabel(extractFieldValue(app, 'xjzONPwj'))),
    // Use the defined constant for PS field slugs
    psCodeBreakdown: createBreakdown(app => extractPsCodeAndLabel(app, CHALLENGE_STATEMENT_SLUGS)),
  };
  
  return JSON.stringify(reportContent);
}