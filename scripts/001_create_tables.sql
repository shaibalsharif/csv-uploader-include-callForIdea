CREATE TABLE IF NOT EXISTS processing_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  file_name VARCHAR(500) NOT NULL,
  original_csv_content TEXT NOT NULL,
  processing_mode VARCHAR(50) NOT NULL,
  config_form_slug VARCHAR(255) NOT NULL,
  config_applicant_slug VARCHAR(255) NOT NULL,
  total_applications INTEGER NOT NULL DEFAULT 0,
  completed_applications INTEGER NOT NULL DEFAULT 0,
  error_applications INTEGER NOT NULL DEFAULT 0,
  skipped_applications INTEGER NOT NULL DEFAULT 0,
  logs JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS batch_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES processing_batches(id) ON DELETE CASCADE,
  application_id VARCHAR(255),
  title VARCHAR(500) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  data JSONB NOT NULL,
  tags TEXT[] DEFAULT '{}',
  error_message TEXT
);

-- This table will store a copy of your GoodGrants application data for fast queries.
CREATE TABLE IF NOT EXISTS goodgrants_applications (
    slug VARCHAR(255) PRIMARY KEY, -- The unique slug from GoodGrants is the primary key
    title TEXT,
    status VARCHAR(100),
    applicant_name VARCHAR(255),
    applicant_email VARCHAR(255),
    tags TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    category JSONB, -- To store category details
    raw_fields JSONB -- Stores the entire 'application_fields' array as JSON
);

-- This table logs the last successful run time of our cron job.
CREATE TABLE IF NOT EXISTS cron_job_logs (
    id SERIAL PRIMARY KEY,
    job_name VARCHAR(255) UNIQUE NOT NULL,
    last_run_at TIMESTAMPTZ,
    status VARCHAR(50),
    details TEXT
);

-- Initialize the log for our specific job so we can update it later.
INSERT INTO cron_job_logs (job_name) VALUES ('sync-goodgrants-applications') ON CONFLICT (job_name) DO NOTHING;
