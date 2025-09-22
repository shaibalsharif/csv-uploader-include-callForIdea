// scripts/manual-sync.ts
import 'dotenv/config';
import { sql } from '@vercel/postgres';
import { getApplications, getApplicationDetails } from '../actions/application';

// --- Configuration ---
// Set to a number (e.g., 50) for testing, or null to sync all applications.
const TOTAL_LIMIT = 50; 
// CHANGED: Delay between each SINGLE request to be kind to the API. 250ms is a safe starting point.
const DELAY_BETWEEN_REQUESTS_MS = 250; 

// --- Helper Functions ---
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Application = { [key: string]: any };

async function upsertApplications(applications: Application[]) {
  if (applications.length === 0) return;
  console.log(`   ⚙️  Upserting ${applications.length} applications into the database...`);

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
      app.applicant.name,
      app.applicant.email,
      app.tags,
      app.created,
      app.updated,
      JSON.stringify(app.category),
      JSON.stringify(app.application_fields),
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
  console.log('   ✅ Batch upserted successfully.');
}

// --- Main Sync Logic ---
async function manualSync() {
  const goal = TOTAL_LIMIT ? `~${TOTAL_LIMIT}` : 'ALL';
  console.log(`\n🚀 Starting manual sync. Goal: Fetch ${goal} applications.`);
  
  const config = { apiKey: process.env.GOODGRANTS_API_KEY! };
  if (!config.apiKey) {
    console.error('❌ ERROR: GOODGRANTS_API_KEY is not defined in your .env.local file.');
    return;
  }

  try {
    let currentPage = 1;
    let hasMorePages = true;
    let totalSynced = 0;

    while (hasMorePages) {
      if (TOTAL_LIMIT && totalSynced >= TOTAL_LIMIT) {
          console.log(`   Limit of ${TOTAL_LIMIT} reached. Stopping.`);
          break;
      }
        
      console.log(`\n📄 Fetching summary page ${currentPage}...`);
      const listResponse = await getApplications(
        config,
        { page: currentPage, per_page: 50, order: "updated", dir: "desc", archived: "none", deleted: "none" },
        {},
      );

      const applicationsOnPage = listResponse.data;
      if (applicationsOnPage.length > 0) {
        const slugsOnPage = applicationsOnPage.map((app: { slug: string }) => app.slug);
        console.log(`   Found ${slugsOnPage.length} applications on this page.`);
        
        // --- REWRITTEN LOGIC: Fetch details sequentially (one by one) ---
        const detailedApplications: Application[] = [];
        console.log(`      -> Fetching details sequentially...`);
        for (const slug of slugsOnPage) {
            // Fetch one application's details
            const details = await getApplicationDetails(config, slug);
            detailedApplications.push(details);
            
            // Log progress for every 5 applications
            if (detailedApplications.length % 5 === 0) {
                console.log(`         ...fetched ${detailedApplications.length} of ${slugsOnPage.length}`);
            }

            // Wait for a short duration before the next request
            await sleep(DELAY_BETWEEN_REQUESTS_MS);
        }
        // --- End of rewritten logic ---

        await upsertApplications(detailedApplications);
        totalSynced += detailedApplications.length;
      }

      if (listResponse.current_page >= listResponse.last_page) {
        hasMorePages = false;
      } else {
        currentPage++;
      }
    }

    console.log(`\n\n🎉 Sync Complete! Total applications synced: ${totalSynced}.`);

  } catch (error) {
    console.error('\n❌ An error occurred during the sync process:', error);
  }
}

manualSync();