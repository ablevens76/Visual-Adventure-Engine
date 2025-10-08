export interface Scene {
  imageUrl: string;
  description: string;
}

export interface InventoryItem {
  name: string;
  icon: string;
}

export interface AdventureConfig {
  scenes: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  genre: string;
  customGenre?: string;
  completionTime: 'Short' | 'Medium' | 'Long';
}

export interface StoryArc {
  title: string;
  overallGoal: string;
  initialScene: {
    description: string;
    imagePrompt: string;
  };
  keyPlotPoints: string[];
}

export interface GameState {
  storyArc: StoryArc;
  scene: Scene;
  inventory: InventoryItem[];
  score: number;
  lives: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  genre: string;
  currentObjective: string | null;
  completedObjectives: string[];
}

export interface GameLogicResponse {
  newSceneDescription: string;
  imagePrompt: string;
  inventoryChange: {
    action: 'add' | 'remove';
    item: InventoryItem;
  } | null;
  scoreChange?: number;
  livesChange?: number;
  objectiveCompleted?: string | null;
}