import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hasFlightKey: !!process.env.FLIGHT_API_KEY,
  });
}
