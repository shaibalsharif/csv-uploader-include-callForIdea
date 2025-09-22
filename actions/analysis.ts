// /actions/analysis.ts
"use server";

import { sql } from "@vercel/postgres";
import { getApplications, getApplicationDetails } from "@/actions/application";

// --- Helper Functions ---
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
type Application = { [key: string]: any };

const extractFieldValue = (app: any, slug: string) => {
  const field = app.raw_fields?.find((f: any) => f.slug === slug);
  return field?.value?.en || "N/A";
};

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

// --- ACTION 1: For Initial Page Load (Fast) ---
export async function getAnalyticsFromDB() {
  try {
    const { rows: logRows } =
      await sql`SELECT last_run_at FROM cron_job_logs WHERE job_name = 'sync-goodgrants-applications'`;
    const lastSyncTime = logRows[0]?.last_run_at || null;

    const { rows: apps } =
      await sql`SELECT slug, updated_at, category, raw_fields FROM goodgrants_applications;`;
    if (apps.length === 0) {
      return { lastSyncTime, isEmpty: true };
    }

    const totalApplications = apps.length;

    const growthData = apps.reduce((acc, app) => {
      const date = new Date(app.updated_at).toISOString().split("T")[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const lineChartData = Object.entries(growthData)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const categoryData = apps.reduce((acc, app) => {
      const categoryName = app.category?.title?.en || "Uncategorized";
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

    const psCodeSlug = "YOUR_PS_CODE_FIELD_SLUG";
    const municipalityData = analyzeField("rDkKljjz");
    const psCodeData = analyzeField(psCodeSlug);
    const ageRangeData = analyzeField("xjzONPwj");

    return {
      lastSyncTime,
      totalApplications,
      lineChartData,
      categoryPieData,
      municipalityData,
      psCodeData,
      ageRangeData,
      isEmpty: false,
    };
  } catch (error: any) {
    console.error("Failed to get analytics from DB:", error);
    return { error: "Could not load analytics from the database." };
  }
}

// --- ACTION 2: For Live Sync Button (Can be slow) ---
export async function triggerLiveSync() {
  console.log("\n🚀 Live sync process started...");
  const DELAY_BETWEEN_REQUESTS_MS = 250;
  const config = { apiKey: process.env.GOODGRANTS_API_KEY! };
  if (!config.apiKey) {
    console.error("❌ FATAL: Server configuration error: API key not found.");
    throw new Error("Server configuration error: API key not found.");
  }

  try {
    const { rows: lastSyncRows } =
      await sql`SELECT MAX(updated_at) as last_updated FROM goodgrants_applications;`;
    const lastSyncDate: string | null = lastSyncRows[0]?.last_updated || null;

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

          // Log progress without flooding the console
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
