# GoodGrants CSV Bulk Uploader

This is a full-stack **Next.js** application designed to streamline the process of submitting large volumes of application data from a CSV file to the **GoodGrants API**.  
It provides a robust, user-friendly interface for managing the upload process, handling errors, and maintaining a complete history of all submissions.

---

## 🚀 Features

- **Client-Side Upload**:  
  A modern, responsive UI allows users to easily upload CSV files.

- **Server-Side Parsing**:  
  Leveraging **Next.js Server Actions** and the `csv-parser` library, the application performs robust data parsing on the server, efficiently handling large files and complex data formats (including commas within quoted strings).  
  It also automatically detects and ignores blank rows.

- **Dynamic Data Transformation**:  
  The application intelligently transforms CSV data to match the required API payload. Key transformations include:
  - Normalizing phone number formats (e.g., `0161...` → `+880161...`).
  - Standardizing age ranges (e.g., `2635years` → `26 - 35 years`).
  - Dynamically mapping challenge statement fields based on a user-confirmed municipality.

- **Batch Processing with Confirmation**:  
  To prevent timeouts and improve control, applications are divided into **batches of 20**. Users must confirm each batch before it is submitted to the API.

- **Comprehensive Error Handling**:  
  - Batches with **3 or fewer failed applications** are automatically saved to a dedicated database table.  
  - Batches with **more than 3 errors** require user confirmation before failed records are stored.

- **Persistent History**:  
  All processing data, including the original CSV file and processing logs, is stored in a **Neon PostgreSQL** database.

- **"Failed Submissions" Management**:  
  A dedicated tab allows users to:
  - View all failed applications.  
  - Export them to CSV for review.  
  - Mark failed records as resolved.  

---

## 🛠️ Technology Stack

- **Frontend**: Next.js, React, Shadcn/ui  
- **Backend**: Next.js Server Actions  
- **Database**: Neon (PostgreSQL) with `@vercel/postgres`  
- **Data Processing**: `csv-parser`, `csv-writer`  
- **Language**: TypeScript  

---

## ⚙️ Setup and Installation

### 1. Clone the repository
```bash
git clone https://github.com/shaibalsharif/csv-uploader-include-callForIdea.git
cd csv-uploader-include-callForIdea
```
### 2. Install dependencies
```bash
Copy code
npm install
```
### 3. Configure environment variables
Create a .env.local file in the root directory and add:

```bash
.env
POSTGRES_URL="<your_neon_database_connection_string>"
GOODGRANTS_API_KEY="<your_goodgrants_api_key>"
GOODGRANTS_BASE_URL="<your_goodgrants_base_url>"
GOODGRANTS_FORM_SLUG="<your_goodgrants_form_slug>"
GOODGRANTS_APPLICANT_SLUG="<your_goodgrants_applicant_slug>"
```
### 4. Run database migrations
Apply the schema to your Neon/Postgres database:

```bash
psql $POSTGRES_URL -f scripts/001_create_tables.sql
psql $POSTGRES_URL -f scripts/002_add_failed_submissions_table.sql
```
### 5. Run the application
```bash
Copy code
npm run dev
The app will be available at:
👉 http://localhost:3000
```