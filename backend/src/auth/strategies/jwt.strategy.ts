import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '@generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

export interface JwtPayload {
  sub: number;
  ver: number;
}

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: Role;
}

export interface AuthenticatedRequest {
  user: AuthenticatedUser;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  // Lu en base à chaque requête : un compte supprimé, un rôle retiré ou un mot
  // de passe changé prennent effet sans attendre l'expiration du jeton
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, tokenVersion: true },
    });

    if (!user || user.tokenVersion !== payload.ver) {
      throw new UnauthorizedException(
        'Session invalide, veuillez vous reconnecter',
      );
    }

    return { id: user.id, email: user.email, role: user.role };
  }
}
