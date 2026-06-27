#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const bucket = process.env.SIGNAL_ART_STORAGE_BUCKET || 'pythh-art';

const { data: existing } = await supabase.storage.getBucket(bucket);
if (existing) {
  console.log(`✅ Bucket "${bucket}" already exists (public=${existing.public}).`);
  process.exit(0);
}

const { data, error } = await supabase.storage.createBucket(bucket, {
  public: true,
  fileSizeLimit: 5 * 1024 * 1024,
  allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
});

if (error) {
  console.error('createBucket error:', error.message);
  process.exit(1);
}

console.log(`✅ Created public bucket "${bucket}":`, JSON.stringify(data));
