import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FarmService } from '../../services/farm.service';
import { Farm } from '../../models/user.model';

@Component({
  selector: 'app-farms',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './farms.component.html',
  styleUrl: './farms.component.scss',
})
export class FarmsComponent implements OnInit {
  private farmService = inject(FarmService);

  farms = signal<Farm[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.farmService.getAll().subscribe({
      next: (f) => { this.farms.set(f); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
