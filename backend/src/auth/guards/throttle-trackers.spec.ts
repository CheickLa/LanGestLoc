import { trackByIp, trackLoginByEmail } from './throttle-trackers';

const IP = '203.0.113.7';

describe('trackByIp', () => {
  it("préfixe l'IP", () => {
    expect(trackByIp(IP)).toBe('ip:203.0.113.7');
  });

  it("reste utilisable quand l'IP est inconnue", () => {
    expect(trackByIp(undefined)).toBe('ip:inconnue');
  });
});

describe('trackLoginByEmail', () => {
  it('compte par e-mail normalisé comme LoginDto (espaces et casse ignorés)', () => {
    const req = {
      body: { email: ' Admin@Example.COM ', password: 'x' },
      ip: IP,
    };

    expect(trackLoginByEmail(req)).toBe('login:admin@example.com');
  });

  it("retombe sur l'IP quand l'e-mail est absent", () => {
    expect(trackLoginByEmail({ body: { password: 'x' }, ip: IP })).toBe(
      'ip:203.0.113.7',
    );
  });

  it("retombe sur l'IP quand l'e-mail est vide ou n'est pas une chaîne", () => {
    expect(trackLoginByEmail({ body: { email: '   ' }, ip: IP })).toBe(
      'ip:203.0.113.7',
    );
    expect(trackLoginByEmail({ body: { email: 42 }, ip: IP })).toBe(
      'ip:203.0.113.7',
    );
  });

  it("retombe sur l'IP quand le corps est absent", () => {
    expect(trackLoginByEmail({ ip: IP })).toBe('ip:203.0.113.7');
  });
});
