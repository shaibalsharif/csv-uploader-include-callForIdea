// /app/api/cron/sync-applications/route.ts
import { NextResponse } from "next/server"
import { sql } from "@vercel/postgres"
import { getApplications, getApplicationDetails } from "@/actions/application"

// Helper function to insert or update a batch of applications
async function upsertApplications(applications: any[]) {
  if (applications.length === 0) return

  // Start the query
  let query = `
    INSERT INTO goodgrants_applications (slug, title, status, applicant_name, applicant_email, tags, created_at, updated_at, category, raw_fields) VALUES
  `
  const values: any[] = []
  let paramIndex = 1

  // Add each application to the query
  applications.forEach((app, index) => {
    query += `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
    if (index < applications.length - 1) {
      query += ", "
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
    )
  })

  // Add the ON CONFLICT clause to handle updates for existing applications
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
  `

  await sql.query(query, values)
}

export async function GET(request: Request) {
  // 1. Authenticate the request
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const config = { apiKey: process.env.GOODGRANTS_API_KEY! }
  if (!config.apiKey) {
    throw new Error("GOODGRANTS_API_KEY is not set.")
  }

  try {
    let currentPage = 1
    let hasMorePages = true
    let totalSynced = 0

    // 2. Paginate through all applications from the API
    while (hasMorePages) {
      console.log(`Fetching page ${currentPage}...`)
      const listResponse = await getApplications(
        config,
        { page: currentPage, per_page: 50, order: "updated", dir: "desc", archived: "none", deleted: "none" },
        { title: "", tags: [], status: "", date_after: "", date_before: "" },
      )

      const applicationsOnPage = listResponse.data
      if (applicationsOnPage.length > 0) {
        // 3. Fetch full details for each application to get custom fields
        const detailedApplications = await Promise.all(
          applicationsOnPage.map((app: { slug: string }) => getApplicationDetails(config, app.slug)),
        )

        // 4. Upsert the batch into the Neon database
        await upsertApplications(detailedApplications)
        totalSynced += detailedApplications.length
      }

      // 5. Check if there are more pages
      if (listResponse.current_page >= listResponse.last_page) {
        hasMorePages = false
      } else {
        currentPage++
      }
    }

    // 6. Log the successful run
    const successTime = new Date().toISOString()
    await sql`
      UPDATE cron_job_logs
      SET last_run_at = ${successTime}, status = 'success', details = ${`Synced ${totalSynced} applications.`}
      WHERE job_name = 'sync-goodgrants-applications';
    `

    return NextResponse.json({ success: true, synced: totalSynced })
  } catch (error: any) {
    // 7. Log any errors
    await sql`
      UPDATE cron_job_logs
      SET status = 'failure', details = ${error.message}
      WHERE job_name = 'sync-goodgrants-applications';
    `
    console.error("Cron job failed:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}