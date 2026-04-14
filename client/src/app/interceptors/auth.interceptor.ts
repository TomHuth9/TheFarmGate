import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';

// Attach credentials (httpOnly cookie) to all requests targeting the API.
// Scoping prevents credentials being sent to third-party URLs (fonts, CDNs, etc.).
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.startsWith(environment.apiUrl)) {
    return next(req.clone({ withCredentials: true }));
  }
  return next(req);
};
