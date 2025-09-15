import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { count = 1 } = await request.json();
    const gameId = params.id;

    // Get the game with players
    const game = await db.game.findUnique({
      where: { id: gameId },
      include: { players: true }
    });

    if (!game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    if (game.status !== 'WAITING') {
      return NextResponse.json(
        { error: 'Cannot add AI players to a game in progress' },
        { status: 400 }
      );
    }

    const currentPlayers = game.players.length;
    const availableSlots = game.maxPlayers - currentPlayers;
    const aiPlayersToAdd = Math.min(count, availableSlots);

    if (aiPlayersToAdd <= 0) {
      return NextResponse.json(
        { error: 'No available slots for AI players' },
        { status: 400 }
      );
    }

    const aiColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3'];
    const usedColors = game.players.map(p => p.color);
    const availableColors = aiColors.filter(color => !usedColors.includes(color));

    const aiPlayers = [];

    for (let i = 0; i < aiPlayersToAdd; i++) {
      const color = availableColors[i] || aiColors[i % aiColors.length];
      
      // Create AI player
      const aiPlayer = await db.player.create({
        data: {
          userId: `ai-${gameId}-${i}`, // Dummy user ID for AI
          gameId,
          color,
          positionX: Math.floor(Math.random() * game.boardSize),
          positionY: Math.floor(Math.random() * game.boardSize),
          isAI: true
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

      aiPlayers.push(aiPlayer);
    }

    return NextResponse.json({
      message: `Added ${aiPlayersToAdd} AI players`,
      aiPlayers
    });
  } catch (error) {
    console.error('Error adding AI players:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}