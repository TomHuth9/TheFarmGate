import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.scss',
})
export class VerifyEmailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);

  loading = signal(true);
  success = signal(false);

  ngOnInit() {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    this.auth.verifyEmail(token).subscribe({
      next: () => { this.success.set(true); this.loading.set(false); },
      error: () => { this.success.set(false); this.loading.set(false); },
    });
  }
}
