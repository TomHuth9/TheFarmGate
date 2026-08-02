import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface LatLng {
  lat: number;
  lng: number;
}

interface SingleResponse {
  result: { latitude: number; longitude: number } | null;
}

interface BulkResponse {
  result: Array<{ query: string; result: { latitude: number; longitude: number } | null }>;
}

@Injectable({ providedIn: 'root' })
export class PostcodeService {
  private readonly API = 'https://api.postcodes.io';

  constructor(private http: HttpClient) {}

  lookup(postcode: string): Observable<LatLng | null> {
    const encoded = encodeURIComponent(postcode.trim());
    return this.http.get<SingleResponse>(`${this.API}/postcodes/${encoded}`).pipe(
      map((res) =>
        res.result ? { lat: res.result.latitude, lng: res.result.longitude } : null
      ),
      catchError(() => of(null)),
    );
  }

  // Returns one LatLng per input postcode (null where lookup failed), preserving order.
  bulkLookup(postcodes: string[]): Observable<(LatLng | null)[]> {
    if (postcodes.length === 0) return of([]);
    return this.http.post<BulkResponse>(`${this.API}/postcodes`, { postcodes }).pipe(
      map((res) =>
        res.result.map((item) =>
          item.result
            ? { lat: item.result.latitude, lng: item.result.longitude }
            : null
        )
      ),
      catchError(() => of(postcodes.map(() => null))),
    );
  }

  distanceKm(a: LatLng, b: LatLng): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const chord =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord));
  }
}
