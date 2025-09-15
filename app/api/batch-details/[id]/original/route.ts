import { NextResponse } from "next/server";
import { getOriginalCsvContent } from "@/actions/history";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const batchId = await params.id;
    const originalCsvContent = await getOriginalCsvContent(batchId);

    if (!originalCsvContent) {
      return NextResponse.json({ error: "Batch or original CSV content not found" }, { status: 404 });
    }

    const headers = new Headers();
    headers.set("Content-Type", "text/csv");
    headers.set("Content-Disposition", `attachment; filename="original_batch_${batchId}.csv"`);

    return new NextResponse(originalCsvContent, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Error fetching original CSV content:", error);
    return NextResponse.json({ error: "Failed to fetch original CSV content" }, { status: 500 });
  }
}