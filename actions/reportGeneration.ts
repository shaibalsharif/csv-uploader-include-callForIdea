// shaibalsharif/csv-uploader-include-callforidea/csv-uploader-include-callForIdea-14a8d21d8fecb34cd17d5142be6dd196d290720c/actions/reportGeneration.ts

"use server";

import type { FilteredAppRawData } from '@/components/LeaderboardBreakdowns';

// CORRECTED: Slugs for the four challenge statement fields
const CHALLENGE_STATEMENT_SLUGS = ['gkknPnQp', 'jDJaNYGG', 'RjAnzBZJ', 'OJBPQyGP'];
const APPLICANT_CATEGORY_SLUG = 'JvKDGVwE'; // NEW SLUG

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

// NEW HELPER FUNCTION
const normalizeApplicantCategory = (value: string): string => {
    const v = value.toLowerCase();
    if (v.includes('academia')) return 'Education Institute';
    if (v.includes('municipal administration') || v.includes('private organization') || v.includes('civil society') || v.includes('ngo/ingo')) return 'Institution';
    return 'Individual';
};

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

// FIX: Extract both the code and the potentially descriptive label.
const extractPsCodeAndLabel = (app: FilteredAppRawData, possibleSlugs: string[]): string => {
    const field = (app.raw_fields as any[])?.find((f: any) => possibleSlugs.includes(f.slug));
    if (!field || !field.value) return "N/A";

    const fullValueString = String(field.value);

    // 1. Extract the clean code (e.g., "Char-PS-1")
    const code = fullValueString.split(" - [")[0].trim();
    if (!code || code === 'N/A') return "N/A";

    // 2. Try to get a descriptive label, typically from 'translated'
    let label = field.translated?.en_GB;
    
    if (label && label.length > 0) {
        // If translated label exists, use it. We assume it contains the description.
        return `${code}: ${label}`;
    }

    // Attempt to parse a description if the original value is not just the code
    if (fullValueString.includes(':')) {
        // Assume format is "CODE: Description" or similar
        const descriptionPart = fullValueString.split(':').slice(1).join(':').trim();
        if (descriptionPart.length > 0) {
            return `${code}: ${descriptionPart}`;
        }
    } 
    
    // If all else fails, return the code itself.
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
        // Ensure key is not N/A or null/undefined strings
        if (key && key !== 'N/A' && key !== 'null') {
            acc[key] = (acc[key] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);

    // NEW: Detailed Applicant Category Breakdown for PDF table (Normalized to Raw Counts)
    const applicantCategoryDetailedBreakdown = filteredApps.reduce((acc, app) => {
        const rawKey = extractFieldValue(app, APPLICANT_CATEGORY_SLUG);
        const normalizedKey = normalizeApplicantCategory(rawKey);

        if (rawKey && rawKey !== 'N/A' && rawKey !== 'null') {
            if (!acc[normalizedKey]) {
                acc[normalizedKey] = { total: 0, rawCategories: {} as Record<string, number> };
            }
            acc[normalizedKey].total++;
            acc[normalizedKey].rawCategories[rawKey] = (acc[normalizedKey].rawCategories[rawKey] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, { total: number, rawCategories: Record<string, number> }>);


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
    applicantCategoryBreakdown: createBreakdown(app => normalizeApplicantCategory(extractFieldValue(app, APPLICANT_CATEGORY_SLUG))), // Simple count for chart/summary
    applicantCategoryDetailedBreakdown, // NEW: Detailed breakdown for table generation in PDF backend
    ageBreakdown: createBreakdown(app => abbreviateAgeLabel(extractFieldValue(app, 'xjzONPwj'))),
    // Use the defined constant for PS field slugs
    psCodeBreakdown: createBreakdown(app => extractPsCodeAndLabel(app, CHALLENGE_STATEMENT_SLUGS)),
  };
  
  return JSON.stringify(reportContent);
}