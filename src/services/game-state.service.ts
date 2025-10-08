import { Injectable, signal, inject, WritableSignal } from '@angular/core';
import { GeminiService } from './gemini.service';
import { GameState, InventoryItem, GameLogicResponse, AdventureConfig, StoryArc } from '../models/game.model';

@Injectable({
  providedIn: 'root'
})
export class GameStateService {
  private geminiService = inject(GeminiService);

  gameState: WritableSignal<GameState | null> = signal(null);
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);
  gamePhase = signal<'setup' | 'playing'>('setup');

  resetGame(): void {
    this.gameState.set(null);
    this.isLoading.set(false);
    this.error.set(null);
    this.gamePhase.set('setup');
  }

  async setupAndStartGame(config: AdventureConfig): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const storyArc = await this.geminiService.generateStoryArc(config);
      const initialImageBase64 = await this.geminiService.generateSceneImage(storyArc.initialScene.imagePrompt);
      
      const initialState: GameState = {
        storyArc: storyArc,
        scene: {
          description: storyArc.initialScene.description,
          imageUrl: `data:image/jpeg;base64,${initialImageBase64}`
        },
        inventory: [],
        score: 0,
        lives: config.difficulty === 'Easy' ? 5 : config.difficulty === 'Medium' ? 3 : 1,
        difficulty: config.difficulty,
        genre: config.customGenre || config.genre,
        currentObjective: config.difficulty === 'Medium' ? storyArc.keyPlotPoints[0] : null,
        completedObjectives: [],
      };
      
      this.gameState.set(initialState);
      this.gamePhase.set('playing');
    } catch (e) {
      console.error("Failed to setup and start game:", e);
      this.error.set("The adventure could not be created. Please try different settings.");
      this.gamePhase.set('setup'); 
    } finally {
      this.isLoading.set(false);
    }
  }

  async processPlayerAction(action: string): Promise<void> {
    const currentState = this.gameState();
    if (!currentState || currentState.lives <= 0) return;
    
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const { storyArc, scene, inventory, score, lives, difficulty, currentObjective } = currentState;
      const currentInventoryNames = inventory.map(i => i.name);
      
      const logicResponse = await this.geminiService.generateNextStep(
        storyArc,
        scene.description,
        action,
        currentInventoryNames,
        score,
        lives,
        difficulty,
        currentObjective
      );
      
      const newImageBase64 = await this.geminiService.generateSceneImage(logicResponse.imagePrompt);
      
      this.updateGameState(logicResponse, newImageBase64);
      
    } catch (e) {
      console.error("Failed to process action:", e);
      this.error.set("An unexpected force prevents that. Try something else.");
      setTimeout(() => this.error.set(null), 5000);
    } finally {
      this.isLoading.set(false);
    }
  }

  private updateGameState(logic: GameLogicResponse, imageBase64: string): void {
    this.gameState.update(current => {
      if (!current) return null;

      // Update inventory
      let newInventory = [...current.inventory];
      if (logic.inventoryChange) {
        if (logic.inventoryChange.action === 'add') {
          if (!newInventory.some(item => item.name === logic.inventoryChange!.item.name)) {
            newInventory.push(logic.inventoryChange.item);
          }
        } else {
          newInventory = newInventory.filter(item => item.name !== logic.inventoryChange!.item.name);
        }
      }

      // Update score and lives
      const newScore = current.score + (logic.scoreChange || 0);
      const newLives = current.lives + (logic.livesChange || 0);

      if (newLives <= 0) {
        this.error.set("You have perished! Your adventure ends here.");
      }

      // Update objectives
      let completedObjectives = [...current.completedObjectives];
      let currentObjective = current.currentObjective;
      if (logic.objectiveCompleted && !completedObjectives.includes(logic.objectiveCompleted)) {
        completedObjectives.push(logic.objectiveCompleted);
        if (current.difficulty === 'Medium') {
          const nextObjectiveIndex = current.storyArc.keyPlotPoints.findIndex(p => p === logic.objectiveCompleted) + 1;
          if (nextObjectiveIndex < current.storyArc.keyPlotPoints.length) {
            currentObjective = current.storyArc.keyPlotPoints[nextObjectiveIndex];
          } else {
            currentObjective = `Final Goal: ${current.storyArc.overallGoal}`;
          }
        }
      }

      return {
        ...current,
        scene: {
          description: logic.newSceneDescription,
          imageUrl: `data:image/jpeg;base64,${imageBase64}`
        },
        inventory: newInventory,
        score: newScore,
        lives: Math.max(0, newLives),
        completedObjectives,
        currentObjective
      };
    });
  }
}