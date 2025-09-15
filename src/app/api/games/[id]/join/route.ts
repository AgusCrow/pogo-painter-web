import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await request.json();
    const gameId = params.id;

    // Check if game exists and is waiting for players
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
        { error: 'Game is not accepting new players' },
        { status: 400 }
      );
    }

    if (game.players.length >= game.maxPlayers) {
      return NextResponse.json(
        { error: 'Game is full' },
        { status: 400 }
      );
    }

    // Check if user is already in the game
    const existingPlayer = game.players.find(p => p.userId === userId);
    if (existingPlayer) {
      return NextResponse.json(
        { error: 'User is already in this game' },
        { status: 400 }
      );
    }

    // Generate a random color for the player
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3'];
    const availableColors = colors.filter(color => 
      !game.players.some(p => p.color === color)
    );
    const playerColor = availableColors[Math.floor(Math.random() * availableColors.length)] || colors[0];

    // Create player
    const player = await db.player.create({
      data: {
        userId,
        gameId,
        color: playerColor,
        positionX: Math.floor(Math.random() * game.boardSize),
        positionY: Math.floor(Math.random() * game.boardSize)
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    // Initialize game tiles
    const tiles = [];
    for (let x = 0; x < game.boardSize; x++) {
      for (let y = 0; y < game.boardSize; y++) {
        tiles.push({
          gameId,
          x,
          y,
          hasPowerUp: Math.random() < 0.1, // 10% chance of power-up
          powerUpType: Math.random() < 0.1 ? ['SPEED', 'JUMP', 'SPRAY'][Math.floor(Math.random() * 3)] : null
        });
      }
    }

    await db.gameTile.createMany({
      data: tiles
    });

    return NextResponse.json(player, { status: 201 });
  } catch (error) {
    console.error('Error joining game:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}