import { parseTrustProxyHops } from './trust-proxy';

describe('parseTrustProxyHops', () => {
  it('vaut 0 quand la variable est absente ou vide', () => {
    expect(parseTrustProxyHops(undefined)).toBe(0);
    expect(parseTrustProxyHops('')).toBe(0);
    expect(parseTrustProxyHops('  ')).toBe(0);
  });

  it('lit un entier positif ou nul', () => {
    expect(parseTrustProxyHops('0')).toBe(0);
    expect(parseTrustProxyHops('1')).toBe(1);
    expect(parseTrustProxyHops(' 2 ')).toBe(2);
  });

  it.each(['un', '-1', '1.5', 'true'])(
    'refuse de démarrer sur une valeur invalide : %s',
    (raw) => {
      expect(() => parseTrustProxyHops(raw)).toThrow(
        'TRUST_PROXY_HOPS doit être un entier positif ou nul',
      );
    },
  );
});
