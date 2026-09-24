import { ThrottlerStorageService } from '@nestjs/throttler';

/**
 * Contrat du stockage de @nestjs/throttler dont dépend le rate-limiting par
 * identité : quand le blocage d'un traceur prend fin (ex. un anonyme sur
 * /auth/login), les compteurs des autres traceurs doivent continuer de
 * redescendre. En 6.5.0, la fin d'un blocage annulait les décréments de
 * toutes les clés : un utilisateur légitime finissait bloqué à tort.
 */
describe('ThrottlerStorageService — contrat', () => {
  const TTL = 1000;
  const LIMIT = 5;
  let storage: ThrottlerStorageService;

  const hit = (key: string) =>
    storage.increment(key, TTL, LIMIT, TTL, 'default');

  beforeEach(() => {
    jest.useFakeTimers();
    storage = new ThrottlerStorageService();
  });

  afterEach(() => {
    storage.onApplicationShutdown();
    jest.useRealTimers();
  });

  it("la fin du blocage d'un traceur ne fige pas les compteurs des autres", async () => {
    for (let i = 0; i < LIMIT + 1; i++) await hit('login:attaquant@x.io');
    jest.advanceTimersByTime(TTL + 50);

    for (let i = 0; i < 3; i++) await hit('user:1');
    await hit('login:attaquant@x.io'); // fin du blocage de l'attaquant

    jest.advanceTimersByTime(TTL * 3);
    const next = await hit('user:1');

    expect(next.totalHits).toBe(1);
    expect(next.isBlocked).toBe(false);
  });
});
