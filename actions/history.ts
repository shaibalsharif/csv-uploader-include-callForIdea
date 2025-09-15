"use server";

import { sql } from "@vercel/postgres";
import { revalidatePath } from "next/cache";
import { createObjectCsvStringifier } from "csv-writer";

interface ApplicationData {
  id: string
  title: string
  status: "pending" | "processing" | "completed" | "error" | "skipped"
  data: Record<string, any>
  tags: string[]
  error?: string
  applicationId?: string
  applicationSlug?: string
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

/**
 * Creates a new batch record and its associated applications in the database.
 */
export async function createBatchAndApplications(batchData: Omit<BatchHistoryData, 'id'>, applications: ApplicationData[]) {
    try {
        const result = await sql`
            INSERT INTO processing_batches (
                file_name, 
                original_csv_content, 
                processing_mode,
                config_form_slug,
                config_applicant_slug,
                total_applications, 
                completed_applications, 
                error_applications, 
                skipped_applications, 
                logs
            ) VALUES (
                ${batchData.fileName}, 
                ${batchData.originalCsvContent}, 
                ${batchData.processingMode},
                ${batchData.configFormSlug},
                ${batchData.configApplicantSlug},
                ${batchData.totalApplications}, 
                ${batchData.completedApplications}, 
                ${batchData.errorApplications}, 
                ${batchData.skippedApplications}, 
                ${JSON.stringify(batchData.logs)}
            ) RETURNING id;
        `;
        const batchId = result.rows[0].id;

        for (const app of applications) {
            if (app.status === "error") {
                await sql`
                    INSERT INTO failed_submissions (
                        batch_id,
                        application_id,
                        title,
                        data,
                        error_message
                    ) VALUES (
                        ${batchId},
                        ${app.applicationId || app.applicationSlug || null},
                        ${app.title},
                        ${JSON.stringify(app.data)},
                        ${app.error || 'Unknown error'}
                    );
                `;
            } else {
                await sql`
                    INSERT INTO batch_applications (
                        batch_id, 
                        application_id,
                        title, 
                        status,
                        data
                    ) VALUES (
                        ${batchId}, 
                        ${app.applicationId || app.applicationSlug || null},
                        ${app.title},
                        ${app.status},
                        ${JSON.stringify(app.data)}
                    );
                `;
            }
        }

        revalidatePath('/history');
        revalidatePath('/failed-submissions');
        return batchId;
    } catch (error) {
        console.error("Error creating batch and applications:", error);
        throw new Error("Failed to create batch record and applications.");
    }
}

/**
 * Retrieves a list of all batch history records from the main table.
 */
export async function getBatches() {
    try {
        const { rows } = await sql`
            SELECT 
                id, 
                created_at, 
                file_name,
                total_applications,
                completed_applications,
                error_applications,
                skipped_applications,
                processing_mode
            FROM processing_batches 
            ORDER BY created_at DESC;
        `;
        return rows;
    } catch (error) {
        console.error("Error fetching batches:", error);
        throw new Error("Failed to fetch batch history.");
    }
}

/**
 * Retrieves the full details of a specific batch and its applications.
 */
export async function getBatchDetails(id: string) {
    try {
        const { rows: batchRows } = await sql`
            SELECT 
                id,
                created_at,
                file_name,
                total_applications,
                completed_applications,
                error_applications,
                skipped_applications,
                processing_mode,
                logs
            FROM processing_batches WHERE id = ${id};
        `;
        if (batchRows.length === 0) {
            return null;
        }
        const batchDetails = batchRows[0];
        
        const { rows: applicationRows } = await sql`
            SELECT 
                id,
                application_id,
                title,
                status,
                data,
                error_message
            FROM batch_applications 
            WHERE batch_id = ${id};
        `;
        return {
            ...batchDetails,
            applications: applicationRows
        };
    } catch (error) {
        console.error("Error fetching batch details:", error);
        throw new Error("Failed to fetch batch details.");
    }
}

/**
 * Retrieves the original CSV content for a specific batch.
 */
export async function getOriginalCsvContent(id: string) {
    try {
        const { rows } = await sql`
            SELECT original_csv_content FROM processing_batches WHERE id = ${id};
        `;
        return rows.length > 0 ? rows[0].original_csv_content : null;
    } catch (error) {
        console.error("Error fetching original CSV:", error);
        throw new Error("Failed to fetch original CSV content.");
    }
}

/**
 * Retrieves all failed submissions.
 */
export async function getFailedSubmissions() {
    try {
        const { rows } = await sql`
            SELECT 
                id,
                batch_id,
                application_id,
                title,
                error_message,
                is_resolved,
                created_at
            FROM failed_submissions
            ORDER BY created_at DESC;
        `;
        return rows;
    } catch (error) {
        console.error("Error fetching failed submissions:", error);
        throw new Error("Failed to fetch failed submissions.");
    }
}

/**
 * Retrieves the failed applications for a specific batch for CSV export.
 */
export async function getFailedCsvContent(ids: string[]): Promise<string> {
  if (!ids || ids.length === 0) {
    return "No failed applications found for the selected IDs.";
  }

  const uniqueIds = Array.from(new Set(ids));

  // Build Postgres array literal, e.g. '{id1,id2,id3}'
  const pgArray = `{${uniqueIds.join(",")}}`;

  const { rows } = await sql`
    SELECT data, error_message
    FROM failed_submissions
    WHERE id = ANY(${pgArray}::uuid[]);
  `;

  if (rows.length === 0) {
    return "No failed applications found for the selected IDs.";
  }

  const firstRowData = rows[0].data || {};
  const headers = Object.keys(firstRowData);
  const csvHeader = [...headers, "error_message"];

  const stringifier = createObjectCsvStringifier({
    header: csvHeader.map((h) => ({ id: h, title: h })),
  });

  const records = rows.map((row) => {
    const data = row.data || {};
    const record: Record<string, any> = {};
    headers.forEach((header) => {
      record[header] = data[header];
    });
    record.error_message = row.error_message;
    return record;
  });

  return stringifier.getHeaderString() + stringifier.stringifyRecords(records);
}

/**
 * Marks failed applications as resolved.
 */
export async function markAsResolved(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) {
    return;
  }

  const uniqueIds = Array.from(new Set(ids));
  const pgArray = `{${uniqueIds.join(",")}}`;

  await sql`
    UPDATE failed_submissions
    SET is_resolved = TRUE
    WHERE id = ANY(${pgArray}::uuid[]);
  `;

  revalidatePath("/failed-submissions");
}
