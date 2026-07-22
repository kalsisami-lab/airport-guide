import { NextResponse } from 'next/server';
import { hasRealFlightKey } from '@/lib/flightApiKey';

export async function GET() {
  return NextResponse.json({
    hasFlightKey: hasRealFlightKey(process.env.FLIGHT_API_KEY),
  });
}
