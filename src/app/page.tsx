'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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

const BOARD_SIZE = 10;
const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

export default function PogoPainter() {
  const [gameState, setGameState] = useState<GameState>({
    board: [],
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
  const [gameStatus, setGameStatus] = useState('waiting'); // waiting, playing, stopped
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize board
  const initializeBoard = useCallback(() => {
    const board: Tile[][] = [];
    for (let y = 0; y < BOARD_SIZE; y++) {
      const row: Tile[] = [];
      for (let x = 0; x < BOARD_SIZE; x++) {
        row.push({ x, y, color: null, playerId: null });
      }
      board.push(row);
    }
    return board;
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initialize game state
    setGameState(prev => ({
      ...prev,
      board: initializeBoard(),
    }));

    // Setup socket connection
    const socketInstance = io({
      path: '/api/socketio',
    });

    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setIsConnected(true);
      setGameState(prev => ({ ...prev, currentPlayerId: socketInstance.id }));
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    // Game events
    socketInstance.on('gameState', (state: GameState) => {
      setGameState(state);
      setGameStatus(state.gameStarted ? 'playing' : 'waiting');
    });

    socketInstance.on('playerJoined', (player: Player) => {
      setGameState(prev => ({
        ...prev,
        players: [...prev.players, player],
      }));
    });

    socketInstance.on('playerMoved', (player: Player) => {
      setGameState(prev => ({
        ...prev,
        players: prev.players.map(p => p.id === player.id ? player : p),
      }));
    });

    socketInstance.on('boardUpdated', (board: Tile[][]) => {
      setGameState(prev => ({ ...prev, board }));
    });

    socketInstance.on('gameStarted', (state: GameState) => {
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
    if (socket && chatMessage.trim() && gameState.currentPlayerId) {
      socket.emit('message', {
        text: chatMessage.trim(),
        senderId: gameState.currentPlayerId,
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
    return '#f3f4f6';
  };

  const getPlayerOnTile = (x: number, y: number) => {
    return gameState.players.find(p => p.x === x && p.y === y);
  };

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
                      className="game-board grid gap-1 p-4 shadow-inner"
                      style={{ 
                        gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
                        maxWidth: '500px',
                        maxHeight: '500px'
                      }}
                    >
                      {gameState.board.map((row, y) =>
                        row.map((tile, x) => {
                          const playerOnTile = getPlayerOnTile(x, y);
                          return (
                            <div
                              key={`${x}-${y}`}
                              className={`game-tile relative aspect-square border border-gray-300 rounded-sm transition-all duration-200 ${tile.color ? 'painted' : ''}`}
                              style={{ backgroundColor: getTileColor(tile) }}
                            >
                              {playerOnTile && (
                                <div
                                  className="player-piece absolute inset-1 rounded-full border-2 border-white shadow-md"
                                  style={{ backgroundColor: playerOnTile.color }}
                                  title={playerOnTile.name}
                                />
                              )}
                            </div>
                          );
                        })
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
                    disabled={!isConnected || !joinedGame}
                    className="flex-1"
                  />
                  <Button 
                    onClick={sendChatMessage}
                    disabled={!isConnected || !joinedGame || !chatMessage.trim()}
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