export type Item = {
  id: number;
  name: string;
  nameRu?: string;
  quality: 0 | 1 | 2 | 3 | 4;
  type: 'active' | 'passive' | 'familiar';
  icon: string;
  pools?: string[];
  greedPools?: string[];
  tags?: string[];
  collections?: string[];
  transformations?: string[];
  achievement?: string;
  keywords?: string;
};

export type ReferenceEntry = {
  key: string;
  category: string;
  categoryLabel: string;
  typeLabel?: string;
  id: number;
  name: string;
  nameRu: string;
  quality: number | null;
  icon?: string;
  keywords: string;
};

export type BoardPreferences = {
  boardView: 'all' | 'single';
  sort: 'random' | 'id' | 'name' | 'quality';
  groupBy: 'none' | 'type' | 'quality' | 'pool' | 'collection' | 'transformation' | 'achievement';
  nameLanguage: 'en' | 'ru';
  excludedStyle: 'flip' | 'dim' | 'hide';
  theme: 'basement' | 'slate' | 'blue' | 'purple' | 'blood' | 'earth' | 'flesh';
  showQuality: boolean;
  showIds: boolean;
  iconGrid: boolean;
  sampling: 'random' | 'balanced';
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
  preferences: BoardPreferences;
};
