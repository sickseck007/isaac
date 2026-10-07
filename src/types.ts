export type Item = {
  id: number;
  name: string;
  nameRu?: string;
  quality: 0 | 1 | 2 | 3 | 4;
  type: 'active' | 'passive' | 'familiar';
  icon: string;
};

export type Player = {
  id: string;
  name: string;
  color: string;
  eliminated: number[];
  secretItemId: number | null;
  secretRevealed: boolean;
};

export type GameState = {
  version: 1;
  players: Player[];
  activePlayerId: string;
  boardIds: number[];
  poolIds: number[];
  boardSize: number;
  columns: number;
  showNames: boolean;
};
