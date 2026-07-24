import { sanitizeReturnUrl } from './return-url.utils';

describe('sanitizeReturnUrl', () => {
  it('accepts relative in-app paths', () => {
    expect(sanitizeReturnUrl('/dashboard')).toBe('/dashboard');
    expect(sanitizeReturnUrl('/recipes/abc?tab=1')).toBe('/recipes/abc?tab=1');
  });

  it('rejects absolute and protocol-relative URLs', () => {
    expect(sanitizeReturnUrl('https://evil.example/phish')).toBeNull();
    expect(sanitizeReturnUrl('//evil.example/phish')).toBeNull();
    expect(sanitizeReturnUrl('javascript:alert(1)')).toBeNull();
  });

  it('rejects auth loop targets', () => {
    expect(sanitizeReturnUrl('/auth/login')).toBeNull();
    expect(sanitizeReturnUrl('/login')).toBeNull();
    expect(sanitizeReturnUrl('/auth/callback')).toBeNull();
    expect(sanitizeReturnUrl('/auth/reset-password')).toBeNull();
  });

  it('rejects empty values', () => {
    expect(sanitizeReturnUrl(null)).toBeNull();
    expect(sanitizeReturnUrl(undefined)).toBeNull();
    expect(sanitizeReturnUrl('')).toBeNull();
    expect(sanitizeReturnUrl('dashboard')).toBeNull();
  });
});
