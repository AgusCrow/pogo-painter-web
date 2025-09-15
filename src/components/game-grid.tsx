'use client';

import { useState, useEffect, useCallback } from 'react';
import { Game, Player, GameTile } from '@/types/game';

interface GameGridProps {
  game: Game;
  currentPlayer: Player;
  onMove: (x: number, y: number) => void;
}

interface TileProps {
  tile: GameTile;
  players: Player[];
  currentPlayer: Player;
  onClick: () => void;
}

function Tile({ tile, players, currentPlayer, onClick }: TileProps) {
  const playerOnTile = players.find(p => p.positionX === tile.x && p.positionY === tile.y);
  const isCurrentPlayerOnTile = playerOnTile?.id === currentPlayer.id;

  // Check if move is valid (adjacent to current player position)
  const dx = Math.abs(tile.x - currentPlayer.positionX);
  const dy = Math.abs(tile.y - currentPlayer.positionY);
  const isValidMove = (dx === 1 && dy === 0) || (dx === 0 && dy === 1) || (dx === 1 && dy === 1);
  const canMove = currentPlayer.status === 'ACTIVE' && isValidMove;

  return (
    <div
      className={`
        relative w-10 h-10 border border-gray-300 cursor-pointer
        transition-all duration-200 hover:scale-105
        ${tile.color ? 'border-2' : ''}
        ${isCurrentPlayerOnTile ? 'ring-2 ring-yellow-400 ring-offset-1' : ''}
        ${canMove ? 'hover:shadow-md' : 'cursor-not-allowed opacity-75'}
      `}
      style={{ backgroundColor: tile.color || '#f3f4f6' }}
      onClick={canMove ? onClick : undefined}
    >
      {/* Player indicator */}
      {playerOnTile && (
        <div
          className={`
            absolute inset-1 rounded-full border-2 border-white shadow-md
            ${playerOnTile.status === 'STUNNED' ? 'animate-pulse' : ''}
          `}
          style={{ backgroundColor: playerOnTile.color }}
        />
      )}
      
      {/* Power-up indicator */}
      {tile.hasPowerUp && (
        <div 
          className={`
            absolute top-0 right-0 w-3 h-3 rounded-full border border-white shadow-sm animate-pulse
            ${tile.powerUpType === 'SPEED' ? 'bg-blue-400' : ''}
            ${tile.powerUpType === 'JUMP' ? 'bg-green-400' : ''}
            ${tile.powerUpType === 'SPRAY' ? 'bg-purple-400' : ''}
          `}
          title={tile.powerUpType || 'Power-up'}
        />
      )}
      
      {/* Coordinates for debugging (optional) */}
      <div className="absolute bottom-0 right-0 text-xs text-gray-400 opacity-50">
        {tile.x},{tile.y}
      </div>
    </div>
  );
}

export default function GameGrid({ game, currentPlayer, onMove }: GameGridProps) {
  const [tiles, setTiles] = useState<GameTile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTiles = useCallback(async () => {
    try {
      const response = await fetch(`/api/games/${game.id}/tiles`);
      if (response.ok) {
        const data = await response.json();
        setTiles(data);
      }
    } catch (error) {
      console.error('Error fetching tiles:', error);
    } finally {
      setIsLoading(false);
    }
  }, [game.id]);

  useEffect(() => {
    fetchTiles();
  }, [fetchTiles]);

  // Refresh tiles when game state changes
  useEffect(() => {
    if (game.status === 'PLAYING') {
      const interval = setInterval(fetchTiles, 1000);
      return () => clearInterval(interval);
    }
  }, [game.status, fetchTiles]);

  const handleTileClick = (x: number, y: number) => {
    // Check if the move is valid (adjacent to current position)
    const dx = Math.abs(x - currentPlayer.positionX);
    const dy = Math.abs(y - currentPlayer.positionY);
    
    if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1) || (dx === 1 && dy === 1)) {
      onMove(x, y);
    }
  };

  if (isLoading) {
    return (
      <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="grid gap-0 bg-white p-4 rounded-lg shadow-inner">
      {Array.from({ length: game.boardSize }, (_, y) => (
        <div key={y} className="flex">
          {Array.from({ length: game.boardSize }, (_, x) => {
            const tile = tiles.find(t => t.x === x && t.y === y) || {
              id: `${x}-${y}`,
              gameId: game.id,
              x,
              y,
              color: null,
              hasPowerUp: false,
              powerUpType: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            
            return (
              <Tile
                key={`${x}-${y}`}
                tile={tile}
                players={game.players}
                currentPlayer={currentPlayer}
                onClick={() => handleTileClick(x, y)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}