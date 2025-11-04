"use server";

import { sql } from "@vercel/postgres";

interface MinimalRawScoringRow {
    application_id: string;
    application: string;
    category: string;
    reviewer_email: string;
    reviewer_first: string;
    reviewer_last: string;
    scoring_criterion: string;
    score: number;
    max_score: number;
    weighted_score: number;
    weighted_max_score: number;
}

async function ensureTableStructure() {
    try {
        await sql`
            CREATE TABLE IF NOT EXISTS scoring_analysis_data (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                score_set_name VARCHAR(255) NOT NULL DEFAULT 'Jury Evaluation', 
                uploaded_at TIMESTAMPTZ DEFAULT NOW(),
                raw_data JSONB NOT NULL
            );
        `;
        
        try {
            await sql`
                ALTER TABLE scoring_analysis_data 
                ADD COLUMN score_set_name VARCHAR(255) NOT NULL DEFAULT 'Jury Evaluation';
            `;
        } catch (alterError: any) {
             if (!(alterError.code === '42701' || (alterError.message && alterError.message.includes('column "score_set_name" already exists')))) {
                 throw alterError; 
             }
        }
        
    } catch (e) {
        console.error("Critical error during table structure verification:", e);
    }
}


export async function updateScoringData(
    normalizedData: MinimalRawScoringRow[],
    scoreSetName: string
) {
    await ensureTableStructure(); 
    
    await sql`
        DELETE FROM scoring_analysis_data
        WHERE score_set_name = ${scoreSetName};
    `;
    
    const rawDataJson = JSON.stringify(normalizedData);

    const result = await sql`
        INSERT INTO scoring_analysis_data (score_set_name, raw_data)
        VALUES (${scoreSetName}, ${rawDataJson})
        RETURNING uploaded_at;
    `;
    
    return { success: true, count: normalizedData.length, uploadedAt: result.rows[0].uploaded_at };
}

export async function getScoringData(
    scoreSetName: string
): Promise<{ 
    data: MinimalRawScoringRow[] | null; 
    uploadedAt: string | null;
}> {
    await ensureTableStructure(); 
    try {
        const { rows } = await sql<{ raw_data: MinimalRawScoringRow[], uploaded_at: string }>`
            SELECT raw_data, uploaded_at 
            FROM scoring_analysis_data
            WHERE score_set_name = ${scoreSetName}
            ORDER BY uploaded_at DESC
            LIMIT 1;
        `;
        
        if (rows.length === 0) {
            return { data: null, uploadedAt: null };
        }

        return { data: rows[0].raw_data, uploadedAt: rows[0].uploaded_at };

    } catch (error) {
        if (error instanceof Error && error.message.includes("does not exist")) {
             return { data: null, uploadedAt: null };
        }
        throw new Error("Failed to load scoring data from database.");
    }
}

export async function getAvailableScoreSets(): Promise<string[]> {
    await ensureTableStructure(); 
    try {
        const { rows } = await sql<{ score_set_name: string }>`
            SELECT DISTINCT score_set_name
            FROM scoring_analysis_data
            ORDER BY score_set_name;
        `;
        
        return rows.map(row => row.score_set_name);

    } catch (error) {
         return [];
    }
}