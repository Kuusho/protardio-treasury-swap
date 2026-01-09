import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '~/lib/whitelist-supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    
    if (!fid) {
      return NextResponse.json(
        { success: false, error: 'FID required' },
        { status: 400 }
      );
    }
    
    let supabase;
    try {
      supabase = createServerClient();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Database not configured' },
        { status: 500 }
      );
    }
    
    const { data, error } = await supabase
      .from('registrations')
      .select('*')
      .eq('fid', parseInt(fid))
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Supabase error:', error);
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      isRegistered: !!data,
      registration: data || null,
    });
  } catch (error) {
    console.error('Check registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Check failed' },
      { status: 500 }
    );
  }
}
