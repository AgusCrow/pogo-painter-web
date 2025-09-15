'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Game, Player, GameTile } from '@/types/game';

interface UseGameSocketProps {
  gameId?: string;
  playerId?: string;
}

interface GameSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  gameState: { game: Game | null; tiles: GameTile[] } | null;
  joinGame: (gameId: string) => void;
  makeMove: (x: number, y: number) => void;
  startGame: (gameId: string) => void;
  requestGameState: (gameId: string) => void;
  error: string | null;
}

export function useGameSocket({ gameId, playerId }: UseGameSocketProps = {}): GameSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState<{ game: Game | null; tiles: GameTile[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io({
      path: '/api/socketio',
    });

    socketRef.current = socketInstance;

    // Connection events
    socketInstance.on('connect', () => {
      setIsConnected(true);
      setError(null);
      console.log('Connected to game server');
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from game server');
    });

    // Game events
    socketInstance.on('game-state', (data: { game: Game; tiles: GameTile[] }) => {
      setGameState(data);
    });

    socketInstance.on('game-started', (data: { game: Game }) => {
      setGameState(prev => prev ? { ...prev, game: data.game } : null);
    });

    socketInstance.on('player-moved', (data: { playerId: string; x: number; y: number; color: string }) => {
      // Update local game state when another player moves
      setGameState(prev => {
        if (!prev || !prev.game) return prev;
        
        const updatedGame = { ...prev.game };
        const playerIndex = updatedGame.players.findIndex(p => p.id === data.playerId);
        
        if (playerIndex !== -1) {
          updatedGame.players[playerIndex] = {
            ...updatedGame.players[playerIndex],
            positionX: data.x,
            positionY: data.y
          };
        }

        return { ...prev, game: updatedGame };
      });
    });

    socketInstance.on('player-joined', (data: { message: string; gameId: string }) => {
      console.log('Player joined:', data.message);
      // Request fresh game state
      socketInstance.emit('request-game-state', data.gameId);
    });

    socketInstance.on('player-left', (data: { message: string; gameId: string }) => {
      console.log('Player left:', data.message);
      // Request fresh game state
      socketInstance.emit('request-game-state', data.gameId);
    });

    socketInstance.on('error', (data: { message: string }) => {
      setError(data.message);
      console.error('Socket error:', data.message);
    });

    // Auto-join game if gameId is provided
    if (gameId && isConnected) {
      socketInstance.emit('join-game', gameId);
    }

    return () => {
      socketInstance.disconnect();
    };
  }, [gameId]);

  const joinGame = (gameIdToJoin: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('join-game', gameIdToJoin);
    }
  };

  const makeMove = (x: number, y: number) => {
    if (socketRef.current && isConnected && gameId && playerId) {
      socketRef.current.emit('player-move', {
        gameId,
        playerId,
        x,
        y
      });
    }
  };

  const startGame = (gameIdToStart: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('start-game', gameIdToStart);
    }
  };

  const requestGameState = (gameIdToRequest: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('request-game-state', gameIdToRequest);
    }
  };

  return {
    socket: socketRef.current,
    isConnected,
    gameState,
    joinGame,
    makeMove,
    startGame,
    requestGameState,
    error
  };
}