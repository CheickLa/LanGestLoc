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

  it('compte par utilisateur quand le JWT est valide', async () => {
    const token = jwtService.sign({ sub: 42, email: 'a@b.c', role: 'USER' });

    await expect(track(request(`Bearer ${token}`))).resolves.toBe('user:42');
  });

  it('accepte le schéma Bearer quelle que soit sa casse', async () => {
    const token = jwtService.sign({ sub: 42 });

    await expect(track(request(`bearer ${token}`))).resolves.toBe('user:42');
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
