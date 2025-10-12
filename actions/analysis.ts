//csv-uploader-include-callForIdea/actions/analysis.ts

"use server";

import { sql } from "@vercel/postgres";
import { getApplications, getApplicationDetails } from "@/actions/application";

// --- Type Definitions ---
type Application = { [key: string]: any };

export interface AppRawData {
  slug: string;
  title: string;
  raw_fields: any;
  applicant_name: string;
  applicant_email: string;
  status: string;
  local_status: string; // ADDED
}

// --- Constants for Filtering ---
const TARGET_APPLICANT_EMAIL = "include.call.for.ideas@gmail.com";
const TARGET_APPLICANT_NAME = "Include Apply Account";

// --- Helper Functions ---

/**
 * A utility to pause execution for a specified duration.
 * @param ms - The number of milliseconds to sleep.
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Robustly extracts a field's display value from an application's raw_fields array.
 * @param app - The application object.
 * @param slug - The unique slug of the field to extract.
 * @returns The display value as a string.
 */
const extractFieldValue = (app: any, slug: string): string => {
  const field = app.raw_fields?.find((f: any) => f.slug === slug);
  const value = field?.value;

  if (typeof value === "object" && value !== null) {
    return (
      field?.translated?.en_GB ||
      value.en_GB ||
      value.en ||
      JSON.stringify(value)
    );
  }
  return value !== null && value !== undefined ? String(value) : "N/A";
};

/**
 * Specifically extracts the PS Code value from a list of possible slugs.
 * @param app - The application object.
 * @param possibleSlugs - An array of slugs to search for.
 * @returns The raw PS Code value (e.g., "Char-PS-1").
 */
const extractPsCodeValue = (app: any, possibleSlugs: string[]): string => {
  const field = app.raw_fields?.find((f: any) =>
    possibleSlugs.includes(f.slug)
  );
  return field?.value || "N/A";
};

/**
 * Specifically gets the translated text for a PS Code (Challenge Statement).
 * @param app - The application object.
 * @param possibleSlugs - An array of slugs to search for.
 * @returns The translated text.
 */
const getPsCodeTranslation = (app: any, possibleSlugs: string[]): string => {
  const field = app.raw_fields?.find((f: any) =>
    possibleSlugs.includes(f.slug)
  );
  return field?.translated?.en_GB || "";
};

/**
 * Inserts or updates a batch of applications in the database.
 * Uses PostgreSQL's "ON CONFLICT" clause to perform an "upsert".
 * @param applications - An array of application objects to save.
 */
async function upsertApplications(applications: Application[]) {
  if (applications.length === 0) return;

  let query = `
    INSERT INTO goodgrants_applications (slug, title, status, applicant_name, applicant_email, tags, created_at, updated_at, category, raw_fields) VALUES
  `;
  const values: any[] = [];
  let paramIndex = 1;

  applications.forEach((app, index) => {
    query += `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`;
    if (index < applications.length - 1) {
      query += ", ";
    }
    values.push(
      app.slug,
      app.title,
      app.status,
      app.applicant?.name,
      app.applicant?.email,
      app.tags,
      app.created,
      app.updated,
      JSON.stringify(app.category),
      JSON.stringify(app.application_fields)
    );
  });

  query += `
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title,
      status = EXCLUDED.status,
      applicant_name = EXCLUDED.applicant_name,
      applicant_email = EXCLUDED.applicant_email,
      tags = EXCLUDED.tags,
      updated_at = EXCLUDED.updated_at,
      category = EXCLUDED.category,
      raw_fields = EXCLUDED.raw_fields;
  `;

  await sql.query(query, values);
}

// --- ACTION 1: For Initial Page Load (Reads from DB only) ---
export async function getAnalyticsFromDB() {
  try {
    const { rows: logRows } =
      await sql`SELECT last_run_at FROM cron_job_logs WHERE job_name = 'sync-goodgrants-applications'`;
    const lastSyncTime = logRows[0]?.last_run_at || null;

    // Filter by active status for analytics by default
    const { rows: apps } =
      await sql`SELECT slug, created_at, updated_at, category, raw_fields FROM goodgrants_applications WHERE local_status = 'active';`;
    if (apps.length === 0) {
      return { lastSyncTime, isEmpty: true };
    }

    const totalApplications = apps.length;

    const cutoffDate = new Date("2025-08-31T23:59:59.999Z");
    const onlineApplications = apps.filter(
      (app) => new Date(app.created_at) <= cutoffDate
    ).length;
    const offlineApplications = totalApplications - onlineApplications;

    const createdGrowthData = apps.reduce((acc, app) => {
      const date = new Date(app.created_at).toISOString().split("T")[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const updatedGrowthData = apps.reduce((acc, app) => {
      const date = new Date(app.updated_at).toISOString().split("T")[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Combine and sort all unique dates
    const allDates = [
      ...new Set([
        ...Object.keys(createdGrowthData),
        ...Object.keys(updatedGrowthData),
      ]),
    ].sort();

    const lineChartData = allDates.map((date) => ({
      date: date,
      createdAtCount: createdGrowthData[date] || 0,
      updatedAtCount: updatedGrowthData[date] || 0,
    }));

    const categoryData = apps.reduce((acc, app) => {
      const categoryName = app.category?.name?.en_GB || "Uncategorized";
      acc[categoryName] = (acc[categoryName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const categoryPieData = Object.entries(categoryData).map(
      ([name, value]) => ({ name, value })
    );

    const analyzeField = (slug: string) => {
      const counts = apps.reduce((acc, app) => {
        const value = extractFieldValue(app, slug);
        acc[value] = (acc[value] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      return Object.entries(counts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    };

    const analyzeFieldWithOnlineOffline = (slug: string) => {
      const counts = apps.reduce((acc, app) => {
        const value = extractFieldValue(app, slug);
        if (!acc[value]) {
          acc[value] = { total: 0, online: 0, offline: 0 };
        }
        acc[value].total++;
        if (new Date(app.created_at) <= cutoffDate) {
          acc[value].online++;
        } else {
          acc[value].offline++;
        }
        return acc;
      }, {} as Record<string, { total: number; online: number; offline: number }>);

      return Object.entries(counts)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.total - a.total);
    };

    const psCodeSlugs = ["gkknPnQp", "jDJaNYGG", "RjAnzBZJ", "OJBPQyGP"];
    const psCodeCounts = apps.reduce((acc, app) => {
      const value = extractPsCodeValue(app, psCodeSlugs);
      if (value === "N/A") return acc;
      if (!acc[value]) {
        const translation = getPsCodeTranslation(app, psCodeSlugs);
        acc[value] = { count: 0, translation: translation };
      }
      acc[value].count++;
      return acc;
    }, {} as Record<string, { count: number; translation: string }>);

    const psCodeData = Object.entries(psCodeCounts)
      .map(([name, data]) => ({
        name: name,
        value: data.count,
        translation: data.translation,
      }))
      .sort((a, b) => {
        const regex = /^([a-z]+)-ps-(\d+)$/i;
        const aMatch = a.name.match(regex);
        const bMatch = b.name.match(regex);
        if (aMatch && bMatch) {
          const aPrefix = aMatch[1];
          const bPrefix = bMatch[1];
          if (aPrefix !== bPrefix) return aPrefix.localeCompare(bPrefix);
          return parseInt(aMatch[2], 10) - parseInt(bMatch[2], 10);
        }
        return a.name.localeCompare(b.name);
      });

    const municipalityData = analyzeField("rDkKljjz");
    const ageRangeData = analyzeField("xjzONPwj");
    const genderData = analyzeField("rojNQzOz");
    const municipalityDataWithOnlineOffline =
      analyzeFieldWithOnlineOffline("rDkKljjz");

    const ageOrder = [
      "Below 18",
      "18 - 25 years",
      "26 - 35 years",
      "36 - 45 years",
      "46 - 55 years",
      "56 - 65 years",
      "Above 65",
    ];
    ageRangeData.sort((a, b) => {
      return ageOrder.indexOf(a.name) - ageOrder.indexOf(b.name);
    });

    return {
      lastSyncTime,
      totalApplications,
      onlineApplications,
      offlineApplications,
      lineChartData,
      categoryPieData,
      municipalityData,
      psCodeData,
      ageRangeData,
      genderData,
      municipalityDataWithOnlineOffline,
      isEmpty: false,
      rawApps: apps,
    };
  } catch (error: any) {
    console.error("Failed to get analytics from DB:", error);
    return { error: "Could not load analytics from the database." };
  }
}

// --- ACTION 2: For Live Sync Button (Hits external API) ---
export async function triggerLiveSync() {
  console.log("\n🚀 Live sync process started...");
  const DELAY_BETWEEN_REQUESTS_MS = 350;
  const config = { apiKey: process.env.GOODGRANTS_API_KEY! };
  if (!config.apiKey) {
    console.error("❌ FATAL: Server configuration error: API key not found.");
    throw new Error("Server configuration error: API key not found.");
  }

  try {
    const { rows: lastSyncRows } =
      await sql`SELECT MAX(updated_at) as last_updated FROM goodgrants_applications;`;
    const lastSyncDate: string | null = lastSyncRows[0]?.last_updated || null;
    console.log(lastSyncDate);

    if (lastSyncDate) {
      console.log(
        `🔍 Found last sync date. Fetching applications updated after: ${lastSyncDate}`
      );
    } else {
      console.log("📂 No previous sync data found. Fetching all applications.");
    }

    let currentPage = 1;
    let hasMorePages = true;
    let totalSynced = 0;

    while (hasMorePages) {
      console.log(`\n📄 Fetching summary page ${currentPage}...`);
      const listResponse = await getApplications(
        config,
        {
          page: currentPage,
          per_page: 50,
          order: "updated",
          dir: "desc",
          archived: "none",
          deleted: "none",
        },
        { date_after: lastSyncDate }
      );

      const applicationsOnPage = listResponse.data;
      if (applicationsOnPage && applicationsOnPage.length > 0) {
        const slugsOnPage = applicationsOnPage.map(
          (app: { slug: string }) => app.slug
        );
        console.log(
          `   -> Found ${slugsOnPage.length} summaries on this page.`
        );
        console.log(`   -> Fetching details sequentially...`);

        const detailedApplications: Application[] = [];
        for (const slug of slugsOnPage) {
          const details = await getApplicationDetails(config, slug);
          detailedApplications.push(details);
          if (detailedApplications.length % 10 === 0) {
            console.log(
              `      ...fetched ${detailedApplications.length} of ${slugsOnPage.length} details.`
            );
          }
          await sleep(DELAY_BETWEEN_REQUESTS_MS);
        }
        console.log(
          `   -> Details for all ${detailedApplications.length} applications received.`
        );

        console.log(
          `   -> Saving ${detailedApplications.length} records to the database...`
        );
        await upsertApplications(detailedApplications);
        console.log(`   -> Database updated successfully.`);

        totalSynced += detailedApplications.length;
      } else {
        console.log("   -> No new applications found on this page.");
      }

      if (listResponse.current_page >= listResponse.last_page) {
        console.log("\n✅ All pages processed.");
        hasMorePages = false;
      } else {
        currentPage++;
      }
    }

    const successTime = new Date().toISOString();
    await sql`
      UPDATE cron_job_logs
      SET last_run_at = ${successTime}, status = 'success', details = ${`Manual sync completed. Synced ${totalSynced} applications.`}
      WHERE job_name = 'sync-goodgrants-applications';
    `;
    console.log(
      `\n🎉 Sync successful! Synced a total of ${totalSynced} applications.`
    );
    return { success: true, syncedCount: totalSynced };
  } catch (error: any) {
    console.error("❌ Live sync failed:", error);
    await sql`
      UPDATE cron_job_logs
      SET status = 'failure', details = ${`Manual sync failed: ${error.message}`}
      WHERE job_name = 'sync-goodgrants-applications';
    `;
    return { success: false, error: error.message };
  }
}
// --- ACTION 3: For Duplicate Finder (Reads all eligible raw data from DB) ---
export async function getRawApplicationsForScan(): Promise<AppRawData[]> {
  try {
    // Filter applications by the required applicant account AND local_status = 'active'
    const { rows: apps } =
      await sql<AppRawData>`
        SELECT slug, title, raw_fields, applicant_name, applicant_email, status, local_status
        FROM goodgrants_applications
        WHERE applicant_email = ${TARGET_APPLICANT_EMAIL} 
          AND applicant_name = ${TARGET_APPLICANT_NAME}
          AND local_status = 'active'; 
      `;
    return apps;
  } catch (error) {
    console.error("Failed to get raw applications for scan:", error);
    return [];
  }
}


// NEW ACTION: Fetch single application details from local DB
export async function getApplicationDetailsFromDB(slug: string): Promise<AppRawData | null> {
  try {
    const { rows } = await sql<AppRawData>`
      SELECT slug, title, raw_fields, applicant_name, applicant_email, status, local_status
      FROM goodgrants_applications
      WHERE slug = ${slug} AND applicant_email = ${TARGET_APPLICANT_EMAIL} AND applicant_name = ${TARGET_APPLICANT_NAME}
      LIMIT 1;
    `;
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error(`Failed to get application details for slug ${slug} from DB:`, error);
    return null;
  }
}