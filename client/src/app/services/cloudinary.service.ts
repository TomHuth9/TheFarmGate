import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CloudinaryService {
  private http = inject(HttpClient);

  upload(file: File) {
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', environment.cloudinaryUploadPreset);
    return this.http
      .post<{ secure_url: string }>(
        `https://api.cloudinary.com/v1_1/${environment.cloudinaryCloudName}/image/upload`,
        form
      )
      .pipe(map(r => r.secure_url));
  }
}
