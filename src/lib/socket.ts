import { Server, Socket } from 'socket.io';

type Player = {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  score: number;
  displayX?: number; // For smooth interpolation
  displayY?: number; // For smooth interpolation
  isMoving?: boolean;
  moveProgress?: number;
};

type Tile = {
  x: number;
  y: number;
  color: string | null;
  playerId: string | null;
};

type GameState = {
  board: Tile[][];
  players: Player[];
  gameStarted: boolean;
  currentPlayerId: string | null;
};

const BOARD_SIZE = 12;
const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

// Game state storage
let gameState: GameState = {
  board: [],
  players: [],
  gameStarted: false,
  currentPlayerId: null,
};

// Initialize board
function initializeBoard(): Tile[][] {
  const board: Tile[][] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < BOARD_SIZE; x++) {
      row.push({ x, y, color: null, playerId: null });
    }
    board.push(row);
  }
  return board;
}

// Initialize game state
gameState.board = initializeBoard();

// Paint a tile and update player score
function paintTile(player: Player, x: number, y: number): { updatedPlayer: Player; boardUpdated: boolean } {
  const tile = gameState.board[y][x];
  let boardUpdated = false;
  let updatedPlayer = { ...player };

  // Only paint if tile is not already painted by this player
  if (tile.playerId !== player.id) {
    // Remove score from previous owner if exists
    if (tile.playerId) {
      const previousOwner = gameState.players.find(p => p.id === tile.playerId);
      if (previousOwner) {
        previousOwner.score = Math.max(0, previousOwner.score - 1);
      }
    }

    // Paint the tile
    tile.color = player.color;
    tile.playerId = player.id;
    
    // Add score to current player
    updatedPlayer.score += 1;
    boardUpdated = true;
  }

  return { updatedPlayer, boardUpdated };
}

// Broadcast game state to all players
function broadcastGameState(io: Server) {
  io.emit('gameState', gameState);
}

export const setupSocket = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);
    
    // Send current game state to new player
    socket.emit('gameState', gameState);

    // Handle player joining game
    socket.on('joinGame', (playerData: Omit<Player, 'score'>) => {
      const player: Player = {
        ...playerData,
        score: 0,
      };

      // Add player to game
      gameState.players.push(player);
      console.log(`Player ${player.name} (${player.id}) joined the game`);

      // Notify all players about the new player
      io.emit('playerJoined', player);
      
      // Broadcast updated game state
      broadcastGameState(io);

      // Send welcome message
      socket.emit('message', {
        text: `Welcome to Pogo Painter, ${player.name}!`,
        senderId: 'system',
        timestamp: new Date().toISOString(),
      });
    });

    // Handle player movement
    socket.on('movePlayer', (data: { playerId: string; x: number; y: number }) => {
      console.log('SERVER: Received movePlayer event:', data);
      
      if (!gameState.gameStarted) {
        console.log('SERVER: Game not started, ignoring move');
        return;
      }

      const player = gameState.players.find(p => p.id === data.playerId);
      if (!player) {
        console.log('SERVER: Player not found:', data.playerId);
        return;
      }

      console.log(`SERVER: Player ${player.name} moving from (${player.x}, ${player.y}) to (${data.x}, ${data.y})`);
      
      // Validate move
      if (data.x >= 0 && data.x < BOARD_SIZE && data.y >= 0 && data.y < BOARD_SIZE) {
        // Paint the tile
        const { updatedPlayer, boardUpdated } = paintTile(player, data.x, data.y);
        
        // Update player position
        updatedPlayer.x = data.x;
        updatedPlayer.y = data.y;

        console.log('SERVER: Updated player:', updatedPlayer);
        console.log('SERVER: Board updated:', boardUpdated);

        // Update player in game state
        const playerIndex = gameState.players.findIndex(p => p.id === data.playerId);
        if (playerIndex !== -1) {
          gameState.players[playerIndex] = updatedPlayer;
        }

        // Emit player movement event
        console.log('SERVER: Emitting playerMoved event');
        io.emit('playerMoved', updatedPlayer);

        // Emit board update if tile was painted
        if (boardUpdated) {
          console.log(`SERVER: Tile painted at (${data.x}, ${data.y}) by ${player.name}`);
          io.emit('boardUpdated', gameState.board);
        }

        // Broadcast updated game state
        console.log('SERVER: Broadcasting game state');
        broadcastGameState(io);

        // Send move confirmation to player
        socket.emit('moveConfirmed', {
          success: true,
          position: { x: data.x, y: data.y },
          score: updatedPlayer.score
        });
      } else {
        console.log('SERVER: Invalid move position');
        // Send move error to player
        socket.emit('moveConfirmed', {
          success: false,
          error: 'Invalid move position'
        });
      }
    });

    // Handle game start
    socket.on('startGame', () => {
      if (gameState.players.length >= 2 && !gameState.gameStarted) {
        gameState.gameStarted = true;
        console.log('Game started!');
        
        // Reset board and scores
        gameState.board = initializeBoard();
        gameState.players.forEach(player => {
          player.score = 0;
          // Random starting position
          player.x = Math.floor(Math.random() * BOARD_SIZE);
          player.y = Math.floor(Math.random() * BOARD_SIZE);
          
          // Paint starting position
          const { updatedPlayer } = paintTile(player, player.x, player.y);
          Object.assign(player, updatedPlayer);
        });

        // Broadcast game start
        io.emit('gameStarted', gameState);
        broadcastGameState(io);

        // Send game start message
        io.emit('message', {
          text: 'Game started! Move around to paint tiles!',
          senderId: 'system',
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Handle game restart
    socket.on('restartGame', () => {
      gameState.gameStarted = false;
      gameState.board = initializeBoard();
      gameState.players.forEach(player => {
        player.score = 0;
      });

      io.emit('gameRestarted', gameState);
      broadcastGameState(io);

      io.emit('message', {
        text: 'Game restarted! Waiting for players to join...',
        senderId: 'system',
        timestamp: new Date().toISOString(),
      });
    });

    // Handle chat messages (for fun)
    socket.on('message', (msg: { text: string; senderId: string }) => {
      const player = gameState.players.find(p => p.id === msg.senderId);
      const senderName = player ? player.name : 'Unknown';
      
      // Broadcast message to all players
      io.emit('message', {
        text: msg.text,
        senderId: msg.senderId,
        senderName,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      
      // Remove player from game
      const playerIndex = gameState.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        const disconnectedPlayer = gameState.players[playerIndex];
        gameState.players.splice(playerIndex, 1);
        
        console.log(`Player ${disconnectedPlayer.name} left the game`);
        
        // Notify remaining players
        io.emit('playerLeft', {
          playerId: socket.id,
          playerName: disconnectedPlayer.name,
        });

        // If game was in progress and now has less than 2 players, stop the game
        if (gameState.gameStarted && gameState.players.length < 2) {
          gameState.gameStarted = false;
          io.emit('gameStopped', {
            reason: 'Not enough players',
            message: 'Game stopped due to insufficient players',
          });
        }

        // Broadcast updated game state
        broadcastGameState(io);
      }
    });

    // Send welcome message
    socket.emit('message', {
      text: 'Welcome to Pogo Painter! Join the game to start playing.',
      senderId: 'system',
      timestamp: new Date().toISOString(),
    });
  });
};