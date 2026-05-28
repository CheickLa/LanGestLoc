import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma, Role } from '@generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';

const SALT_ROUNDS = 10;

const userSafeSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async updateMe(userId: number, dto: UpdateUserDto) {
    if (dto.name === undefined && dto.email === undefined) {
      throw new BadRequestException('Aucune donnée à mettre à jour');
    }

    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.email !== undefined && { email: dto.email }),
        },
        select: userSafeSelect,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(`Un utilisateur avec l'email ${dto.email} existe déjà`);
        }
        if (error.code === 'P2025') {
          throw new NotFoundException(`Utilisateur avec l'ID ${userId} non trouvé`);
        }
      }
      throw error;
    }
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'Le nouveau mot de passe doit être différent du mot de passe actuel',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user) {
      throw new NotFoundException(`Utilisateur avec l'ID ${userId} non trouvé`);
    }

    const isCurrentValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isCurrentValid) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Mot de passe mis à jour' };
  }

  async findAll({ skip, take }: PaginationDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        skip,
        take,
        select: userSafeSelect,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);

    return { items, total, skip, take };
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSafeSelect,
    });
    if (!user) {
      throw new NotFoundException(`Utilisateur avec l'ID ${id} non trouvé`);
    }
    return user;
  }

  async adminUpdate(id: number, dto: AdminUpdateUserDto) {
    if (dto.name === undefined && dto.email === undefined && dto.role === undefined) {
      throw new BadRequestException('Aucune donnée à mettre à jour');
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const target = await tx.user.findUnique({
            where: { id },
            select: { id: true, role: true },
          });
          if (!target) {
            throw new NotFoundException(`Utilisateur avec l'ID ${id} non trouvé`);
          }

          if (
            dto.role !== undefined &&
            target.role === Role.ADMIN &&
            dto.role !== Role.ADMIN
          ) {
            await this.assertNotLastAdmin(tx, id);
          }

          return tx.user.update({
            where: { id },
            data: {
              ...(dto.name !== undefined && { name: dto.name }),
              ...(dto.email !== undefined && { email: dto.email }),
              ...(dto.role !== undefined && { role: dto.role }),
            },
            select: userSafeSelect,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`Un utilisateur avec l'email ${dto.email} existe déjà`);
      }
      throw error;
    }
  }

  async remove(id: number, currentUserId: number) {
    if (id === currentUserId) {
      throw new BadRequestException('Vous ne pouvez pas supprimer votre propre compte');
    }

    await this.prisma.$transaction(
      async (tx) => {
        const target = await tx.user.findUnique({
          where: { id },
          select: { id: true, role: true },
        });
        if (!target) {
          throw new NotFoundException(`Utilisateur avec l'ID ${id} non trouvé`);
        }

        if (target.role === Role.ADMIN) {
          await this.assertNotLastAdmin(tx, id);
        }

        const [contractsCount, paymentsCount] = await Promise.all([
          tx.contract.count({ where: { createdById: id } }),
          tx.payment.count({ where: { createdById: id } }),
        ]);

        if (contractsCount > 0 || paymentsCount > 0) {
          throw new ConflictException(
            'Impossible de supprimer un utilisateur lié à des contrats ou paiements',
          );
        }

        await tx.user.delete({ where: { id } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async assertNotLastAdmin(
    tx: Prisma.TransactionClient,
    excludedId: number,
  ) {
    const otherAdmins = await tx.user.count({
      where: { role: Role.ADMIN, id: { not: excludedId } },
    });
    if (otherAdmins === 0) {
      throw new BadRequestException(
        'Impossible : il doit rester au moins un administrateur actif',
      );
    }
  }
}
