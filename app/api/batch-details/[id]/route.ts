import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const batchId = await params.id

    // In a real implementation, this would query your database:
    // const batch = await db.batches.findUnique({
    //   where: { id: batchId },
    //   include: { applications: true }
    // })

    const existingBatches = JSON.parse(localStorage.getItem("processingBatches") || "[]")
    const batch = existingBatches.find((b: any) => b.id === batchId)

    if (!batch) {
      return NextResponse.json({ success: false, error: "Batch not found" }, { status: 404 })
    }

    // Transform the stored applications to match the expected format
    const applications = batch.applications.map((app: any, index: number) => ({
      id: app.id || `app-${index}`,
      title: app.title,
      name: app.data?.["Name"] || app.data?.["Full Name"] || "N/A",
      gender: app.data?.["Gender"] || "N/A",
      municipality: app.data?.["Municipality"] || app.data?.["District"] || "N/A",
      phone: app.data?.["Phone Number"] || app.data?.["Phone"] || "N/A",
      email: app.data?.["Email"] || app.data?.["Email Address"] || "N/A",
      tags: app.tags || [],
      status: app.status || "pending",
      errorMessage: app.error,
    }))

    return NextResponse.json({
      success: true,
      applications: applications,
    })
  } catch (error) {
    console.error("Error fetching batch details:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch batch details" }, { status: 500 })
  }
}
