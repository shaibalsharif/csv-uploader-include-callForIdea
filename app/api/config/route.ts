import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    GOODGRANTS_API_KEY: process.env.GOODGRANTS_API_KEY,
    GOODGRANTS_BASE_URL: process.env.GOODGRANTS_BASE_URL,
    GOODGRANTS_FORM_SLUG: process.env.GOODGRANTS_FORM_SLUG,
    GOODGRANTS_APPLICANT_SLUG: process.env.GOODGRANTS_APPLICANT_SLUG,
  })
}
