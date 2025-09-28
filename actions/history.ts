"use server";

import { sql } from "@vercel/postgres";
import { revalidatePath } from "next/cache";
import { createObjectCsvStringifier } from "csv-writer";

// --- Interface Definitions ---
interface ApplicationData {
  id: string;
  title: string;
  status: "pending" | "processing" | "completed" | "error" | "skipped";
  data: Record<string, any>;
  tags: string[];
  error?: string;
  applicationId?: string;
  applicationSlug?: string;
  "Full Name - [lOoZYQWa]"?: string;
  "Municipality - [rDkKljjz]"?: string;
  [key: string]: any;
}

interface BatchHistoryData {
  id?: string;
  fileName: string;
  originalCsvContent: string;
  processingMode: string;
  configFormSlug: string;
  configApplicantSlug: string;
  totalApplications: number;
  completedApplications: number;
  errorApplications: number;
  skippedApplications: number;
  logs: string[];
}

// --- Functions from your original file ---

export async function createBatchAndApplications(
  batchData: Omit<BatchHistoryData, "id">,
  applications: ApplicationData[]
) {
  try {
    const result = await sql`
            INSERT INTO processing_batches (
                file_name, original_csv_content, processing_mode, config_form_slug,
                config_applicant_slug, total_applications, completed_applications, 
                error_applications, skipped_applications, logs
            ) VALUES (
                ${batchData.fileName}, ${batchData.originalCsvContent}, ${batchData.processingMode},
                ${batchData.configFormSlug}, ${batchData.configApplicantSlug}, ${batchData.totalApplications}, 
                ${batchData.completedApplications}, ${batchData.errorApplications}, 
                ${batchData.skippedApplications}, ${JSON.stringify(batchData.logs)}
            ) RETURNING id;
        `;
    const batchId = result.rows[0].id;

    for (const app of applications) {
      const query = app.status === "error"
        ? sql`
            INSERT INTO failed_submissions (batch_id, application_id, title, data, error_message) 
            VALUES (${batchId}, ${app.applicationId || app.applicationSlug || null}, ${app.title}, ${JSON.stringify(app.data)}, ${app.error || "Unknown error"});`
        : sql`
            INSERT INTO batch_applications (batch_id, application_id, title, status, data) 
            VALUES (${batchId}, ${app.applicationId || app.applicationSlug || null}, ${app.title}, ${app.status}, ${JSON.stringify(app.data)});`;
      await query;
    }

    revalidatePath("/history");
    revalidatePath("/failed-submissions");
    return batchId;
  } catch (error) {
    console.error("Error creating batch and applications:", error);
    throw new Error("Failed to create batch record and applications.");
  }
}

export async function getBatches() {
  try {
    const { rows } = await sql`
            SELECT id, created_at, file_name, total_applications, completed_applications,
                   error_applications, skipped_applications, processing_mode
            FROM processing_batches 
            ORDER BY created_at DESC;
        `;
    return rows;
  } catch (error) {
    console.error("Error fetching batches:", error);
    throw new Error("Failed to fetch batch history.");
  }
}

export async function getBatchDetails(id: string) {
  try {
    const { rows: batchRows } = await sql`
            SELECT id, created_at, file_name, total_applications, completed_applications,
                   error_applications, skipped_applications, processing_mode, logs
            FROM processing_batches WHERE id = ${id};
        `;
    if (batchRows.length === 0) return null;
    
    const batchDetails = batchRows[0];
    const { rows: applicationRows } = await sql`
            SELECT id, application_id, title, status, data, error_message
            FROM batch_applications 
            WHERE batch_id = ${id};
        `;
    return { ...batchDetails, applications: applicationRows };
  } catch (error) {
    console.error("Error fetching batch details:", error);
    throw new Error("Failed to fetch batch details.");
  }
}

export async function getOriginalCsvContent(id: string) {
  try {
    const { rows } = await sql`SELECT original_csv_content FROM processing_batches WHERE id = ${id};`;
    return rows.length > 0 ? rows[0].original_csv_content : null;
  } catch (error) {
    console.error("Error fetching original CSV:", error);
    throw new Error("Failed to fetch original CSV content.");
  }
}

export async function getFailedSubmissions() {
  try {
    const { rows } = await sql`
            SELECT id, batch_id, application_id, title, error_message, is_resolved, created_at
            FROM failed_submissions
            ORDER BY created_at DESC;
        `;
    return rows;
  } catch (error) {
    console.error("Error fetching failed submissions:", error);
    throw new Error("Failed to fetch failed submissions.");
  }
}

export async function getFailedCsvContent(ids: string[]): Promise<string> {
  if (!ids?.length) return "No failed applications found for the selected IDs.";
  
  const pgArray = `{${[...new Set(ids)].join(",")}}`;
  const { rows } = await sql`SELECT data, error_message FROM failed_submissions WHERE id = ANY(${pgArray}::uuid[]);`;
  if (rows.length === 0) return "No failed applications found for the selected IDs.";

  const headers = Object.keys(rows[0].data || {});
  const csvHeader = [...headers, "error_message"];
  const stringifier = createObjectCsvStringifier({ header: csvHeader.map((h) => ({ id: h, title: h })) });
  const records = rows.map((row) => ({ ...row.data, error_message: row.error_message }));

  return stringifier.getHeaderString() + stringifier.stringifyRecords(records);
}

export async function markAsResolved(ids: string[]): Promise<void> {
  if (!ids?.length) return;
  
  const pgArray = `{${[...new Set(ids)].join(",")}}`;
  await sql`UPDATE failed_submissions SET is_resolved = TRUE WHERE id = ANY(${pgArray}::uuid[]);`;
  revalidatePath("/failed-submissions");
}

// --- UPDATED FUNCTION ---
/**
 * Fetches applicant name and municipality from the database for a given list of application slugs.
 * @param slugs - An array of application slugs.
 * @returns A Map where keys are slugs and values are objects with name and municipality.
 */
export async function getApplicantDataBySlugs(
  slugs: string[]
): Promise<Map<string, { name: string; municipality: string }>> {
  if (!slugs || slugs.length === 0) {
    return new Map();
  }

  try {
    // Correctly format the array for the SQL query to prevent TS errors.
    const pgArray = `{${slugs.join(',')}}`;

    const { rows } = await sql`
      SELECT application_id, data
      FROM batch_applications
      WHERE application_id = ANY(${pgArray}::text[]);
    `;

    const applicantDataMap = new Map<string, { name: string; municipality: string }>();
    rows.forEach((row) => {
      const slug = row.application_id;
      const data: ApplicationData = row.data || {};
      const name = data["Full Name - [lOoZYQWa]"] || "Unknown Applicant";
      const municipality = data["Municipality - [rDkKljjz]"]?.split(" - [")[0] || "N/A";

      if (slug) {
        applicantDataMap.set(slug, { name, municipality });
      }
    });

    return applicantDataMap;
  } catch (error) {
    console.error("Error fetching applicant data by slugs from Neon DB:", error);
    return new Map();
  }
}

