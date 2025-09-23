// app/api/export-pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import puppeteer, { Browser, Page } from "puppeteer"; // Import Browser and Page types
import { format } from "date-fns";

export async function POST(req: NextRequest) {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    const {
      totalApplications,
      lastSyncTime,
      municipalityData,
      categoryPieData,
      psCodeData,
      ageRangeData,
      genderData,
      chartImages
    } = await req.json();

    // Helper function to generate table HTML with fixed styles
    const generateTableHtml = (
      title: string,
      data: any[],
      nameKey = "name",
      valueKey = "value",
      translationKey = "translation"
    ) => {
      if (!data || data.length === 0) {
        return `<section class="report-section"><h2>${title}</h2><p>No data available.</p></section>`;
      }
      return `
        <section class="report-section">
          <h2>${title}</h2>
          <table>
            <thead>
              <tr>
                <th>${nameKey.charAt(0).toUpperCase() + nameKey.slice(1)}</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              ${data
                .map(
                  (item: any) => `
                <tr>
                  <td>${item[nameKey]} ${
                    item[translationKey] ? `(${item[translationKey]})` : ""
                  }</td>
                  <td>${item[valueKey]}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </section>
      `;
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Applications Analysis Report</title>
          <style>
              body { font-family: 'Helvetica Neue', 'Arial', sans-serif; font-size: 12px; color: #333; padding: 20px; }
              .header { text-align: center; margin-bottom: 20px; }
              h1 { font-size: 24px; color: #007bff; border-bottom: 2px solid #eee; padding-bottom: 10px; }
              h2 { font-size: 18px; color: #555; margin-top: 30px; }
              h3 { font-size: 16px; margin-top: 20px; text-align: center; }
              .date { font-size: 10px; color: #777; }
              
              /* Table Styling */
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; font-weight: bold; }

              /* Chart and Layout Styling */
              .report-section { margin-bottom: 30px; }
              .page-break { page-break-before: always; }
              
              .chart-container { display: flex; flex-wrap: wrap; justify-content: space-around; }
              .chart-item { width: 45%; margin: 10px; text-align: center; }
              .chart-item img { max-width: 100%; height: auto; display: block; margin: 0 auto; }
              
              .pie-charts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
              .stacked-bar-charts-container { display: flex; flex-direction: column; }
              .stacked-bar-chart-page { page-break-after: always; padding: 20px; }
              .stacked-bar-chart-page:last-child { page-break-after: avoid; }
          </style>
      </head>
      <body>
          <div class="header">
              <h1>GoodGrants Applications Analysis Report</h1>
              <p class="date">Report Date: ${format(new Date(), 'MMMM do, yyyy')}</p>
          </div>
          
          <section class="report-section">
            <h2>Summary</h2>
            <table>
                <thead>
                    <tr><th>Metric</th><th>Value</th></tr>
                </thead>
                <tbody>
                    <tr><td>Total Applications</td><td>${totalApplications}</td></tr>
                    <tr><td>Last Sync</td><td>${lastSyncTime ? new Date(lastSyncTime).toLocaleString() : "N/A"}</td></tr>
                </tbody>
            </table>
          </section>

          <section class="report-section page-break">
              <h2>Application Growth Over Time</h2>
              <div class="chart-container">
                  <img src="${chartImages.line}" alt="Line Chart" style="width: 80%;">
              </div>
          </section>
          
          <section class="report-section page-break">
              <h2>All Stacked Bar Charts</h2>
              <div class="stacked-bar-charts-container">
                  ${chartImages.stackedBars.map((chart: any) => `
                    <div class="stacked-bar-chart-page">
                        <h3>${chart.title} Breakdown</h3>
                        <div class="chart-item">
                            <img src="${chart.img}" alt="${chart.title} Chart">
                        </div>
                    </div>
                  `).join('')}
              </div>
          </section>

          <section class="report-section page-break">
              <h2>All Pie Charts</h2>
              <div class="pie-charts">
                  ${chartImages.pies.map((chart: any) => `
                    <div class="chart-item">
                        <h3>${chart.title}</h3>
                        <img src="${chart.img}" alt="${chart.title} Chart">
                    </div>
                  `).join('')}
              </div>
          </section>
          
          <section class="report-section page-break">
            ${generateTableHtml("Division by Category", categoryPieData)}
            ${generateTableHtml("Division by Municipality", municipalityData)}
            ${generateTableHtml("Division by Challenge Statement", psCodeData)}
            ${generateTableHtml("Division by Age Range", ageRangeData)}
            ${generateTableHtml("Division by Gender", genderData)}
          </section>
      </body>
      </html>
    `;

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    page = await browser.newPage();

    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
    
    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="analytics-report.pdf"',
      },
    });

  } catch (error) {
    console.error("PDF generation failed:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}