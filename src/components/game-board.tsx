'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import GameGrid from './game-grid';
import ScoreBoard from './score-board';
import { Game, Player, User } from '@/types/game';
import { useGameSocket } from '@/hooks/use-game-socket';

interface GameBoardProps {
  user: User;
}

export default function GameBoard({ user }: GameBoardProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize WebSocket connection
  const { 
    isConnected, 
    gameState, 
    joinGame, 
    makeMove, 
    startGame: startGameSocket,
    requestGameState,
    error 
  } = useGameSocket({ 
    gameId: selectedGame?.id, 
    playerId: currentPlayer?.id 
  });

  // AI move interval
  useEffect(() => {
    if (selectedGame?.status === 'PLAYING') {
      const aiInterval = setInterval(async () => {
        try {
          await fetch('/api/ai/move', {
            method: 'POST',
          });
          
          // Refresh game state to see AI moves
          if (selectedGame.id) {
            requestGameState(selectedGame.id);
          }
        } catch (error) {
          console.error('Error making AI moves:', error);
        }
      }, 2000); // AI moves every 2 seconds

      return () => clearInterval(aiInterval);
    }
  }, [selectedGame?.status, selectedGame?.id, requestGameState]);

  // Update game state when received via WebSocket
  useEffect(() => {
    if (gameState?.game) {
      setSelectedGame(gameState.game);
      
      // Update current player if exists
      if (currentPlayer) {
        const updatedPlayer = gameState.game.players.find(p => p.id === currentPlayer.id);
        if (updatedPlayer) {
          setCurrentPlayer(updatedPlayer);
        }
      }
    }
  }, [gameState, currentPlayer]);

  // Fetch available games
  const fetchGames = async () => {
    try {
      const response = await fetch('/api/games');
      if (response.ok) {
        const data = await response.json();
        setGames(data);
      }
    } catch (error) {
      console.error('Error fetching games:', error);
    }
  };

  // Create a new game
  const createGame = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${user.name || user.email}'s Game`,
          maxPlayers: 4,
          timeLimit: 120,
          boardSize: 10
        }),
      });

      if (response.ok) {
        await fetchGames();
      }
    } catch (error) {
      console.error('Error creating game:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Join a game
  const joinGameHandler = async (gameId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/games/${gameId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      if (response.ok) {
        const playerData = await response.json();
        const game = games.find(g => g.id === gameId);
        if (game) {
          setSelectedGame(game);
          setCurrentPlayer(playerData);
          // Join WebSocket room
          joinGame(gameId);
        }
      }
    } catch (error) {
      console.error('Error joining game:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle player move (both API and WebSocket)
  const handleMove = async (x: number, y: number) => {
    if (!currentPlayer || !selectedGame) return;

    try {
      // Make move via API (for persistence)
      const response = await fetch(`/api/games/${selectedGame.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: currentPlayer.id,
          x,
          y
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Also emit via WebSocket for real-time updates
        makeMove(x, y);
        
        // Show power-up notification if collected
        if (result.powerUpCollected) {
          const powerUpMessages = {
            'SPEED': '⚡ Speed Boost! +2 points',
            'JUMP': '🦘 Super Jump! +2 points',
            'SPRAY': '🎨 Spray Paint! Painted adjacent tiles'
          };
          
          toast.success(powerUpMessages[result.powerUpCollected] || 'Power-up collected!');
        }
      }
    } catch (error) {
      console.error('Error making move:', error);
    }
  };

  // Add AI players to the game
  const addAIPlayers = async () => {
    if (!selectedGame) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/games/${selectedGame.id}/add-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 1 }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Added ${result.aiPlayers.length} AI player(s)`);
        
        // Refresh game state
        requestGameState(selectedGame.id);
      }
    } catch (error) {
      console.error('Error adding AI players:', error);
      toast.error('Failed to add AI players');
    } finally {
      setIsLoading(false);
    }
  };

  // Start the game (both API and WebSocket)
  const startGame = async () => {
    if (!selectedGame) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/games/${selectedGame.id}/start`, {
        method: 'POST',
      });

      if (response.ok) {
        // Also emit via WebSocket for real-time updates
        startGameSocket(selectedGame.id);
      }
    } catch (error) {
      console.error('Error starting game:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  if (selectedGame && currentPlayer) {
    return (
      <div className="space-y-6">
        {/* Connection status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h2 className="text-3xl font-bold">Game: {selectedGame.name}</h2>
            <Badge variant={selectedGame.status === 'PLAYING' ? 'default' : 'secondary'}>
              {selectedGame.status}
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`text-sm px-2 py-1 rounded ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {isConnected ? '🟢 Live' : '🔴 Offline'}
            </span>
            {error && (
              <Badge variant="destructive" className="text-xs">
                {error}
              </Badge>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Game Board */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Game Board</CardTitle>
              </CardHeader>
              <CardContent>
                <GameGrid 
                  game={selectedGame} 
                  currentPlayer={currentPlayer}
                  onMove={handleMove}
                />
              </CardContent>
            </Card>
          </div>
          
          {/* Players Panel */}
          <div className="space-y-4">
            <ScoreBoard game={selectedGame} currentPlayer={currentPlayer} />
            
            <Card>
              <CardHeader>
                <CardTitle>Game Controls</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button 
                    className="w-full" 
                    disabled={selectedGame.status !== 'WAITING' || isLoading}
                    onClick={startGame}
                  >
                    {isLoading ? 'Starting...' : 'Start Game'}
                  </Button>
                  {selectedGame.status === 'WAITING' && (
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={addAIPlayers}
                      disabled={isLoading || selectedGame.players.length >= selectedGame.maxPlayers}
                    >
                      Add AI Player
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      setSelectedGame(null);
                      setCurrentPlayer(null);
                    }}
                  >
                    Leave Game
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Power-ups</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-600 space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                    <span><strong>⚡ Speed:</strong> +2 bonus points</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    <span><strong>🦘 Jump:</strong> +2 bonus points</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                    <span><strong>🎨 Spray:</strong> Paints adjacent tiles</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>How to Play</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>• Click on adjacent tiles to move</p>
                  <p>• Each move paints the tile</p>
                  <p>• Land on opponents to stun them</p>
                  <p>• Collect power-ups for advantages</p>
                  <p>• Paint the most tiles to win!</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Available Games</h2>
        <Button onClick={createGame} disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create New Game'}
        </Button>
      </div>
      
      {games.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-500 mb-4">No games available</p>
            <Button onClick={createGame}>Create the first game!</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map((game) => (
            <Card key={game.id} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">{game.name || 'Unnamed Game'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Status:</span>
                    <Badge variant={game.status === 'WAITING' ? 'secondary' : 'default'}>
                      {game.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Players:</span>
                    <span>{game.players.length}/{game.maxPlayers}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Time Limit:</span>
                    <span>{game.timeLimit}s</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Board Size:</span>
                    <span>{game.boardSize}x{game.boardSize}</span>
                  </div>
                  <Button 
                    className="w-full mt-4"
                    onClick={() => joinGameHandler(game.id)}
                    disabled={game.players.length >= game.maxPlayers || game.status !== 'WAITING'}
                  >
                    {game.players.length >= game.maxPlayers ? 'Full' : 'Join Game'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}