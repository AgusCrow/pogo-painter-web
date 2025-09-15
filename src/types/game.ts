export interface User {
  id: string;
  email: string;
  name?: string;
}

export interface Game {
  id: string;
  name?: string;
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  maxPlayers: number;
  timeLimit: number;
  boardSize: number;
  createdAt: Date;
  updatedAt: Date;
  players: Player[];
}

export interface Player {
  id: string;
  userId: string;
  gameId: string;
  color: string;
  positionX: number;
  positionY: number;
  score: number;
  status: 'ACTIVE' | 'STUNNED' | 'ELIMINATED';
  isAI: boolean;
  createdAt: Date;
  updatedAt: Date;
  user?: User;
}

export interface GameTile {
  id: string;
  gameId: string;
  x: number;
  y: number;
  color?: string;
  hasPowerUp: boolean;
  powerUpType?: 'SPEED' | 'JUMP' | 'SPRAY';
  createdAt: Date;
  updatedAt: Date;
}

export interface GameState {
  game: Game;
  tiles: GameTile[];
  currentPlayer: Player;
  timeRemaining: number;
}

export interface MoveAction {
  type: 'MOVE';
  playerId: string;
  x: number;
  y: number;
}

export interface PaintAction {
  type: 'PAINT';
  playerId: string;
  x: number;
  y: number;
  color: string;
}

export interface StunAction {
  type: 'STUN';
  playerId: string;
  targetPlayerId: string;
}

export interface PowerUpAction {
  type: 'POWERUP';
  playerId: string;
  powerUpType: 'SPEED' | 'JUMP' | 'SPRAY';
}

export type GameAction = MoveAction | PaintAction | StunAction | PowerUpAction;