import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Get all active games with AI players
    const activeGames = await db.game.findMany({
      where: { 
        status: 'PLAYING'
      },
      include: {
        players: {
          where: { isAI: true, status: 'ACTIVE' },
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

    const movesMade = [];

    for (const game of activeGames) {
      for (const aiPlayer of game.players) {
        // AI decision making logic
        const move = calculateAIMove(aiPlayer, game);
        
        if (move) {
          // Make the move using the existing move endpoint logic
          const targetTile = game.tiles.find(t => t.x === move.x && t.y === move.y);
          let newScore = aiPlayer.score;

          // Update player position
          await db.player.update({
            where: { id: aiPlayer.id },
            data: { positionX: move.x, positionY: move.y }
          });

          // Paint the tile and handle power-ups
          if (targetTile) {
            // Only increase score if painting a new tile or repainting an opponent's tile
            if (!targetTile.color || targetTile.color !== aiPlayer.color) {
              newScore += 1;
            }

            // Check for power-up
            if (targetTile.hasPowerUp) {
              // Apply power-up effects
              switch (targetTile.powerUpType) {
                case 'SPEED':
                case 'JUMP':
                  newScore += 2;
                  break;
                case 'SPRAY':
                  // Spray power-up: paint adjacent tiles too
                  const adjacentTiles = game.tiles.filter(t => 
                    Math.abs(t.x - move.x) <= 1 && 
                    Math.abs(t.y - move.y) <= 1 && 
                    !(t.x === move.x && t.y === move.y)
                  );
                  
                  for (const tile of adjacentTiles) {
                    await db.gameTile.update({
                      where: { id: tile.id },
                      data: { color: aiPlayer.color }
                    });
                    newScore += 1;
                  }
                  break;
              }
            }

            // Update the tile
            await db.gameTile.update({
              where: { id: targetTile.id },
              data: { 
                color: aiPlayer.color,
                hasPowerUp: false,
                powerUpType: null
              }
            });
          }

          // Update player score
          await db.player.update({
            where: { id: aiPlayer.id },
            data: { score: newScore }
          });

          movesMade.push({
            playerId: aiPlayer.id,
            gameId: game.id,
            from: { x: aiPlayer.positionX, y: aiPlayer.positionY },
            to: move
          });
        }
      }
    }

    return NextResponse.json({
      message: `AI made ${movesMade.length} moves`,
      moves: movesMade
    });
  } catch (error) {
    console.error('Error making AI moves:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function calculateAIMove(aiPlayer: any, game: any) {
  const { positionX, positionY, color } = aiPlayer;
  const { boardSize, tiles, players } = game;
  
  // Get all possible moves (adjacent tiles)
  const possibleMoves = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      
      const newX = positionX + dx;
      const newY = positionY + dy;
      
      // Check bounds
      if (newX >= 0 && newX < boardSize && newY >= 0 && newY < boardSize) {
        possibleMoves.push({ x: newX, y: newY });
      }
    }
  }

  if (possibleMoves.length === 0) return null;

  // Score each possible move
  const scoredMoves = possibleMoves.map(move => {
    let score = 0;
    const targetTile = tiles.find(t => t.x === move.x && t.y === move.y);
    
    // Prefer empty tiles or opponent tiles
    if (!targetTile?.color || targetTile.color !== color) {
      score += 10;
    }
    
    // Prefer tiles with power-ups
    if (targetTile?.hasPowerUp) {
      score += 20;
    }
    
    // Avoid tiles with other AI players (unless we can stun them)
    const playerOnTile = players.find(p => p.positionX === move.x && p.positionY === move.y && p.id !== aiPlayer.id);
    if (playerOnTile && !playerOnTile.isAI) {
      score += 15; // Stun human players
    } else if (playerOnTile && playerOnTile.isAI) {
      score -= 5; // Avoid other AI players
    }
    
    // Prefer tiles that expand our territory
    const adjacentTiles = tiles.filter(t => 
      Math.abs(t.x - move.x) <= 1 && 
      Math.abs(t.y - move.y) <= 1
    );
    const friendlyAdjacentTiles = adjacentTiles.filter(t => t.color === color).length;
    score += friendlyAdjacentTiles * 2;
    
    // Add some randomness
    score += Math.random() * 5;
    
    return { move, score };
  });

  // Sort by score and return the best move
  scoredMoves.sort((a, b) => b.score - a.score);
  return scoredMoves[0]?.move || null;
}