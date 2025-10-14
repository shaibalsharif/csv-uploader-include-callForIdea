"use server";

import type { FilteredAppRawData } from '@/components/LeaderboardBreakdowns';

// --- Type Definitions ---
interface ReportDataRequest {
  filteredApps: FilteredAppRawData[];
  municipalityFilter: string;
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

const extractPsCodeValue = (app: FilteredAppRawData, possibleSlugs: string[]): string => {
  const rawFields = (app.raw_fields as any[]) || [];
  const field = rawFields.find((f: any) => possibleSlugs.includes(f.slug));
  const value = field?.value;
  // New logic to also extract the label/title from the translated value
  if (field?.translated?.en_GB) {
     return field.translated.en_GB;
  }
  return value || "N/A";
};

const abbreviateAgeLabel = (label: string): string => {
  if (label.toLowerCase().includes('below 18')) return '< 18';
  if (label.toLowerCase().includes('above 65')) return '> 65';
  return label.replace(/\s*years\s*/, '-years').replace(/\s/g, '').replace(/^-/, '').trim();
};

// --- Main Server Action ---
export async function generatePDFReport(reportData: ReportDataRequest): Promise<string> {
  const { filteredApps, municipalityFilter, lastSyncTime, scoreSetName, minScore, maxScore } = reportData;

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
    psCodeBreakdown: createBreakdown(app => extractPsCodeValue(app, ['gkknPnQp', 'jDJaNYGG', 'RjAnzBZJ', 'OJBPQyGP'])),
  };
  
  return JSON.stringify(reportContent);
}

