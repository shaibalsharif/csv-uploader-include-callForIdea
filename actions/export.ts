// "use server";

// import { getApplicationDetails } from './application';

// // --- Export Server Actions ---

// export async function exportApplications(
//   config: { apiKey: string }, 
//   slugs: string[], 
//   format: 'csv' | 'xlsx' | 'pdf'
// ): Promise<{ success: boolean; data?: string | Blob; filename?: string; error?: string }> {
  
//   try {
//     // Fetch all application details
//     const applications = await Promise.all(
//       slugs.map(slug => getApplicationDetails(config, slug))
//     );

//     if (format === 'csv') {
//       return exportAsCSV(applications, slugs.length > 1);
//     } else if (format === 'xlsx') {
//       return exportAsXLSX(applications, slugs.length > 1);
//     } else if (format === 'pdf') {
//       return exportAsPDF(applications, slugs.length > 1);
//     }

//     return { success: false, error: 'Invalid format specified' };
//   } catch (error: any) {
//     return { success: false, error: error.message || 'Export failed' };
//   }
// }

// function exportAsCSV(applications: any[], isMultiple: boolean) {
//   const headers = ['Title', 'Applicant Name', 'Email', 'Status', 'Tags', 'Updated'];
//   const allFieldLabels = new Set<string>();
  
//   // Collect all unique field labels
//   applications.forEach(app => {
//     app.application_fields?.forEach((field: any) => {
//       const label = field.label?.en_GB?.replace('*', '') || field.slug;
//       if (label) allFieldLabels.add(label);
//     });
//   });
  
//   const finalHeaders = [...headers, ...Array.from(allFieldLabels)];
  
//   const rows = applications.map(app => {
//     const row: Record<string, any> = {
//       'Title': app.title,
//       'Applicant Name': app.applicant.name,
//       'Email': app.applicant.email,
//       'Status': app.status,
//       'Tags': app.tags || '',
//       'Updated': new Date(app.updated).toLocaleString(),
//     };
    
//     // Add application field values
//     app.application_fields?.forEach((field: any) => {
//       const label = field.label?.en_GB?.replace('*', '') || field.slug;
//       if (label) {
//         let value = field.value;
//         if (typeof value === 'object' && value !== null) {
//           value = value.en || JSON.stringify(value);
//         }
//         row[label] = value || '';
//       }
//     });
    
//     return finalHeaders.map(header => {
//       const value = row[header] || '';
//       // Escape CSV values that contain commas, quotes, or newlines
//       if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
//         return `"${value.replace(/"/g, '""')}"`;
//       }
//       return value;
//     });
//   });
  
//   const csvContent = [finalHeaders, ...rows]
//     .map(row => row.join(','))
//     .join('\n');
  
//   const filename = isMultiple ? 'applications.csv' : `${applications[0].slug}.csv`;
  
//   return {
//     success: true,
//     data: new Blob([csvContent], { type: 'text/csv' }),
//     filename
//   };
// }

// function exportAsXLSX(applications: any[], isMultiple: boolean) {
//   // For XLSX, we'll return structured data that the client can process
  
//   const dataToExport = applications.map(app => {
//     const row: Record<string, any> = {
//       'Title': app.title,
//       'Applicant Name': app.applicant.name,
//       'Email': app.applicant.email,
//       'Status': app.status,
//       'Tags': app.tags || '',
//       'Updated': new Date(app.updated).toLocaleString(),
//     };
    
//     app.application_fields?.forEach((field: any) => {
//       const label = field.label?.en_GB?.replace('*', '') || field.slug;
//       if (label) {
//         let value = field.value;
//         if (typeof value === 'object' && value !== null) {
//           value = value.en || JSON.stringify(value);
//         }
//         row[label] = value || '';
//       }
//     });
    
//     return row;
//   });
  
//   const filename = isMultiple ? 'applications.xlsx' : `${applications[0].slug}.xlsx`;
  
//   return {
//     success: true,
//     data: JSON.stringify(dataToExport), // Client will process this
//     filename
//   };
// }

// function exportAsPDF(applications: any[], isMultiple: boolean) {
//   // For PDF, we'll return structured data that the client can process
  
//   const pdfData = applications.map(app => ({
//     title: app.title,
//     applicant: {
//       name: app.applicant.name,
//       email: app.applicant.email
//     },
//     status: app.status,
//     tags: app.tags || '',
//     updated: new Date(app.updated).toLocaleString(),
//     fields: app.application_fields?.map((field: any) => ({
//       label: field.label?.en_GB?.replace('*', '') || field.slug,
//       value: typeof field.value === 'object' && field.value !== null 
//         ? field.value.en || JSON.stringify(field.value)
//         : field.value || ''
//     })) || [],
//     slug: app.slug
//   }));
  
//   return {
//     success: true,
//     data: JSON.stringify(pdfData),
//     filename: isMultiple ? 'applications' : applications[0].slug // Client will add .pdf or .zip
//   };
// }
