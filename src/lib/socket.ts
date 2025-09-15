import { Server } from 'socket.io';
import { db } from '@/lib/db';

interface GameMove {
  playerId: string;
  x: number;
  y: number;
  gameId: string;
}

interface GamePlayer {
  id: string;
  userId: string;
  gameId: string;
  color: string;
  positionX: number;
  positionY: number;
  score: number;
  status: 'ACTIVE' | 'STUNNED' | 'ELIMINATED';
  isAI: boolean;
}

interface GameUpdate {
  gameId: string;
  players: GamePlayer[];
  tiles: any[];
  status: string;
}

export const setupSocket = (io: Server) => {
  // Store game rooms and their players
  const gameRooms = new Map<string, Set<string>>();

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Join a game room
    socket.on('join-game', async (gameId: string) => {
      try {
        // Verify game exists
        const game = await db.game.findUnique({
          where: { id: gameId },
          include: { players: true }
        });

        if (!game) {
          socket.emit('error', { message: 'Game not found' });
          return;
        }

        // Join socket room
        socket.join(`game-${gameId}`);
        
        // Add to game rooms tracking
        if (!gameRooms.has(gameId)) {
          gameRooms.set(gameId, new Set());
        }
        gameRooms.get(gameId)?.add(socket.id);

        console.log(`Socket ${socket.id} joined game ${gameId}`);
        
        // Notify others in the room
        socket.to(`game-${gameId}`).emit('player-joined', {
          message: 'A new player joined the game',
          gameId
        });

        // Send current game state to the joining player
        const tiles = await db.gameTile.findMany({
          where: { gameId }
        });

        socket.emit('game-state', {
          game,
          tiles
        });

      } catch (error) {
        console.error('Error joining game:', error);
        socket.emit('error', { message: 'Failed to join game' });
      }
    });

    // Handle player moves
    socket.on('player-move', async (move: GameMove) => {
      try {
        const { gameId, playerId, x, y } = move;

        // Verify the move is valid (this would be done in the API as well)
        const game = await db.game.findUnique({
          where: { id: gameId },
          include: { 
            players: true,
            tiles: true 
          }
        });

        if (!game || game.status !== 'PLAYING') {
          socket.emit('error', { message: 'Game not active' });
          return;
        }

        const player = game.players.find(p => p.id === playerId);
        if (!player || player.status !== 'ACTIVE') {
          socket.emit('error', { message: 'Player cannot move' });
          return;
        }

        // Check move validity
        const dx = Math.abs(x - player.positionX);
        const dy = Math.abs(y - player.positionY);
        const isValidMove = (dx === 1 && dy === 0) || (dx === 0 && dy === 1) || (dx === 1 && dy === 1);

        if (!isValidMove) {
          socket.emit('error', { message: 'Invalid move' });
          return;
        }

        // Broadcast the move to all players in the game
        io.to(`game-${gameId}`).emit('player-moved', {
          playerId,
          x,
          y,
          color: player.color
        });

        console.log(`Player ${playerId} moved to (${x}, ${y}) in game ${gameId}`);

      } catch (error) {
        console.error('Error handling player move:', error);
        socket.emit('error', { message: 'Failed to process move' });
      }
    });

    // Handle game start
    socket.on('start-game', async (gameId: string) => {
      try {
        const game = await db.game.update({
          where: { id: gameId },
          data: { status: 'PLAYING' },
          include: { players: true }
        });

        // Broadcast game start to all players
        io.to(`game-${gameId}`).emit('game-started', { game });

        console.log(`Game ${gameId} started`);

      } catch (error) {
        console.error('Error starting game:', error);
        socket.emit('error', { message: 'Failed to start game' });
      }
    });

    // Handle game state updates
    socket.on('request-game-state', async (gameId: string) => {
      try {
        const game = await db.game.findUnique({
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

        if (game) {
          socket.emit('game-state', { game, tiles: game.tiles });
        }
      } catch (error) {
        console.error('Error fetching game state:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      
      // Remove from all game rooms
      gameRooms.forEach((sockets, gameId) => {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);
          socket.to(`game-${gameId}`).emit('player-left', {
            message: 'A player left the game',
            gameId
          });
        }
      });
    });

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to Pogo Painter game server!',
      timestamp: new Date().toISOString(),
    });
  });
};