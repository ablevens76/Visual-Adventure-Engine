import { Injectable } from '@angular/core';
import { GoogleGenAI, Type } from '@google/genai';
import { AdventureConfig, GameLogicResponse, StoryArc } from '../models/game.model';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI;

  private readonly storyArcSchema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'A creative and evocative title for the adventure.' },
      overallGoal: { type: Type.STRING, description: 'A clear, concise goal for the player to achieve to win the game.' },
      initialScene: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING, description: 'A vivid, literary description of the starting scene.' },
          imagePrompt: { type: Type.STRING, description: 'A detailed, photorealistic prompt for the starting scene image.' }
        },
        required: ['description', 'imagePrompt']
      },
      keyPlotPoints: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'A list of 3-5 major events, puzzles, or locations the player must navigate to reach the goal.'
      }
    },
    required: ['title', 'overallGoal', 'initialScene', 'keyPlotPoints']
  };

  private readonly gameLogicSchema = {
    type: Type.OBJECT,
    properties: {
      newSceneDescription: {
        type: Type.STRING,
        description: 'A vivid, literary description of the new scene or the result of the player\'s action. This will be shown to the player.'
      },
      imagePrompt: {
        type: Type.STRING,
        description: 'A detailed, photorealistic prompt for an image generator. It MUST describe the entire scene, including the specific change that just occurred due to the player\'s action. E.g., "...the room is the same, but the strange device on the table is now glowing."'
      },
      inventoryChange: {
        type: Type.OBJECT,
        nullable: true,
        properties: {
          action: { type: Type.STRING, enum: ['add', 'remove'] },
          item: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              icon: { type: Type.STRING, description: 'A single emoji to represent the item.' }
            }
          }
        }
      },
      scoreChange: { type: Type.NUMBER, description: 'Points to add to the score (can be negative). Defaults to 0.' },
      livesChange: { type: Type.NUMBER, description: 'Number of lives to add or remove (e.g., -1 to lose a life). Defaults to 0.' },
      objectiveCompleted: { type: Type.STRING, nullable: true, description: 'If the action completed a key plot point, state the exact plot point string here. Otherwise, null.' }
    },
    required: ['newSceneDescription', 'imagePrompt']
  };

  constructor() {
    const apiKey = (window as any).process?.env?.API_KEY;
    if (!apiKey) {
      throw new Error("API_KEY is not set. Please set it in your environment variables.");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateStoryArc(config: AdventureConfig): Promise<StoryArc> {
    const genre = config.customGenre || config.genre;
    const prompt = `
      Create a complete story arc for a Myst-style graphical adventure game based on these parameters:
      - Genre/Theme: ${genre}
      - Number of key scenes/puzzles: ${config.scenes}
      - Difficulty: ${config.difficulty}
      - Desired Playtime: ${config.completionTime}

      Generate a compelling title, a clear goal for the player, an engaging starting scene, and the key plot points that form the backbone of the adventure. The plot points should hint at puzzles and challenges appropriate for the difficulty level.
    `;

    const systemInstruction = `You are a world-class adventure game designer. Your task is to architect a complete, cohesive, and engaging game narrative from a set of high-level requirements. Respond ONLY with a valid JSON object matching the provided schema.`;

    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: this.storyArcSchema
      }
    });

    try {
      const jsonText = response.text.trim();
      return JSON.parse(jsonText) as StoryArc;
    } catch(e) {
      console.error("Failed to parse JSON from Gemini for story arc:", response.text);
      throw new Error("The muses of creation are silent. Could not forge an adventure.");
    }
  }

  async generateNextStep(
    storyArc: StoryArc, 
    currentScene: string, 
    playerAction: string, 
    inventory: string[], 
    score: number, 
    lives: number,
    difficulty: 'Easy' | 'Medium' | 'Hard',
    currentObjective: string | null
  ): Promise<GameLogicResponse> {
    const prompt = `
      Story Title: "${storyArc.title}"
      Player's Goal: "${storyArc.overallGoal}"
      Key Plot Points: [${storyArc.keyPlotPoints.join(', ')}]

      Current Scene: "${currentScene}"
      Player's Inventory: [${inventory.join(', ') || 'Empty'}]
      Current Score: ${score}
      Lives Remaining: ${lives}
      Difficulty: ${difficulty}
      ${difficulty === 'Medium' ? `Current Objective: "${currentObjective}"` : ''}

      Player's Action: "${playerAction}"

      Based on the player's action, determine the outcome and the new state of the world, keeping the overall story arc and difficulty rules in mind.
    `;
    return this.generateGameLogic(prompt, storyArc, difficulty);
  }
  
  private async generateGameLogic(prompt: string, storyArc: StoryArc, difficulty: string): Promise<GameLogicResponse> {
    const systemInstruction = `You are a master storyteller and game master for a hyper-realistic, Myst-style graphical adventure game. Your goal is to create a persistent and logical world THAT FOLLOWS THE ESTABLISHED STORY ARC.
      Story Arc to follow:
      - Title: ${storyArc.title}
      - Goal: ${storyArc.overallGoal}
      - Plot: ${storyArc.keyPlotPoints.join(' -> ')}

      DIFFICULTY RULES:
      - Easy: The player sees all objectives. You should provide clear hints if the player asks for them or seems stuck.
      - Medium: The player only sees their current objective. Provide only SUBTLE, cryptic hints, and only if the player explicitly asks for help.
      - Hard: The player sees no objectives. NEVER provide hints or guidance. Be descriptive but do not lead the player.

      Your Task: Given the context, determine the outcome. Critically, evaluate if the player's action fulfills one of the Key Plot Points. If it does, set the 'objectiveCompleted' field to the exact string of the completed plot point. Respond ONLY with a valid JSON object matching the provided schema. The 'imagePrompt' you generate is critical: it must describe the *entire* scene in detail, but specifically mention the *change* that just occurred to create a sense of a persistent, evolving world. Be creative and surprising, but stay true to the plot. You can award score for clever actions and deduct lives for dangerous ones.`;

    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: this.gameLogicSchema
      }
    });

    try {
      const jsonText = response.text.trim();
      return JSON.parse(jsonText) as GameLogicResponse;
    } catch(e) {
      console.error("Failed to parse JSON from Gemini:", response.text);
      throw new Error("The story took an unexpected turn. The fabric of reality seems to have frayed.");
    }
  }

  async generateSceneImage(prompt: string): Promise<string> {
    const fullPrompt = `${prompt}, photorealistic, hyper-detailed, cinematic lighting, Unreal Engine 5 render, 8k`;

    const response = await this.ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: fullPrompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '16:9',
      },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      return response.generatedImages[0].image.imageBytes;
    } else {
      throw new Error('Image generation failed to produce an image.');
    }
  }
}