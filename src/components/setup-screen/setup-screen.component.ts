import { Component, ChangeDetectionStrategy, output, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AdventureConfig } from '../../models/game.model';
import { LoadingSpinnerComponent } from '../loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-setup-screen',
  standalone: true,
  imports: [FormsModule, CommonModule, LoadingSpinnerComponent],
  templateUrl: './setup-screen.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetupScreenComponent {
  startGeneration = output<AdventureConfig>();
  isLoading = input.required<boolean>();
  error = input<string | null>();

  genres = ['Fantasy', 'Sci-Fi', 'Mystery', 'Horror', 'Cyberpunk', 'Custom'];
  
  config: AdventureConfig = {
    scenes: 5,
    difficulty: 'Medium',
    genre: 'Fantasy',
    completionTime: 'Medium',
    customGenre: ''
  };

  onSubmit() {
    if (this.config.genre === 'Custom' && !this.config.customGenre?.trim()) {
      alert('Please describe your custom genre.');
      return;
    }
    this.startGeneration.emit(this.config);
  }
}
