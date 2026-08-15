import { HttpInterceptorFn } from '@angular/common/http';

const GOVERNED_ROOTS = ['/api', '/auth', '/schemas'] as const;

/**
 * Carries the host-owned HttpOnly session only to Praxis governance surfaces.
 *
 * Relative URLs work behind the local same-origin proxy. Absolute URLs are used
 * by a separately deployed Studio and require `withCredentials` for the same
 * session contract. Static assets, projections and unrelated external URLs do
 * not receive ambient credentials.
 */
export const governedCredentialsInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.withCredentials || !isGovernedUrl(request.url)) return next(request);
  return next(request.clone({ withCredentials: true }));
};

function isGovernedUrl(value: string): boolean {
  let pathname: string;
  try {
    pathname = new URL(value, 'https://policy-studio.invalid').pathname;
  } catch {
    return false;
  }
  return GOVERNED_ROOTS.some(root => pathname === root || pathname.startsWith(`${root}/`));
}
