// csv-uploader-include-callForIdea/components/GenerateReportButton.tsx

"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { FilteredAppRawData } from './LeaderboardBreakdowns';
import { generatePDFReport } from '@/actions/reportGeneration';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface GenerateReportButtonProps {
  filteredApps: FilteredAppRawData[];
  municipalityFilter: string;
  lastSyncTime: string | null;
  scoreSetName: string;
  disabled?: boolean;
}

export function GenerateReportButton({
  filteredApps,
  municipalityFilter,
  lastSyncTime,
  scoreSetName,
  disabled = false,
}: GenerateReportButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleGenerateReport = async () => {
    if (filteredApps.length === 0) {
      toast({
        title: "No Data",
        description: "No applications available to generate report.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      // Get processed data from server action
      const reportDataJson = await generatePDFReport({
        filteredApps,
        municipalityFilter,
        lastSyncTime,
        scoreSetName,
      });

      const reportData = JSON.parse(reportDataJson);

      // Generate PDF on client side
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;

      // Add logos (replace with actual base64 strings)
      // You can add your logos here:
      // doc.addImage('/tiller-logo.png', 'PNG', 15, 10, 30, 15);
      // doc.addImage('/giz-logo.png', 'PNG', pageWidth - 45, 10, 30, 15);

      // Title
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('INCLUDE Call for Ideas - Analytics Report', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      // Project description
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const projectDesc = 'The Call for Ideas in Chapainawabganj, Charghat, Gaibandha, and Sirajganj is an initiative of the Innovations for Climate-smart Urban Development in Bangladesh (INCLUDE) project to promote climate-smart, citizen-driven innovations at the local level. Implemented by the Deutsche Gesellschaft für Internationale Zusammenarbeit (GIZ) GmbH in collaboration with municipalities and supported by local and national stakeholders, this call invites residents and organizations to contribute practical, innovative ideas to tackle pressing climate change challenges.';
      const splitDesc = doc.splitTextToSize(projectDesc, pageWidth - 30);
      doc.text(splitDesc, 15, yPosition);
      yPosition += (splitDesc.length * 4) + 5;

      // Metadata
      doc.setFontSize(10);
      doc.text(`Report Generated: ${new Date(reportData.metadata.generatedAt).toLocaleString()}`, 15, yPosition);
      yPosition += 5;
      doc.text(`Data Last Synced: ${reportData.metadata.lastSyncTime !== 'N/A' ? new Date(reportData.metadata.lastSyncTime).toLocaleString() : 'N/A'}`, 15, yPosition);
      yPosition += 5;
      doc.text(`Score Set: ${reportData.metadata.scoreSetName}`, 15, yPosition);
      yPosition += 5;
      doc.text(`Municipality Filter: ${reportData.metadata.municipalityFilter}`, 15, yPosition);
      yPosition += 5;
      doc.text(`Total Applications: ${reportData.metadata.totalApplications}`, 15, yPosition);
      yPosition += 10;

      // 1. Score Distribution Table
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 20;
      }
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('1. Score Distribution Analysis', 15, yPosition);
      yPosition += 7;

      const scoreTableData = Object.entries(reportData.scoreDistribution).map(([category, count]:any) => [
        category,
        count.toString(),
        `${((count as number / reportData.metadata.totalApplications) * 100).toFixed(1)}%`
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [['Score Category', 'Count', 'Percentage']],
        body: scoreTableData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;

      // 2. Municipal Breakdown
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(14);
      doc.text('2. Applications by Municipality', 15, yPosition);
      yPosition += 7;

      const municipalTableData = Object.entries(reportData.municipalBreakdown)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .map(([muni, count]:any) => [
          muni,
          count.toString(),
          `${((count as number / reportData.metadata.totalApplications) * 100).toFixed(1)}%`
        ]);

      autoTable(doc, {
        startY: yPosition,
        head: [['Municipality', 'Count', 'Percentage']],
        body: municipalTableData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;

      // 3. Category Breakdown
      doc.addPage();
      yPosition = 20;

      doc.setFontSize(14);
      doc.text('3. Category Breakdown (Digital/Non-Digital)', 15, yPosition);
      yPosition += 7;

      const categoryTableData = Object.entries(reportData.categoryBreakdown)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .map(([cat, count]:any) => [
          cat,
          count.toString(),
          `${((count as number / reportData.metadata.totalApplications) * 100).toFixed(1)}%`
        ]);

      autoTable(doc, {
        startY: yPosition,
        head: [['Category', 'Count', 'Percentage']],
        body: categoryTableData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;

      // 4. Gender Breakdown
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(14);
      doc.text('4. Gender Distribution', 15, yPosition);
      yPosition += 7;

      const genderTableData = Object.entries(reportData.genderBreakdown)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .map(([gender, count]:any) => [
          gender,
          count.toString(),
          `${((count as number / reportData.metadata.totalApplications) * 100).toFixed(1)}%`
        ]);

      autoTable(doc, {
        startY: yPosition,
        head: [['Gender', 'Count', 'Percentage']],
        body: genderTableData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;

      // 5. Age Range Breakdown
      doc.addPage();
      yPosition = 20;

      doc.setFontSize(14);
      doc.text('5. Age Range Distribution', 15, yPosition);
      yPosition += 7;

      const ageOrder = ['< 18', '18-25-years', '26-35-years', '36-45-years', '46-55-years', '56-65-years', '> 65'];
      const ageTableData = ageOrder
        .filter(age => reportData.ageBreakdown[age])
        .map(age => [
          age,
          (reportData.ageBreakdown[age] || 0).toString(),
          `${(((reportData.ageBreakdown[age] || 0) / reportData.metadata.totalApplications) * 100).toFixed(1)}%`
        ]);

      autoTable(doc, {
        startY: yPosition,
        head: [['Age Range', 'Count', 'Percentage']],
        body: ageTableData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;

      // 6. Challenge Statement Breakdown
      doc.addPage();
      yPosition = 20;

      doc.setFontSize(14);
      doc.text('6. Challenge Statement Distribution', 15, yPosition);
      yPosition += 7;

      const psCodeTableData = Object.entries(reportData.psCodeBreakdown)
        .sort((a, b) => {
          const regex = /^([a-z]+)-ps-(\d+)$/i;
          const aMatch = a[0].match(regex);
          const bMatch = b[0].match(regex);
          if (aMatch && bMatch) {
            const aPrefix = aMatch[1];
            const bPrefix = bMatch[1];
            if (aPrefix !== bPrefix) return aPrefix.localeCompare(bPrefix);
            return parseInt(aMatch[2], 10) - parseInt(bMatch[2], 10);
          }
          return a[0].localeCompare(b[0]);
        })
        .map(([psCode, count]:any) => [
          psCode,
          count.toString(),
          `${((count as number / reportData.metadata.totalApplications) * 100).toFixed(1)}%`
        ]);

      autoTable(doc, {
        startY: yPosition,
        head: [['Challenge Statement', 'Count', 'Percentage']],
        body: psCodeTableData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
      });

      // Save PDF
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      doc.save(`INCLUDE_Analytics_Report_${timestamp}.pdf`);

      toast({
        title: "Report Generated",
        description: "Your PDF report has been downloaded successfully.",
      });

    } catch (error: any) {
      console.error("Error generating report:", error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate PDF report.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={handleGenerateReport}
      disabled={disabled || isGenerating || filteredApps.length === 0}
      variant="outline"
    >
      {isGenerating ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <FileText className="mr-2 h-4 w-4" />
      )}
      {isGenerating ? "Generating..." : "Generate Report"}
    </Button>
  );
}