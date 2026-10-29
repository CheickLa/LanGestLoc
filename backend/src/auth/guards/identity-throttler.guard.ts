import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { Request } from 'express';
import { JwtPayload } from '@/auth/strategies/jwt.strategy';
import { trackByIp } from './throttle-trackers';

const BEARER = /^(\S+)\s+(\S+)$/;

/**
 * Garde de rate-limiting globale : compte par utilisateur et version de jeton
 * quand la requête porte un JWT valide, par IP sinon. Avec la version, un jeton
 * révoqué n'entame pas le compteur de la session en cours. En prod, toutes les requêtes arrivent
 * du BFF Vercel via Caddy : compter par IP seule mettrait tous les
 * utilisateurs dans le même compteur.
 *
 * Les gardes globales s'exécutent avant `JwtAuthGuard` : le jeton est donc
 * vérifié ici, avec le secret de `JwtModule` (le même que `JwtStrategy`).
 */
@Injectable()
export class IdentityThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: Request): Promise<string> {
    const payload = await this.verifiedPayload(req.headers.authorization);

    return payload === null
      ? trackByIp(req.ip)
      : `user:${payload.sub}:${payload.ver}`;
  }

  private async verifiedPayload(
    authorization: string | undefined,
  ): Promise<JwtPayload | null> {
    const match = BEARER.exec(authorization ?? '');
    if (!match || match[1].toLowerCase() !== 'bearer') return null;

    try {
      return await this.jwtService.verifyAsync<JwtPayload>(match[2]);
    } catch {
      return null;
    }
  }
}
