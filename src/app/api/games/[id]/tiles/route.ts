import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const gameId = params.id;

    const tiles = await db.gameTile.findMany({
      where: { gameId },
      orderBy: [
        { y: 'asc' },
        { x: 'asc' }
      ]
    });

    return NextResponse.json(tiles);
  } catch (error) {
    console.error('Error fetching tiles:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}