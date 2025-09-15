import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const gameId = params.id;

    // Get the game with players
    const game = await db.game.findUnique({
      where: { id: gameId },
      include: {
        players: true
      }
    });

    if (!game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    if (game.status !== 'WAITING') {
      return NextResponse.json(
        { error: 'Game is already started or finished' },
        { status: 400 }
      );
    }

    if (game.players.length < 2) {
      return NextResponse.json(
        { error: 'Need at least 2 players to start the game' },
        { status: 400 }
      );
    }

    // Update game status to PLAYING
    const updatedGame = await db.game.update({
      where: { id: gameId },
      data: { status: 'PLAYING' },
      include: {
        players: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true
              }
            }
          }
        },
        tiles: true
      }
    });

    // Set game timeout
    setTimeout(async () => {
      try {
        await db.game.update({
          where: { id: gameId },
          data: { status: 'FINISHED' }
        });
      } catch (error) {
        console.error('Error finishing game:', error);
      }
    }, game.timeLimit * 1000);

    return NextResponse.json(updatedGame);
  } catch (error) {
    console.error('Error starting game:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}