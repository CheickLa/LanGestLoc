import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtPayload, JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const findUnique = jest.fn();
  const strategy = new JwtStrategy(
    { get: () => 'secret' } as unknown as ConfigService,
    { user: { findUnique } } as unknown as PrismaService,
  );

  beforeEach(() => findUnique.mockReset());

  it("lit l'utilisateur en base : le rôle et l'e-mail viennent de la base, pas du jeton", async () => {
    findUnique.mockResolvedValue({
      id: 1,
      email: 'nouveau@test.com',
      role: Role.USER,
      tokenVersion: 2,
    });

    const user = await strategy.validate({ sub: 1, ver: 2 });

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { id: true, email: true, role: true, tokenVersion: true },
    });
    expect(user).toEqual({ id: 1, email: 'nouveau@test.com', role: Role.USER });
  });

  it("refuse le jeton d'un utilisateur supprimé", async () => {
    findUnique.mockResolvedValue(null);

    await expect(strategy.validate({ sub: 1, ver: 0 })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('refuse un jeton émis avant un changement de mot de passe', async () => {
    findUnique.mockResolvedValue({
      id: 1,
      email: 'john@test.com',
      role: Role.USER,
      tokenVersion: 3,
    });

    await expect(strategy.validate({ sub: 1, ver: 2 })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('refuse un jeton sans version (émis avant cette règle)', async () => {
    findUnique.mockResolvedValue({
      id: 1,
      email: 'john@test.com',
      role: Role.USER,
      tokenVersion: 0,
    });

    await expect(strategy.validate({ sub: 1 } as JwtPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
