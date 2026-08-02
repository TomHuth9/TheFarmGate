import { ApplicationConfig, PLATFORM_ID, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, withFetch, HttpInterceptorFn } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideClientHydration } from '@angular/platform-browser';
import { isPlatformBrowser } from '@angular/common';

import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';

// Converts relative API URLs to absolute when rendering on the server,
// so Node's fetch() can resolve them without a browser context.
const ssrApiUrlInterceptor: HttpInterceptorFn = (req, next) => {
  if (isPlatformBrowser(inject(PLATFORM_ID))) return next(req);
  if (!req.url.startsWith('/')) return next(req);
  const port = (globalThis as unknown as { process?: { env?: Record<string, string> } })
    .process?.env?.['PORT'] ?? '3000';
  return next(req.clone({ url: `http://127.0.0.1:${port}${req.url}` }));
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, ssrApiUrlInterceptor])),
    provideAnimationsAsync(),
    provideClientHydration(),
  ],
};
