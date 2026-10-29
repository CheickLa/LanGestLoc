import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerStorage } from '@nestjs/throttler';
import { Request } from 'express';
import { IdentityThrottlerGuard } from './identity-throttler.guard';

const IP = '203.0.113.7';

function request(authorization?: string): Request {
  return {
    headers: authorization ? { authorization } : {},
    ip: IP,
  } as unknown as Request;
}

describe('IdentityThrottlerGuard — getTracker', () => {
  const jwtService = new JwtService({ secret: 'test-secret' });
  const guard = new IdentityThrottlerGuard(
    [],
    {} as ThrottlerStorage,
    new Reflector(),
    jwtService,
  );
  const track = (req: Request) => guard['getTracker'](req);

  it('compte par utilisateur et version de jeton quand le JWT est valide', async () => {
    const token = jwtService.sign({ sub: 42, ver: 3 });

    await expect(track(request(`Bearer ${token}`))).resolves.toBe('user:42:3');
  });

  it("un jeton révoqué n'entame pas le compteur du jeton en cours", async () => {
    const revoked = jwtService.sign({ sub: 42, ver: 2 });
    const current = jwtService.sign({ sub: 42, ver: 3 });

    expect(await track(request(`Bearer ${revoked}`))).not.toBe(
      await track(request(`Bearer ${current}`)),
    );
  });

  it('accepte le schéma Bearer quelle que soit sa casse', async () => {
    const token = jwtService.sign({ sub: 42, ver: 3 });

    await expect(track(request(`bearer ${token}`))).resolves.toBe('user:42:3');
  });

  it('compte par IP sans en-tête Authorization', async () => {
    await expect(track(request())).resolves.toBe(`ip:${IP}`);
  });

  it("compte par IP quand le schéma n'est pas Bearer", async () => {
    const token = jwtService.sign({ sub: 42 });

    await expect(track(request(`Basic ${token}`))).resolves.toBe(`ip:${IP}`);
  });

  it('compte par IP quand le JWT est expiré', async () => {
    const token = jwtService.sign({
      sub: 42,
      exp: Math.floor(Date.now() / 1000) - 60,
    });

    await expect(track(request(`Bearer ${token}`))).resolves.toBe(`ip:${IP}`);
  });

  it('compte par IP quand le JWT est signé avec un autre secret', async () => {
    const token = new JwtService({ secret: 'ancien-secret' }).sign({ sub: 42 });

    await expect(track(request(`Bearer ${token}`))).resolves.toBe(`ip:${IP}`);
  });

  it('compte par IP quand le jeton est illisible', async () => {
    await expect(track(request('Bearer pas-un-jwt'))).resolves.toBe(`ip:${IP}`);
  });
});
