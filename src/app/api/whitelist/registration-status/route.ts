import { NextResponse } from 'next/server';
import { createServerClient } from '~/lib/whitelist-supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cap = parseInt(process.env.REGISTRATION_CAP || '0');
    const currentPhase = process.env.NEXT_PUBLIC_CURRENT_PHASE || 'phase1_tier3';
    
    let supabase;
    try {
      supabase = createServerClient();
    } catch {
      // If DB not configured, return unlimited
      return NextResponse.json({
        success: true,
        count: 0,
        cap: cap,
        isFull: false,
        spotsRemaining: cap || null,
        phase: currentPhase,
      });
    }
    
    // Count current registrations for this phase
    const { count, error } = await supabase
      .from('registrations')
      .select('*', { count: 'exact', head: true })
      .eq('tier', currentPhase);
    
    if (error) {
      console.error('Error counting registrations:', error);
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      );
    }
    
    const currentCount = count || 0;
    const isFull = cap > 0 && currentCount >= cap;
    const spotsRemaining = cap > 0 ? Math.max(0, cap - currentCount) : null;
    
    return NextResponse.json({
      success: true,
      count: currentCount,
      cap: cap,
      isFull: isFull,
      spotsRemaining: spotsRemaining,
      phase: currentPhase,
    });
  } catch (error) {
    console.error('Registration status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get status' },
      { status: 500 }
    );
  }
}
