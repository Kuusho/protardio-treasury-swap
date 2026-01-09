#!/usr/bin/env npx tsx
/**
 * Export Registrations to CSV
 * 
 * This script exports all records from the registrations table to a CSV file.
 * It handles Supabase's pagination to fetch all records (even if > 1000).
 * 
 * Usage:
 *   npx tsx tools/export-to-csv.ts
 * 
 * Output: exports/registrations_YYYYMMDD_HHMMSS.csv
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Load environment variables from .env and .env.local
config({ path: '.env' });
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface Registration {
  id?: string;
  fid: number;
  username: string;
  wallet_address: string;
  neynar_score: number;
  follows_protardio: boolean;
  has_shared: boolean;
  registered_at: string;
  tier: string;
  status: string;
  verification_notes?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Escape a value for CSV format
 */
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  let str: string;
  if (typeof value === 'object') {
    str = JSON.stringify(value);
  } else if (typeof value === 'boolean') {
    str = value ? 'true' : 'false';
  } else {
    str = String(value);
  }
  
  // If the value contains commas, quotes, or newlines, wrap it in quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    // Escape existing quotes by doubling them
    str = str.replace(/"/g, '""');
    return `"${str}"`;
  }
  
  return str;
}

/**
 * Fetch all records from registrations with pagination
 */
async function fetchAllRecords(): Promise<Registration[]> {
  const allRecords: Registration[] = [];
  const PAGE_SIZE = 1000;
  let offset = 0;
  let hasMore = true;
  
  console.log('📊 Fetching records from registrations...');
  
  while (hasMore) {
    const { data, error, count } = await supabase
      .from('registrations')
      .select('*', { count: 'exact' })
      .range(offset, offset + PAGE_SIZE - 1)
      .order('registered_at', { ascending: true });
    
    if (error) {
      console.error('❌ Error fetching records:', error);
      throw error;
    }
    
    if (data && data.length > 0) {
      allRecords.push(...(data as Registration[]));
      console.log(`   Fetched ${allRecords.length} / ${count || '?'} records...`);
      offset += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }
  
  console.log(`✅ Total records fetched: ${allRecords.length}`);
  return allRecords;
}

/**
 * Convert records to CSV format
 */
function toCSV(records: Registration[]): string {
  if (records.length === 0) {
    return '';
  }
  
  // Define the columns we want to export
  const columns: (keyof Registration)[] = [
    'id',
    'fid',
    'username',
    'wallet_address',
    'neynar_score',
    'follows_protardio',
    'has_shared',
    'registered_at',
    'tier',
    'status',
    'verification_notes',
    'created_at',
    'updated_at',
  ];
  
  // Create header row
  const header = columns.join(',');
  
  // Create data rows
  const rows = records.map(record => {
    return columns.map(col => escapeCSV(record[col])).join(',');
  });
  
  return [header, ...rows].join('\n');
}

/**
 * Main export function
 */
async function main() {
  console.log('🚀 Registrations CSV Exporter\n');
  
  try {
    // Fetch all records
    const records = await fetchAllRecords();
    
    if (records.length === 0) {
      console.log('⚠️ No records found in the database.');
      return;
    }
    
    // Convert to CSV
    const csv = toCSV(records);
    
    // Create exports directory if it doesn't exist
    const exportsDir = join(process.cwd(), 'exports');
    if (!existsSync(exportsDir)) {
      mkdirSync(exportsDir, { recursive: true });
    }
    
    // Generate filename with timestamp
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '_')
      .split('.')[0];
    const filename = `registrations_${timestamp}.csv`;
    const filepath = join(exportsDir, filename);
    
    // Write CSV file
    writeFileSync(filepath, csv, 'utf-8');
    
    console.log(`\n✅ Export complete!`);
    console.log(`📁 File: ${filepath}`);
    console.log(`📊 Records: ${records.length}`);
    console.log(`📏 Size: ${(csv.length / 1024).toFixed(2)} KB`);
    
  } catch (error) {
    console.error('\n❌ Export failed:', error);
    process.exit(1);
  }
}

// Run the export
main();
