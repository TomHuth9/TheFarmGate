import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FarmService } from '../../services/farm.service';
import { PostcodeService } from '../../services/postcode.service';
import { Farm } from '../../models/user.model';

type FarmWithDistance = Farm & { distanceMi?: number };

@Component({
  selector: 'app-farms',
  standalone: true,
  imports: [
    RouterLink, ReactiveFormsModule,
    MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule,
  ],
  templateUrl: './farms.component.html',
  styleUrl: './farms.component.scss',
})
export class FarmsComponent implements OnInit {
  private farmService = inject(FarmService);
  private postcodeService = inject(PostcodeService);

  farms = signal<Farm[]>([]);
  loading = signal(true);
  searching = signal(false);
  locationError = signal<string | null>(null);
  activePostcode = signal<string | null>(null);

  private farmDistances = signal<Map<string, number>>(new Map());

  postcodeControl = new FormControl('');

  sortedFarms = computed<FarmWithDistance[]>(() => {
    const distances = this.farmDistances();
    const withDist: FarmWithDistance[] = this.farms().map((f) => ({
      ...f,
      distanceMi: distances.get(f._id),
    }));
    if (distances.size === 0) return withDist;
    return withDist.sort((a, b) => {
      const da = a.distanceMi ?? Infinity;
      const db = b.distanceMi ?? Infinity;
      if (da !== db) return da - db;
      return (a.farmName || a.name).localeCompare(b.farmName || b.name);
    });
  });

  ngOnInit() {
    this.farmService.getAll().subscribe({
      next: (f) => { this.farms.set(f); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  search() {
    const raw = this.postcodeControl.value?.trim();
    if (!raw) return;
    this.searching.set(true);
    this.locationError.set(null);

    this.postcodeService.lookup(raw).subscribe((userCoords) => {
      if (!userCoords) {
        this.locationError.set('Postcode not found. Please check and try again.');
        this.searching.set(false);
        return;
      }

      const farmsWithPostcode = this.farms().filter((f) => f.postcode);

      if (farmsWithPostcode.length === 0) {
        this.activePostcode.set(raw.toUpperCase());
        this.farmDistances.set(new Map());
        this.searching.set(false);
        return;
      }

      this.postcodeService
        .bulkLookup(farmsWithPostcode.map((f) => f.postcode!))
        .subscribe((coords) => {
          const distances = new Map<string, number>();
          farmsWithPostcode.forEach((farm, i) => {
            const c = coords[i];
            if (c) {
              const miles = Math.round(this.postcodeService.distanceKm(userCoords, c) * 0.6214);
              distances.set(farm._id, miles);
            }
          });
          this.farmDistances.set(distances);
          this.activePostcode.set(raw.toUpperCase());
          this.searching.set(false);
        });
    });
  }

  clearSearch() {
    this.postcodeControl.setValue('');
    this.activePostcode.set(null);
    this.farmDistances.set(new Map());
    this.locationError.set(null);
  }
}
