import { Component, ChangeDetectionStrategy, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GameStateService } from './services/game-state.service';
import { LoadingSpinnerComponent } from './components/loading-spinner/loading-spinner.component';
import { SetupScreenComponent } from './components/setup-screen/setup-screen.component';
import { AdventureConfig } from './models/game.model';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingSpinnerComponent, SetupScreenComponent]
})
export class AppComponent {
  gameStateService = inject(GameStateService);

  playerInput = signal('');
  
  // Signals for reactivity in the template
  gameState = this.gameStateService.gameState;
  isLoading = this.gameStateService.isLoading;
  error = this.gameStateService.error;
  gamePhase = this.gameStateService.gamePhase;
  
  // Use a signal to manage the background image URL for smooth transitions
  currentBackgroundImageUrl = signal<string | null>(null);

  constructor() {
    effect(() => {
      const newImageUrl = this.gameState()?.scene.imageUrl;
      if (newImageUrl) {
        // Preload the image before setting it as the background
        const img = new Image();
        img.src = newImageUrl;
        img.onload = () => {
          this.currentBackgroundImageUrl.set(newImageUrl);
        };
      }
    }, { allowSignalWrites: true });
  }

  titleFontClass = computed(() => {
    const genre = this.gameState()?.genre ?? 'default';
    switch (genre.toLowerCase()) {
      case 'fantasy':
        return 'font-fantasy';
      case 'sci-fi':
        return 'font-scifi';
      case 'mystery':
        return 'font-mystery';
      case 'horror':
        return 'font-horror';
      case 'cyberpunk':
        return 'font-cyberpunk';
      default:
        return 'font-fantasy'; // A good default
    }
  });

  startAdventure(config: AdventureConfig) {
    this.gameStateService.setupAndStartGame(config);
  }

  submitAction() {
    const input = this.playerInput().trim();
    if (!input || this.isLoading()) return;
    
    this.gameStateService.processPlayerAction(input);
    this.playerInput.set('');
  }

  startOver() {
    this.currentBackgroundImageUrl.set(null);
    this.gameStateService.resetGame();
  }
}