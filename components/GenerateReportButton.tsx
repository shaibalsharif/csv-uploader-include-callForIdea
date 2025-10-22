"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import type { FilteredAppRawData } from '@/components/LeaderboardBreakdowns';
import { generatePDFReport } from '@/actions/reportGeneration';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GIZ_LOGO_BASE64, TILLER_LOGO_BASE64 } from '@/lib/logo-base64';

// --- Type Definitions ---
interface GenerateReportButtonProps {
    filteredApps: FilteredAppRawData[];
    municipalityFilter: string;
    challengeStatementFilter: string; // NEW PROP
    lastSyncTime: string | null;
    scoreSetName: string;
    minScore: string;
    maxScore: string;
    skipScoreDistribution: boolean; // NEW PROP for conditional PDF content
    disabled?: boolean;
}

// --- Main Component ---
export function GenerateReportButton({
    filteredApps,
    municipalityFilter,
    challengeStatementFilter, // NEW
    lastSyncTime,
    scoreSetName,
    minScore,
    maxScore,
    skipScoreDistribution, // NEW
    disabled = false,
}: GenerateReportButtonProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const { toast } = useToast();

    const handleGenerateReport = async () => {
        if (filteredApps.length === 0) {
            toast({ title: "No Data", description: "No applications available to generate report.", variant: "destructive" });
            return;
        }
        setIsGenerating(true);
        try {
            // Updated call to backend report generation action
            const reportDataJson = await generatePDFReport({ 
                filteredApps, 
                municipalityFilter, 
                challengeStatementFilter, // PASS NEW FILTER
                lastSyncTime, 
                scoreSetName, 
                minScore, 
                maxScore 
            });
            const reportData = JSON.parse(reportDataJson);
            
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            let yPosition = 15;

            // --- Header ---
            const logoWidth = 30;

            // Tiller Logo (aspect ratio preserved)
            const tillerImgProps = doc.getImageProperties(TILLER_LOGO_BASE64);
            const tillerHeight = (tillerImgProps.height * logoWidth) / tillerImgProps.width;
            doc.addImage(TILLER_LOGO_BASE64, 'PNG', 15, 10, logoWidth, tillerHeight);
            
            // GIZ Logo (aspect ratio preserved)
            const gizImgProps = doc.getImageProperties(GIZ_LOGO_BASE64);
            const gizHeight = (gizImgProps.height * logoWidth) / gizImgProps.width;
            doc.addImage(GIZ_LOGO_BASE64, 'PNG', pageWidth - 45, 10, logoWidth, gizHeight);
            
            // Set yPosition dynamically below the tallest logo
            yPosition = 10 + Math.max(tillerHeight, gizHeight) + 10;
            
            doc.setFontSize(18).setFont('helvetica', 'bold').text('INCLUDE Call for Ideas - Analytics Report', pageWidth / 2, yPosition, { align: 'center' });
            yPosition += 10;
            
            // --- Metadata ---
            doc.setFontSize(10).setFont('helvetica', 'normal');
            doc.text(`Report Generated: ${new Date(reportData.metadata.generatedAt).toLocaleString()}`, 15, yPosition);
            yPosition += 6;
            doc.text(`Score Set: ${reportData.metadata.scoreSetName}`, 15, yPosition);
            yPosition += 6;
            doc.text(`Municipality Filter: ${reportData.metadata.municipalityFilter}`, 15, yPosition);
            yPosition += 6;
            if (reportData.metadata.challengeStatementFilter && reportData.metadata.challengeStatementFilter !== 'all' && reportData.metadata.challengeStatementFilter !== '') { doc.text(`Challenge Statement Filter: ${reportData.metadata.challengeStatementFilter}`, 15, yPosition); yPosition += 6; }
            if (reportData.metadata.minScore) { doc.text(`Minimum Score: ${reportData.metadata.minScore}`, 15, yPosition); yPosition += 6; }
            if (reportData.metadata.maxScore) { doc.text(`Maximum Score: ${reportData.metadata.maxScore}`, 15, yPosition); yPosition += 6; }
            doc.setFont('helvetica', 'bold').text(`Total Applications in Filter: ${reportData.metadata.totalApplications}`, 15, yPosition);
            yPosition += 12;

            // --- PDF Generation Helpers ---
            const drawHorizontalBarChart = (title: string, data: { label: string; value: number }[]): void => {
                const margin = 15, barHeight = 7, barPadding = 3, labelAreaWidth = 80; // Increased label area width
                const chartHeight = (barHeight + barPadding) * data.length + 15;
                if (yPosition + chartHeight > pageHeight - 15) { doc.addPage(); yPosition = 20; }
                
                doc.setFontSize(12).setFont('helvetica', 'bold').text(title, margin, yPosition);
                yPosition += 10;
                
                const chartAreaWidth = pageWidth - margin * 2 - labelAreaWidth - 5;
                const maxValue = Math.max(1, ...data.map(d => d.value));
                const scale = chartAreaWidth / maxValue;
                
                doc.setFontSize(8).setFont('helvetica', 'normal');
                data.forEach((item, index) => {
                    const currentY = yPosition + (index * (barHeight + barPadding));
                    // Check if label is long and increase label area width dynamically if necessary
                    const effectiveLabelAreaWidth = Math.min(pageWidth / 3, Math.max(80, item.label.length * 1.5));
                    const labelLines = doc.splitTextToSize(item.label, effectiveLabelAreaWidth - 2);
                    doc.text(labelLines, margin, currentY + barHeight / 2, { verticalAlign: 'middle' });
                    doc.setFillColor(79, 132, 196).rect(margin + effectiveLabelAreaWidth, currentY, item.value * scale * (80 / effectiveLabelAreaWidth), barHeight, 'F'); // Adjust bar scale if label area changed
                    doc.text(item.value.toString(), margin + effectiveLabelAreaWidth + (item.value * scale * (80 / effectiveLabelAreaWidth)) + 2, currentY + barHeight / 2, { verticalAlign: 'middle' });
                });
                yPosition += chartHeight;
            };
            
            let sectionCount = 1; // Start counter for dynamic numbering

            const addSection = (title: string, tableData: (string | number)[][], head: string[][], chartData: { label: string; value: number }[]) => {
                const currentTitle = `${sectionCount++}. ${title}`; // Use and increment counter
                if (yPosition > pageHeight - 80) { doc.addPage(); yPosition = 20; }
                doc.setFontSize(14).setFont('helvetica', 'bold').text(currentTitle, 15, yPosition);
                yPosition += 8;
                autoTable(doc, { startY: yPosition, head, body: tableData, theme: 'grid', headStyles: { fillColor: [41, 128, 185] } });
                yPosition = (doc as any).lastAutoTable.finalY + 10;
                if (chartData.length > 0) {
                    drawHorizontalBarChart(`${title} - Chart`, chartData);
                }
            };
            
            const totalApps = reportData.metadata.totalApplications;
            const getTableData = (data: Record<string, number>) => Object.entries(data).map(([key, count]) => [key, count.toString(), `${totalApps > 0 ? ((count / totalApps) * 100).toFixed(1) : 0}%`]).sort((a,b) => Number(b[1]) - Number(a[1]));
            const transformForChart = (dataObject: Record<string, number>) => Object.entries(dataObject).map(([label, value]) => ({ label, value })).sort((a,b) => b.value - a.value);

            // --- Content Sections ---
            
            // 1. Score Distribution (CONDITIONAL)
            if (!skipScoreDistribution) {
                addSection('Score Distribution', getTableData(reportData.scoreDistribution).sort((a,b) => String(a[0]).localeCompare(String(b[0]))), [['Score Category', 'Count', 'Percentage']], transformForChart(reportData.scoreDistribution));
            } else {
                sectionCount++; // Still reserve the number for subsequent sections to start correctly if 1 is skipped
                doc.setFontSize(12).setFont('helvetica', 'bold').text("1. Score Distribution: Skipped due to Min/Max Score filter.", 15, yPosition);
                yPosition += 10;
            }

            // 2. Municipality Distribution
            addSection('Municipality Distribution', getTableData(reportData.municipalBreakdown), [['Municipality', 'Count', 'Percentage']], transformForChart(reportData.municipalBreakdown));
            
            // 3. Category (Digital/Non-Digital)
            addSection('Category (Digital/Non-Digital)', getTableData(reportData.categoryBreakdown), [['Category', 'Count', 'Percentage']], transformForChart(reportData.categoryBreakdown));
            
            // 4. Gender Distribution
            addSection('Gender Distribution', getTableData(reportData.genderBreakdown), [['Gender', 'Count', 'Percentage']], transformForChart(reportData.genderBreakdown));
            
            // 5. Age Range Distribution
            const ageOrder = ['< 18', '18-25-years', '26-35-years', '36-45-years', '46-55-years', '56-65-years', '> 65'];
            const ageTableData = ageOrder.filter(age => reportData.ageBreakdown[age]).map(age => [age, (reportData.ageBreakdown[age] || 0).toString(), `${totalApps > 0 ? (((reportData.ageBreakdown[age] || 0) / totalApps) * 100).toFixed(1) : 0}%`]);
            const ageChartData = ageOrder.filter(age => reportData.ageBreakdown[age]).map(age => ({ label: age, value: reportData.ageBreakdown[age] || 0 }));
            addSection('Age Range Distribution', ageTableData, [['Age Range', 'Count', 'Percentage']], ageChartData);
            
            // 6. Challenge Statement Distribution
            const psCodeBreakdown = reportData.psCodeBreakdown;
            const psTableData = Object.entries(psCodeBreakdown)
                .filter(([key]) => key !== 'N/A') // Filter out N/A entries for clean display
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([key, count]) => [key, (count as number).toString(), `${totalApps > 0 ? (((count as number) / totalApps) * 100).toFixed(1) : 0}%`]);
            const psChartData = Object.entries(psCodeBreakdown)
                .filter(([key]) => key !== 'N/A')
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([label, value]) => ({ label, value: value as number }));

            addSection('Challenge Statement Distribution', psTableData, [['Challenge Statement', 'Count', 'Percentage']], psChartData);


            // --- Save ---
            doc.save(`INCLUDE_Analytics_Report_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.pdf`);
            toast({ title: "Report Generated", description: "PDF report has been downloaded." });

        } catch (error: any) {
            console.error("Error generating report:", error);
            toast({ title: "Generation Failed", description: error.message || "Failed to generate PDF report.", variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    };

    return <Button onClick={handleGenerateReport} disabled={disabled || isGenerating} variant="outline"><FileText className="mr-2 h-4 w-4" />{isGenerating ? "Generating..." : "Generate Report"}</Button>;
}