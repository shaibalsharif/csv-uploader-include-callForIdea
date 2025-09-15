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