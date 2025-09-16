'use client';

import { useEffect, useState, useCallback, useRef, useLayoutEffect } from 'react';
import { io } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

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

type Message = {
  text: string;
  senderId: string;
  senderName?: string;
  timestamp: string;
};

const BOARD_SIZE = 12;
const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

// Simple board initialization function
const createEmptyBoard = (): Tile[][] => {
  const board: Tile[][] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < BOARD_SIZE; x++) {
      row.push({ x, y, color: null, playerId: null });
    }
    board.push(row);
  }
  return board;
};

export default function PogoPainter() {
  const [gameState, setGameState] = useState<GameState>({
    board: createEmptyBoard(), // Initialize with proper board instead of empty array
    players: [],
    gameStarted: false,
    currentPlayerId: null,
  });
  const [socket, setSocket] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [joinedGame, setJoinedGame] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [lastMove, setLastMove] = useState<{x: number, y: number} | null>(null);
  const [gameStatus, setGameStatus] = useState('waiting'); // waiting, playing, stopped
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [paintingAnimations, setPaintingAnimations] = useState<{x: number, y: number}[]>([]);
  const [animationFrame, setAnimationFrame] = useState<number | null>(null);
  const [interpolatedPlayers, setInterpolatedPlayers] = useState<Player[]>([]);
  const [boardUpdateQueue, setBoardUpdateQueue] = useState<GameState[]>([]);
  const lastUpdateTime = useRef<number>(Date.now());
  const animationRef = useRef<number>(0);
  const isProcessingRef = useRef(false);

  // Process board updates in batches for better performance
  const processBoardUpdates = useCallback(() => {
    if (isProcessingRef.current || boardUpdateQueue.length === 0) return;
    
    isProcessingRef.current = true;
    const latestUpdate = boardUpdateQueue[boardUpdateQueue.length - 1];
    
    // Use requestAnimationFrame for smooth visual updates
    requestAnimationFrame(() => {
      setGameState(latestUpdate);
      setBoardUpdateQueue(prev => prev.slice(1));
      isProcessingRef.current = false;
    });
  }, [boardUpdateQueue]);

  // Process updates efficiently
  useEffect(() => {
    if (boardUpdateQueue.length > 0) {
      const timer = setTimeout(processBoardUpdates, 16); // ~60fps
      return () => clearTimeout(timer);
    }
  }, [boardUpdateQueue, processBoardUpdates]);

  // Monitor board changes for debugging
  useEffect(() => {
    if (gameState.board.length > 0) {
      console.log('CLIENT: Board updated, sample tiles:', {
        '0,0': gameState.board[0]?.[0],
        '1,1': gameState.board[1]?.[1],
        '2,2': gameState.board[2]?.[2],
        boardSize: gameState.board.length,
        paintedTiles: gameState.board.flat().filter(tile => tile.color).length
      });
    }
  }, [gameState.board]);
  const animatePlayers = useCallback(() => {
    const now = Date.now();
    const deltaTime = now - lastUpdateTime.current;
    lastUpdateTime.current = now;

    setInterpolatedPlayers(prev => {
      const newPlayers = gameState.players.map(player => {
        const prevPlayer = prev.find(p => p.id === player.id) || player;
        
        // If player has actual position different from display position, interpolate
        const targetX = player.x;
        const targetY = player.y;
        const currentX = prevPlayer.displayX ?? targetX;
        const currentY = prevPlayer.displayY ?? targetY;
        
        // Calculate distance
        const distance = Math.sqrt(Math.pow(targetX - currentX, 2) + Math.pow(targetY - currentY, 2));
        
        // If distance is significant, interpolate
        if (distance > 0.1) {
          const interpolationSpeed = Math.min(deltaTime / 150, 1); // 150ms for faster movement
          const newX = currentX + (targetX - currentX) * interpolationSpeed;
          const newY = currentY + (targetY - currentY) * interpolationSpeed;
          
          return {
            ...player,
            displayX: newX,
            displayY: newY,
            isMoving: distance > 0.3,
            moveProgress: 1 - (distance / Math.sqrt(2)) // Progress from 0 to 1
          };
        }
        
        return {
          ...player,
          displayX: targetX,
          displayY: targetY,
          isMoving: false,
          moveProgress: 1
        };
      });
      
      return newPlayers;
    });

    animationRef.current = requestAnimationFrame(animatePlayers);
  }, [gameState.players]);

  // Start/stop animation loop
  useEffect(() => {
    animationRef.current = requestAnimationFrame(animatePlayers);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animatePlayers]);

  // Initialize interpolated players when game state changes
  useEffect(() => {
    setInterpolatedPlayers(gameState.players.map(player => ({
      ...player,
      displayX: player.x,
      displayY: player.y,
      isMoving: false,
      moveProgress: 1
    })));
  }, [gameState.players]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    console.log('CLIENT: Initializing game state with board:', createEmptyBoard());
    // Initialize game state with proper board
    const initialBoard = createEmptyBoard();
    setGameState(prev => ({
      ...prev,
      board: initialBoard,
    }));

    // Setup socket connection
    const socketInstance = io({
      path: '/api/socketio',
    });

    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setIsConnected(true);
      setGameState(prev => ({ ...prev, currentPlayerId: socketInstance.id }));
      console.log('Connected to server with ID:', socketInstance.id);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from server');
    });

    // Enhanced game state handler with queueing
  socketInstance.on('gameState', (state: GameState) => {
    console.log('CLIENT: Received gameState event:', state);
    setGameStatus(state.gameStarted ? 'playing' : 'waiting');
    
    // Update game state immediately for board updates
    setGameState(prev => ({
      ...prev,
      board: state.board,
      players: state.players,
      gameStarted: state.gameStarted
    }));
  });

    socketInstance.on('playerJoined', (player: Player) => {
      setGameState(prev => ({
        ...prev,
        players: [...prev.players, player],
      }));
    });

    socketInstance.on('playerMoved', (player: Player) => {
      // Update game state immediately for responsiveness
      setGameState(prev => ({
        ...prev,
        players: prev.players.map(p => p.id === player.id ? player : p),
      }));
      
      // Track last move for animation with enhanced feedback
      setLastMove({x: player.x, y: player.y});
      setTimeout(() => setLastMove(null), 600);
    });

    // Enhanced board update with better synchronization
    socketInstance.on('boardUpdated', (board: Tile[][]) => {
      console.log('CLIENT: Received boardUpdated event:', board);
      setGameState(prev => {
        const currentBoard = prev.board;
        const paintedTiles = [];
        
        // Check for newly painted tiles
        for (let y = 0; y < board.length; y++) {
          for (let x = 0; x < board[y].length; x++) {
            const newTile = board[y][x];
            const oldTile = currentBoard[y]?.[x];
            
            // Check if tile was newly painted or color changed
            if (newTile.color && (!oldTile || oldTile.color !== newTile.color)) {
              paintedTiles.push({x, y, color: newTile.color});
            }
          }
        }
        
        console.log('CLIENT: Painted tiles detected:', paintedTiles);
        
        // Trigger painting animations
        if (paintedTiles.length > 0) {
          setPaintingAnimations(paintedTiles);
          
          // Clear animations in waves for better visual effect
          paintedTiles.forEach((tile, index) => {
            setTimeout(() => {
              setPaintingAnimations(prev => prev.filter(p => !(p.x === tile.x && p.y === tile.y)));
            }, 400 + (index * 30)); // Stagger the animation clearing
          });
        }
        
        return { ...prev, board };
      });
    });

    socketInstance.on('gameStarted', (state: GameState) => {
      console.log('CLIENT: Game started event received:', state);
      setGameState(state);
      setGameStatus('playing');
    });

    socketInstance.on('gameStopped', (data: any) => {
      setGameStatus('stopped');
      setMessages(prev => [...prev, {
        text: data.message,
        senderId: 'system',
        timestamp: new Date().toISOString(),
      }]);
    });

    socketInstance.on('gameRestarted', (state: GameState) => {
      setGameState(state);
      setGameStatus('waiting');
    });

    socketInstance.on('playerLeft', (data: any) => {
      setGameState(prev => ({
        ...prev,
        players: prev.players.filter(p => p.id !== data.playerId),
      }));
      setMessages(prev => [...prev, {
        text: `${data.playerName} left the game`,
        senderId: 'system',
        timestamp: new Date().toISOString(),
      }]);
    });

    // Move confirmation events
    socketInstance.on('moveConfirmed', (data: { success: boolean; position?: {x: number, y: number}; score?: number; error?: string }) => {
      if (data.success) {
        // Add visual feedback for successful move
        if (data.position) {
          setLastMove(data.position);
          setTimeout(() => setLastMove(null), 600);
        }
      } else {
        // Show error feedback
        setMessages(prev => [...prev, {
          text: `Move failed: ${data.error || 'Unknown error'}`,
          senderId: 'system',
          timestamp: new Date().toISOString(),
        }]);
      }
    });

    // Message events
    socketInstance.on('message', (msg: Message) => {
      setMessages(prev => [...prev, msg]);
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [initializeBoard]);

  const joinGame = () => {
    if (socket && playerName.trim() && isConnected) {
      const player: Player = {
        id: socket.id,
        name: playerName.trim(),
        color: PLAYER_COLORS[gameState.players.length % PLAYER_COLORS.length],
        x: Math.floor(Math.random() * BOARD_SIZE),
        y: Math.floor(Math.random() * BOARD_SIZE),
        score: 0,
      };
      
      socket.emit('joinGame', player);
      setJoinedGame(true);
    }
  };

  const startGame = () => {
    if (socket) {
      socket.emit('startGame');
    }
  };

  const restartGame = () => {
    if (socket) {
      socket.emit('restartGame');
    }
  };

  const movePlayer = (dx: number, dy: number) => {
    if (!socket || !gameState.currentPlayerId || !gameState.gameStarted) return;

    const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
    if (!currentPlayer) return;

    const newX = currentPlayer.x + dx;
    const newY = currentPlayer.y + dy;

    if (newX >= 0 && newX < BOARD_SIZE && newY >= 0 && newY < BOARD_SIZE) {
      socket.emit('movePlayer', {
        playerId: gameState.currentPlayerId,
        x: newX,
        y: newY,
      });
    }
  };

  const sendChatMessage = () => {
    if (socket && chatMessage.trim() && gameState.currentPlayerId && gameState.gameStarted) {
      const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
      socket.emit('message', {
        text: chatMessage.trim(),
        senderId: gameState.currentPlayerId,
        senderName: currentPlayer?.name || 'Unknown',
      });
      setChatMessage('');
    }
  };

  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (!gameState.gameStarted) return;
    
    switch(e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        movePlayer(0, -1);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        movePlayer(0, 1);
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        movePlayer(-1, 0);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        movePlayer(1, 0);
        break;
    }
  }, [gameState.gameStarted, movePlayer]);

  const handleChatKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendChatMessage();
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  const getTileColor = (tile: Tile) => {
    if (tile.color) return tile.color;
    return '#f8fafc'; // Lighter gray for better visibility
  };

  const getPlayerOnTile = (x: number, y: number) => {
    // Temporarily use exact positions for debugging
    return gameState.players.find(p => p.x === x && p.y === y);
  };

  // Debug function to log game state
  const debugGameState = () => {
    console.log('Game State:', {
      boardSize: gameState.board.length,
      players: gameState.players.length,
      gameStarted: gameState.gameStarted,
      currentPlayerId: gameState.currentPlayerId,
      sampleTile: gameState.board[0]?.[0]
    });
  };

  // Add debug button
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      window.debugGameState = debugGameState;
    }
  }, [gameState]);

  const getGameStatusMessage = () => {
    switch(gameStatus) {
      case 'waiting':
        return gameState.players.length < 2 
          ? `Waiting for players (${gameState.players.length}/2)` 
          : 'Ready to start!';
      case 'playing':
        return 'Game in progress';
      case 'stopped':
        return 'Game stopped';
      default:
        return 'Unknown status';
    }
  };

  const getGameStatusColor = () => {
    switch(gameStatus) {
      case 'waiting':
        return gameState.players.length < 2 ? 'destructive' : 'secondary';
      case 'playing':
        return 'default';
      case 'stopped':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Pogo Painter</h1>
          <p className="text-gray-600">Jump around and paint the board with your color!</p>
          <div className="flex items-center justify-center gap-4 mt-2">
            <Badge variant={isConnected ? "default" : "destructive"}>
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
            <Badge variant={getGameStatusColor()}>
              {getGameStatusMessage()}
            </Badge>
            {process.env.NODE_ENV === 'development' && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={debugGameState}
              >
                Debug
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Game Board */}
          <div className="xl:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Game Board
                  {gameState.gameStarted && (
                    <Badge variant="outline">Game in Progress</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center">
                  <div className="game-board-container">
                    <div 
                      className="game-board grid gap-1 p-6 shadow-inner"
                      style={{ 
                        gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
                        maxWidth: '600px',
                        maxHeight: '600px',
                        width: '100%',
                        height: '100%'
                      }}
                    >
                      {gameState.board.length > 0 ? (
                        gameState.board.map((row, y) =>
                          row.map((tile, x) => {
                            // Simplified rendering - just show players at exact positions
                            const playerOnTile = getPlayerOnTile(x, y);
                            const isPainting = paintingAnimations.some(p => p.x === x && p.y === y);
                            const isLastMove = lastMove && lastMove.x === x && lastMove.y === y;

                            return (
                              <div
                                key={`${x}-${y}`}
                                className={`game-tile relative aspect-square border-2 border-gray-400 rounded-lg transition-all duration-300 ${tile.color ? 'painted' : ''} ${isPainting ? 'scale-110 highlight' : ''} ${isLastMove ? 'ring-4 ring-yellow-400' : ''} ${playerOnTile ? 'player-occupied' : ''}`}
                                style={{ backgroundColor: getTileColor(tile) }}
                              >
                                {/* Simple player rendering */}
                                {playerOnTile && (
                                  <div
                                    className="absolute inset-2 rounded-full border-3 border-white shadow-lg animate-pulse"
                                    style={{
                                      backgroundColor: playerOnTile.color,
                                    }}
                                    title={playerOnTile.name}
                                  />
                                )}
                                
                                {/* Add coordinate indicators for debugging */}
                                <div className="absolute bottom-0 right-0 text-xs text-gray-500 opacity-30 pointer-events-none">
                                  {x},{y}
                                </div>
                              </div>
                            );
                          })
                        )
                      ) : (
                        <div className="col-span-full text-center text-gray-500 p-8">
                          <p>Initializing board...</p>
                          <p className="text-sm">Board length: {gameState.board.length}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Middle Column - Game Controls and Players */}
          <div className="space-y-4">
            {/* Player Join */}
            {!joinedGame && (
              <Card>
                <CardHeader>
                  <CardTitle>Join Game</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Your Name</label>
                    <Input
                      type="text"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder="Enter your name"
                      disabled={!isConnected}
                    />
                  </div>
                  <Button 
                    onClick={joinGame} 
                    disabled={!isConnected || !playerName.trim()}
                    className="w-full"
                  >
                    Join Game
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Game Controls */}
            {joinedGame && (
              <Card>
                <CardHeader>
                  <CardTitle>Game Controls</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!gameState.gameStarted ? (
                    <div className="space-y-2">
                      <Button 
                        onClick={startGame} 
                        className="w-full"
                        disabled={gameState.players.length < 2}
                      >
                        Start Game
                      </Button>
                      {gameState.players.length < 2 && (
                        <p className="text-xs text-gray-500 text-center">
                          Need at least 2 players to start
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">Use arrow keys or WASD to move</p>
                      <div className="grid grid-cols-3 gap-1 max-w-32 mx-auto">
                        <div></div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => movePlayer(0, -1)}
                        >
                          ↑
                        </Button>
                        <div></div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => movePlayer(-1, 0)}
                        >
                          ←
                        </Button>
                        <div></div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => movePlayer(1, 0)}
                        >
                          →
                        </Button>
                        <div></div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => movePlayer(0, 1)}
                        >
                          ↓
                        </Button>
                        <div></div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={restartGame}
                        className="w-full mt-2"
                      >
                        Restart Game
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Players List */}
            <Card>
              <CardHeader>
                <CardTitle>Players ({gameState.players.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {gameState.players
                    .sort((a, b) => b.score - a.score)
                    .map((player, index) => (
                    <div key={player.id} className="flex items-center justify-between p-2 rounded bg-gray-50 player-join-animation">
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                          {index === 0 && gameState.gameStarted && (
                            <span className="text-yellow-500">👑</span>
                          )}
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: player.color }}
                          />
                        </div>
                        <span className="text-sm font-medium">
                          {player.name}
                          {player.id === gameState.currentPlayerId && " (You)"}
                        </span>
                      </div>
                      <Badge variant="secondary" className="score-animation">{player.score}</Badge>
                    </div>
                  ))}
                  {gameState.players.length === 0 && (
                    <p className="text-gray-500 text-sm">No players yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Chat and Instructions */}
          <div className="space-y-4">
            {/* Chat */}
            <Card>
              <CardHeader>
                <CardTitle>Chat</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScrollArea className="h-64 w-full border rounded-md p-3">
                  <div className="space-y-2">
                    {messages.length === 0 ? (
                      <p className="text-gray-500 text-center text-sm">No messages yet</p>
                    ) : (
                      messages.map((msg, index) => (
                        <div key={index} className="text-sm chat-message">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`font-medium ${msg.senderId === 'system' ? 'text-blue-600' : ''}`}>
                              {msg.senderId === 'system' ? 'System' : msg.senderName || 'Unknown'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-gray-700">{msg.text}</p>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
                <div className="flex space-x-2">
                  <Input
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={handleChatKeyPress}
                    placeholder="Type a message..."
                    disabled={!isConnected || !joinedGame || !gameState.gameStarted}
                    className="flex-1"
                  />
                  <Button 
                    onClick={sendChatMessage}
                    disabled={!isConnected || !joinedGame || !gameState.gameStarted || !chatMessage.trim()}
                    size="sm"
                  >
                    Send
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Instructions */}
            <Card>
              <CardHeader>
                <CardTitle>How to Play</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-600 space-y-2">
                  <p>• Join the game with your name</p>
                  <p>• Wait for at least 2 players</p>
                  <p>• Start the game when ready</p>
                  <p>• Use arrow keys or WASD to move</p>
                  <p>• Paint tiles by landing on them</p>
                  <p>• Steal tiles from other players</p>
                  <p>• Player with most tiles wins!</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}