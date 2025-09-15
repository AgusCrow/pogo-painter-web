'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Game, Player } from '@/types/game';

interface ScoreBoardProps {
  game: Game;
  currentPlayer: Player;
}

export default function ScoreBoard({ game, currentPlayer }: ScoreBoardProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(game.timeLimit);
  const [isGameActive, setIsGameActive] = useState(game.status === 'PLAYING');

  // Sort players by score
  const sortedPlayers = [...game.players].sort((a, b) => b.score - a.score);

  useEffect(() => {
    if (game.status === 'PLAYING') {
      const startTime = Date.now();
      const endTime = startTime + (game.timeLimit * 1000);

      const timer = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
        setTimeRemaining(remaining);

        if (remaining === 0) {
          setIsGameActive(false);
          clearInterval(timer);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [game.status, game.timeLimit]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return '🥇';
      case 1:
        return '🥈';
      case 2:
        return '🥉';
      default:
        return `${index + 1}.`;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Score Board</span>
          <div className="flex items-center space-x-2">
            <Badge variant={isGameActive ? 'default' : 'secondary'}>
              {game.status}
            </Badge>
            {isGameActive && (
              <Badge variant="outline" className="font-mono">
                {formatTime(timeRemaining)}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedPlayers.map((player, index) => (
            <div
              key={player.id}
              className={`
                flex items-center justify-between p-3 rounded-lg border
                ${player.id === currentPlayer.id 
                  ? 'bg-blue-50 border-blue-200' 
                  : 'bg-gray-50 border-gray-200'
                }
                ${index === 0 && isGameActive ? 'ring-2 ring-yellow-400' : ''}
              `}
            >
              <div className="flex items-center space-x-3">
                <span className="text-lg font-bold">
                  {getRankIcon(index)}
                </span>
                <div
                  className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: player.color }}
                />
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-sm">
                      {player.user?.name || player.user?.email || 'AI Player'}
                    </span>
                    {player.id === currentPlayer.id && (
                      <Badge variant="outline" className="text-xs">You</Badge>
                    )}
                    {player.status === 'STUNNED' && (
                      <Badge variant="destructive" className="text-xs">Stunned</Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    Position: ({player.positionX}, {player.positionY})
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-900">
                  {player.score}
                </div>
                <div className="text-xs text-gray-500">
                  tiles
                </div>
              </div>
            </div>
          ))}
          
          {/* Game Summary */}
          {!isGameActive && game.status === 'FINISHED' && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="text-center">
                <div className="text-lg font-bold text-yellow-800 mb-2">
                  🎉 Game Finished! 🎉
                </div>
                <div className="text-sm text-yellow-700">
                  Winner: {sortedPlayers[0]?.user?.name || sortedPlayers[0]?.user?.email || 'AI Player'}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}