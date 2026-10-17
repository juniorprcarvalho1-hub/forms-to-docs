import { expect, test } from 'bun:test';
import { withSecurityHeaders } from './security-headers';

test('proteções preservam conteúdo, status e cabeçalhos da aplicação', async () => {
  const response = withSecurityHeaders(new Response('ok', {status: 401, headers: {'content-type':'text/plain','set-cookie':'session=example; HttpOnly'}}));
  expect(response.status).toBe(401);
  expect(await response.text()).toBe('ok');
  expect(response.headers.get('set-cookie')).toBe('session=example; HttpOnly');
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  expect(response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
});
