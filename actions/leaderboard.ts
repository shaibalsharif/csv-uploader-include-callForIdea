"use server";

import { sql } from "@vercel/postgres";
import { getApplicationDetailsFromDB } from "./analysis";

// --- Custom Score Calculation Constants ---
const TECHNICAL_SLUGS = ["nmWNmZPb"];
const JURY_SLUGS = ["JljrBVpd"];

const WEIGHT_MAP: { [key: string]: number } = {
    'Digital Transformation': 0.15,
    'Digital Transformation (copy)': 0.15,
    'Feasibility and Project Duration': 0.1,
    'Feasibility and Project Duration (copy)': 0.1,
    'Gender Equality and Inclusivenes': 0.15,
    'Gender Equality and Inclusivenes (copy)': 0.15,
    'Sustainability, Scalability and': 0.2,
    'Sustainability, Scalability and (copy)': 0.2,
    'Innovativeness': 0.2,
    'Innovativeness (copy)': 0.2,
    'Value Proposition and Climate Re': 0.2,
    'Value Proposition and Climate Re (copy)': 0.2,
};
// --- Helper to add a delay ---
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- API Request Helper ---
async function apiRequest(endpoint: string, apiKey: string) {
  const response = await fetch(`https://api.cr4ce.com${endpoint}`, {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
      Accept: "application/vnd.Creative Force.v2.3+json",
      "x-api-language": "en_GB",
    },
  });

  if (!response.ok) {
    if (response.status === 429) {
      console.warn("Rate limited. Retrying after 1 second...");
      await sleep(1000);
      return apiRequest(endpoint, apiKey);
    }
    const errorData = await response.text();
    console.error(`API Error: ${response.status} - ${errorData}`);
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}

// --- Local Data Management ---

export interface ScoreBreakdown {
  name: string;
  score: string;
  rawValue: number;
  maxScore: number;
}

export interface LeaderboardEntry {
  slug: string;
  scoreSetSlug: string;
  title: string;
  tags: string[];
  totalScore: number;
  scoreBreakdown: ScoreBreakdown[];
  municipality: string;
}

// NEW: Interface for the minimal data needed for analytics (unpaginated fetch)
export interface AnalyticsLeaderboardEntry {
  slug: string;
  totalScore: number;
  municipality: string;
}

// Type used internally to map DB result rows, ensuring compatibility with the exported type
interface TransformedLeaderboardEntry extends LeaderboardEntry {}

// Helper to handle the final rounding rule: maximum 2 digits after decimal point (standard rounding)
const safeRound = (num: number, decimals: number = 2): number => {
  // Uses standard rounding (e.g., 3.666 -> 3.67).
  return parseFloat(num.toFixed(decimals));
};

// Helper to extract Municipality from the raw fields array
const extractMunicipality = (entry: any): string | null => {
  const rawFields = entry.application_fields || entry.raw_fields || [];
  // Assuming 'rDkKljjz' is the slug for the Municipality field
  const muniField = rawFields.find((f: any) => f.slug === "rDkKljjz");
  if (muniField && muniField.value) {
    // Assume value is like "Municipality Name - [slug]"
    return String(muniField.value).split(" - [")[0].trim();
  }
  return null;
};

// NEW: Function to sync the municipality mapping
async function syncMunicipalityMapping(entries: any[]) {
  if (entries.length === 0) return;

  let query = `
        INSERT INTO app_municipality_map (slug, municipality) VALUES
    `;
  const values: any[] = [];
  let paramIndex = 1;

  entries.forEach((entry, index) => {
    const municipality = extractMunicipality(entry);
    if (municipality) {
      query += `($${paramIndex++}, $${paramIndex++})`;
      values.push(entry.slug, municipality);
      if (index < entries.length - 1) {
        query += ", ";
      }
    }
  });

  if (values.length === 0) return;

  if (query.endsWith(", ")) {
    query = query.substring(0, query.length - 2);
  }

  query += `
        ON CONFLICT (slug) DO UPDATE SET
            municipality = EXCLUDED.municipality;
    `;

  await sql.query(query, values);
}

// --- Custom Score Calculation Logic ---

/**
 * Calculates the weighted score for Technical or Jury Evaluation.
 * This function applies the base weights to all scores it receives, then normalizes.
 * @param criteria Array of criteria scores for the evaluation set.
 * @returns The calculated weighted score.
 */
const calculateWeightedScore = (criteria: any[]): number => {
  let weightedSum = 0;
  let totalUsedWeight = 0;

  for (const criterion of criteria) {
    const criteriaTitle = criterion.name?.en_GB || criterion.title;
    const baseTitle = criteriaTitle.replace(/\s\(copy\)$/i, "");
    const baseWeight = WEIGHT_MAP[baseTitle] ?? WEIGHT_MAP[criteriaTitle];

    if (baseWeight === undefined) {
      console.warn(`Weight not found for criteria: ${criteriaTitle}.`);
      continue;
    }

    const scoreValue = Number(criterion.value);
    if (isNaN(scoreValue)) continue;

    weightedSum += scoreValue * baseWeight;
    totalUsedWeight += baseWeight;
  }

  if (totalUsedWeight === 0) return 0;

  // Normalize the score (weighted sum / total used weight)
  const normalizedScore = weightedSum / totalUsedWeight;

  return safeRound(normalizedScore, 2);
};


/**
 * Calculates the correct total score for a single score set based on its type.
 */
const calculateCustomTotalScore = (entry: any, scoreSetSlug: string): number => {
    const criteria = entry.scores?.criteria || [];

    if (TECHNICAL_SLUGS.includes(scoreSetSlug) || JURY_SLUGS.includes(scoreSetSlug)) {
        // Technical or Jury Evaluation: Weighted Average (with normalization for 5/6 criteria)
        return calculateWeightedScore(criteria);
    } else {
        // Eligibility Shortlisting: Simple Sum of individual criteria scores
        const total = criteria.reduce((sum: number, criterion: any) => {
            return sum + (Number(criterion.value) || 0);
        }, 0);
        return safeRound(total, 2);
    }
};

const transformApiData = (
  entries: any[],
  scoreSetSlug: string
): LeaderboardEntry[] => {
  if (!entries) return [];
  return entries.map((entry: any) => {
    // 1. Calculate the CORRECT total score for THIS score set.
    const totalScore = calculateCustomTotalScore(entry, scoreSetSlug);

    // 2. The scoreBreakdown mapping remains largely the same, but we ensure rawValue is set.
    return {
      slug: entry.slug,
      scoreSetSlug: scoreSetSlug,
      title: entry.title || "Untitled Application",
      tags: (entry.tags || "")
        .split(",")
        .map((t: string) => t.trim())
        .filter((t: string) => t.length > 0),
      // 3. Store the calculated score
      totalScore: totalScore, 
      municipality: "",
      scoreBreakdown:
        entry.scores?.criteria?.map((c: any) => ({
          name: c.name?.en_GB || "Unnamed Criterion",
          // Use final_score for display if present, otherwise format value
          score: c.final_score || `${Number(c.value || 0).toFixed(2)}`,
          // Ensure rawValue is the safe-rounded numerical value for this criterion
          rawValue: safeRound(Number(c.value || 0), 2),
          maxScore: Number(c.max_score || 2),
        })) || [],
    };
  });
};

async function upsertLeaderboardEntries(entries: LeaderboardEntry[]) {
  if (entries.length === 0) return;

  let query = `
        INSERT INTO leaderboard_entries (slug, score_set_slug, title, tags, total_score, score_breakdown) VALUES
    `;
  const values: any[] = [];
  let paramIndex = 1;

  entries.forEach((entry, index) => {
    query += `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`;
    if (index < entries.length - 1) {
      query += ", ";
    }
    values.push(
      entry.slug,
      entry.scoreSetSlug,
      entry.title,
      entry.tags,
      entry.totalScore,
      JSON.stringify(entry.scoreBreakdown)
    );
  });

  if (query.endsWith(", ")) {
    query = query.substring(0, query.length - 2);
  }

  query += `
        ON CONFLICT (slug, score_set_slug) DO UPDATE SET
            title = EXCLUDED.title,
            tags = EXCLUDED.tags,
            total_score = EXCLUDED.total_score,
            score_breakdown = EXCLUDED.score_breakdown,
            created_at = NOW();
    `;

  await sql.query(query, values);
}

// --- Core Sync Logic Refactored ---

/**
 * Core logic to fetch and upsert a single score set.
 */
async function syncLeaderboardCore(
  config: { apiKey: string },
  scoreSetSlug: string,
  runCleanup: boolean
) {
  if (!config.apiKey) throw new Error("API Key not configured.");
  if (!scoreSetSlug) throw new Error("Score set slug is required for sync.");

  // Step 1: Cleanup (only run if not part of a full sync/truncate)
  if (runCleanup) {
    console.log(`Action: Clearing existing data for ${scoreSetSlug}...`);
    await sql`DELETE FROM leaderboard_entries WHERE score_set_slug = ${scoreSetSlug}`;
  }

  let currentPage = 1;
  let hasMorePages = true;
  let totalSynced = 0;
  const PER_PAGE = 50;
  const allEntries: any[] = [];

  while (hasMorePages) {
    const query = new URLSearchParams({
      score_set: scoreSetSlug,
      per_page: PER_PAGE.toString(),
      page: currentPage.toString(),
      order: "auto_score",
      dir: "desc",
    });

    const response = await apiRequest(
      `/leaderboard?${query.toString()}`,
      config.apiKey
    );
    const entriesOnPage = response.data;

    if (entriesOnPage && entriesOnPage.length > 0) {
      allEntries.push(...entriesOnPage);
      const transformedData = transformApiData(entriesOnPage, scoreSetSlug);
      await upsertLeaderboardEntries(transformedData);
      totalSynced += transformedData.length;
    }

    if (response.current_page >= response.last_page) {
      hasMorePages = false;
    } else {
      currentPage++;
      await sleep(200);
    }
  }

  // Step 3: Extract and sync municipality mapping from the fetched entries
  await syncMunicipalityMapping(allEntries);

  return { success: true, syncedCount: totalSynced };
}


// --- Public Actions (API Call) ---

export async function getScoreSets(config: {
  apiKey: string;
}): Promise<{ slug: string; name: { en_GB: string } }[]> {
  const response = await apiRequest(`/score-set`, config.apiKey);
  return response.data;
}

export async function getMunicipalities() {
  try {
    const { rows } = await sql`
            SELECT DISTINCT municipality 
            FROM app_municipality_map 
            WHERE municipality IS NOT NULL AND municipality != ''
            ORDER BY municipality ASC;
        `;
    return rows.map((row) => row.municipality);
  } catch (error) {
    console.error("Error fetching municipalities:", error);
    return [];
  }
}

/**
 * Syncs ALL leaderboard entries for a given score set from the API to the local DB.
 * (Original sync functionality, performs cleanup/delete for the specific set).
 */
export async function syncLeaderboard(
  config: { apiKey: string },
  scoreSetSlug: string
) {
    console.log(`--- Single Leaderboard Sync Started for ${scoreSetSlug} ---`);
    const result = await syncLeaderboardCore(config, scoreSetSlug, true); // Run cleanup
    console.log(`--- Single Sync Complete. Synced ${result.syncedCount} applications. ---`);
    return result;
}

/**
 * Clears the entire leaderboard_entries table and syncs all available score sets.
 */
export async function syncAllLeaderboards(config: { apiKey: string }) {
    if (!config.apiKey) throw new Error("API Key not configured.");
    
    console.log("--- Full Leaderboard Sync Started ---");
    
    // 1. Truncate the table
    console.log("Action: Truncating leaderboard_entries table...");
    await sql`TRUNCATE TABLE leaderboard_entries`;

    // 2. Get all score sets
    console.log("Action: Fetching all score sets...");
    const scoreSets = await getScoreSets(config);
    let totalSynced = 0;
    
    // 3. Sync each score set sequentially
    for (const set of scoreSets) {
        console.log(`Sub-sync: Starting sync for score set: ${set.name.en_GB} (${set.slug})`);
        
        // We pass false for runCleanup because the table was already truncated
        const result = await syncLeaderboardCore(config, set.slug, false); 
        totalSynced += result.syncedCount;
        console.log(`Sub-sync: Finished sync for ${set.name.en_GB}. Synced ${result.syncedCount} applications.`);
    }

    console.log(`--- Full Leaderboard Sync Complete. Total applications synced: ${totalSynced}. ---`);
    return { success: true, syncedCount: totalSynced };
}

// --- Public Actions (Local DB Query) ---

/**
 * Fetches application details from the local goodgrants_applications table.
 */
export async function getApplicationDetailsLocal(slug: string) {
  const details = await getApplicationDetailsFromDB(slug);

  return details;
}

// NEW: Type definition for the combined result row
interface LeaderboardQueryResult extends LeaderboardEntry {
  municipality: string;
}

/**
 * Fetches ALL leaderboard data (totalScore and municipality) for analytics purposes,
 * respecting all filters except pagination.
 */
export async function getAllLeaderboardDataForAnalytics(
  scoreSetSlug: string,
  titleSearch: string,
  tagFilter: string,
  minScore: number | undefined,
  maxScore: number | undefined,
  municipalityFilter: string
): Promise<AnalyticsLeaderboardEntry[]> {
  if (!scoreSetSlug) {
    return [];
  }

  let orderBy = "total_score";
  const direction = "DESC";

  let filterClauses: string[] = [];
  let queryParams: any[] = [scoreSetSlug];
  let paramIndex = 2;

  // --- Conditional JOIN and WHERE Clause ---
  let fromClause = "FROM leaderboard_entries l";
  let selectMunicipality = `COALESCE(m.municipality, 'N/A') AS municipality`;
  let wherePrefix = "l.score_set_slug = $1";

  const shouldFilterByMunicipality =
    municipalityFilter && municipalityFilter !== "all";

  // We always LEFT JOIN to fetch the municipality name.
  fromClause += " LEFT JOIN app_municipality_map m ON l.slug = m.slug";

  // Apply Municipality Filter (only when a specific municipality is selected)
  if (shouldFilterByMunicipality) {
    filterClauses.push(`m.municipality = $${paramIndex++}`);
    queryParams.push(municipalityFilter);
  }

  // Title search filter
  if (titleSearch) {
    filterClauses.push(`LOWER(l.title) LIKE $${paramIndex++}`);
    queryParams.push(`%${titleSearch.toLowerCase()}%`);
  }

  // Tag filter
  if (tagFilter) {
    filterClauses.push(`l.tags @> $${paramIndex++}`);
    queryParams.push(`{${tagFilter}}`);
  }

  // Min Score filter
  if (minScore !== undefined) {
    filterClauses.push(`l.total_score >= $${paramIndex++}`);
    queryParams.push(minScore);
  }

  // Max Score filter
  if (maxScore !== undefined) {
    filterClauses.push(`l.total_score <= $${paramIndex++}`);
    queryParams.push(maxScore);
  }

  // --- Final WHERE clause construction ---
  const whereClause =
    filterClauses.length > 0 ? ` AND ${filterClauses.join(" AND ")}` : "";
  const fullWhereClause = `WHERE ${wherePrefix}${whereClause}`;

  try {
    // Query only the data needed for analytics
    const dataResult = await sql.query<
      AnalyticsLeaderboardEntry & { total_score: string }
    >(
      `
            SELECT l.slug, l.total_score, ${selectMunicipality}
            ${fromClause}
            ${fullWhereClause}
            ORDER BY ${orderBy} ${direction} 
        `,
      queryParams
    );

    // Transform the result to the desired structure and ensure totalScore is a number
    const transformedData: AnalyticsLeaderboardEntry[] = dataResult.rows.map(
      (row: any) => ({
        slug: row.slug,
        totalScore: parseFloat(row.total_score),
        municipality: row.municipality,
      })
    );

    return transformedData;
  } catch (error) {
    console.error("Error fetching ALL leaderboard data for analytics:", error);
    throw new Error("Failed to fetch all data for analytics.");
  }
}

/**
 * Fetches a single page of leaderboard data from the local database.
 */
export async function getLeaderboardPage(
  scoreSetSlug: string,
  page: number,
  perPage: number,
  sort: { key: string; direction: "asc" | "desc" },
  titleSearch: string,
  tagFilter: string,
  minScore: number | undefined,
  maxScore: number | undefined,
  municipalityFilter: string
): Promise<{
  data: LeaderboardEntry[];
  current_page: number;
  last_page: number;
  total: number;
}> {
  if (!scoreSetSlug) {
    return { data: [], current_page: 1, last_page: 1, total: 0 };
  }

  const offset = (page - 1) * perPage;
  let orderBy = "total_score";
  if (sort.key === "title") orderBy = "title";
  const direction = sort.direction.toUpperCase();

  let filterClauses: string[] = [];
  let queryParams: any[] = [scoreSetSlug];
  let paramIndex = 2;

  // --- Conditional JOIN and WHERE Clause ---
  let fromClause = "FROM leaderboard_entries l";
  let selectMunicipality = `COALESCE(m.municipality, 'N/A') AS municipality`;
  let wherePrefix = "l.score_set_slug = $1";

  // Condition: JOIN the municipality table
  const shouldFilterByMunicipality =
    municipalityFilter && municipalityFilter !== "all";

  // We always LEFT JOIN to fetch the municipality name for the table display.
  fromClause += " LEFT JOIN app_municipality_map m ON l.slug = m.slug";

  // Apply Municipality Filter (only when a specific municipality is selected)
  if (shouldFilterByMunicipality) {
    filterClauses.push(`m.municipality = $${paramIndex++}`);
    queryParams.push(municipalityFilter);
  }

  // Title search filter
  if (titleSearch) {
    filterClauses.push(`LOWER(l.title) LIKE $${paramIndex++}`);
    queryParams.push(`%${titleSearch.toLowerCase()}%`);
  }

  // Tag filter
  if (tagFilter) {
    filterClauses.push(`l.tags @> $${paramIndex++}`);
    queryParams.push(`{${tagFilter}}`);
  }

  // Min Score filter
  if (minScore !== undefined) {
    filterClauses.push(`l.total_score >= $${paramIndex++}`);
    queryParams.push(minScore);
  }

  // Max Score filter
  if (maxScore !== undefined) {
    filterClauses.push(`l.total_score <= $${paramIndex++}`);
    queryParams.push(maxScore);
  }

  // --- Final WHERE clause construction ---
  const whereClause =
    filterClauses.length > 0 ? ` AND ${filterClauses.join(" AND ")}` : "";
  const fullWhereClause = `WHERE ${wherePrefix}${whereClause}`;

  // 1. Get total count
  const totalResult = await sql.query(
    `
        SELECT COUNT(l.slug) 
        ${fromClause}
        ${fullWhereClause}
    `,
    queryParams
  );
  const total = parseInt(totalResult.rows[0].count, 10);
  const lastPage = Math.max(1, Math.ceil(total / perPage));

  if (total === 0) {
    return { data: [], current_page: 1, last_page: 1, total: 0 };
  }

  // Prepare parameters for the final query (reusing queryParams)
  queryParams.push(perPage, offset);

  // 2. Get paginated data
  const dataResult = await sql.query<LeaderboardQueryResult>(
    `
        SELECT l.slug, l.score_set_slug, l.title, l.tags, l.total_score, l.score_breakdown, ${selectMunicipality}
        ${fromClause}
        ${fullWhereClause}
        ORDER BY ${orderBy} ${direction}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `,
    queryParams
  );

  const transformedData: LeaderboardEntry[] = dataResult.rows.map(
    (row: any) => ({
      slug: row.slug,
      scoreSetSlug: row.score_set_slug,
      title: row.title,
      tags: row.tags,
      // The total_score stored in DB is already rounded correctly via the fixed transformApiData/calculateTotalScore.
      totalScore: parseFloat(row.total_score),
      scoreBreakdown: row.score_breakdown,
      municipality: row.municipality,
    })
  );

  return {
    data: transformedData,
    current_page: page,
    last_page: lastPage,
    total: total,
  };
}