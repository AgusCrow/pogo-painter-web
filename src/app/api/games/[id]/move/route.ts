import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { playerId, x, y } = await request.json();
    const gameId = params.id;

    // Get the game with players and tiles
    const game = await db.game.findUnique({
      where: { id: gameId },
      include: {
        players: true,
        tiles: true
      }
    });

    if (!game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    if (game.status !== 'PLAYING') {
      return NextResponse.json(
        { error: 'Game is not in progress' },
        { status: 400 }
      );
    }

    // Find the player making the move
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }

    if (player.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Player cannot move right now' },
        { status: 400 }
      );
    }

    // Check if the move is valid (adjacent tiles including diagonals)
    const dx = Math.abs(x - player.positionX);
    const dy = Math.abs(y - player.positionY);
    const isValidMove = (dx === 1 && dy === 0) || (dx === 0 && dy === 1) || (dx === 1 && dy === 1);

    if (!isValidMove) {
      return NextResponse.json(
        { error: 'Invalid move' },
        { status: 400 }
      );
    }

    // Check if the target position is within bounds
    if (x < 0 || x >= game.boardSize || y < 0 || y >= game.boardSize) {
      return NextResponse.json(
        { error: 'Move out of bounds' },
        { status: 400 }
      );
    }

    // Check for collision with other players
    const targetPlayer = game.players.find(p => p.positionX === x && p.positionY === y && p.id !== playerId);
    if (targetPlayer) {
      // Stun the target player
      await db.player.update({
        where: { id: targetPlayer.id },
        data: { status: 'STUNNED' }
      });

      // Set timeout to unstun the player (3 seconds)
      setTimeout(async () => {
        await db.player.update({
          where: { id: targetPlayer.id },
          data: { status: 'ACTIVE' }
        });
      }, 3000);
    }

    // Update player position
    const updatedPlayer = await db.player.update({
      where: { id: playerId },
      data: { positionX: x, positionY: y }
    });

    // Paint the tile and handle power-ups
    const targetTile = game.tiles.find(t => t.x === x && t.y === y);
    let newScore = player.score;
    let powerUpCollected = null;

    if (targetTile) {
      // Only increase score if painting a new tile or repainting an opponent's tile
      if (!targetTile.color || targetTile.color !== player.color) {
        newScore += 1;
      }

      // Check for power-up
      if (targetTile.hasPowerUp) {
        powerUpCollected = targetTile.powerUpType;
        
        // Apply power-up effects
        switch (targetTile.powerUpType) {
          case 'SPEED':
            // Speed power-up: bonus points
            newScore += 2;
            break;
          case 'JUMP':
            // Jump power-up: bonus points
            newScore += 2;
            break;
          case 'SPRAY':
            // Spray power-up: paint adjacent tiles too
            const adjacentTiles = game.tiles.filter(t => 
              Math.abs(t.x - x) <= 1 && 
              Math.abs(t.y - y) <= 1 && 
              !(t.x === x && t.y === y)
            );
            
            for (const tile of adjacentTiles) {
              await db.gameTile.update({
                where: { id: tile.id },
                data: { color: player.color }
              });
              newScore += 1; // Bonus point for each spray-painted tile
            }
            break;
        }
      }

      // Update the tile
      await db.gameTile.update({
        where: { id: targetTile.id },
        data: { 
          color: player.color,
          // Remove power-up if present
          hasPowerUp: false,
          powerUpType: null
        }
      });
    }

    // Update player score
    await db.player.update({
      where: { id: playerId },
      data: { score: newScore }
    });

    // Get the updated game state
    const updatedGame = await db.game.findUnique({
      where: { id: gameId },
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

    // Add some random power-ups to the board (10% chance per move)
    if (Math.random() < 0.1) {
      const emptyTiles = updatedGame?.tiles.filter(t => !t.color && !t.hasPowerUp) || [];
      if (emptyTiles.length > 0) {
        const randomTile = emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
        const powerUpTypes = ['SPEED', 'JUMP', 'SPRAY'];
        const randomPowerUp = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
        
        await db.gameTile.update({
          where: { id: randomTile.id },
          data: {
            hasPowerUp: true,
            powerUpType: randomPowerUp
          }
        });
      }
    }

    return NextResponse.json({
      ...updatedGame,
      powerUpCollected
    });
  } catch (error) {
    console.error('Error making move:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}