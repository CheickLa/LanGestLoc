import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateLocalDto } from './dto/create-local.dto';
import { UpdateLocalDto } from './dto/update-local.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma, ContractStatus } from '@generated/prisma/client';
import { FindLocalsQueryDto } from './dto/find-locals-query.dto';

@Injectable()
export class LocalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createLocalDto: CreateLocalDto) {
    const existingLocal = await this.prisma.local.findUnique({
      where: { code: createLocalDto.code },
    });

    if (existingLocal) {
      throw new ConflictException(
        `Un local avec le code ${createLocalDto.code} existe déjà`,
      );
    }

    return this.prisma.local.create({
      data: createLocalDto,
    });
  }

  async findAll({ skip, take, search }: FindLocalsQueryDto) {
    const where: Prisma.LocalWhereInput = search
      ? {
          OR: [
            { code: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [locals, total] = await this.prisma.$transaction([
      this.prisma.local.findMany({
        where,
        skip,
        take,
        orderBy: { code: 'asc' },
        include: {
          contracts: {
            where: { status: ContractStatus.ACTIVE },
            select: { tenant: { select: { id: true, name: true } } },
            take: 1,
          },
          _count: { select: { contracts: true } },
        },
      }),
      this.prisma.local.count({ where }),
    ]);

    const items = locals.map((local) => {
      const activeContract = local.contracts[0];
      return {
        id: local.id,
        code: local.code,
        name: local.name,
        createdAt: local.createdAt,
        status: activeContract ? ('OCCUPIED' as const) : ('VACANT' as const),
        currentTenant: activeContract ? activeContract.tenant : null,
        hasContracts: local._count.contracts > 0,
      };
    });

    return { items, total, skip, take };
  }

  async findOne(id: number) {
    const local = await this.prisma.local.findUnique({ where: { id } });

    if (!local) {
      throw new NotFoundException(`Local avec l'ID ${id} non trouvé`);
    }

    return local;
  }

  async update(id: number, updateLocalDto: UpdateLocalDto) {
    const local = await this.prisma.local.findUnique({ where: { id } });

    if (!local) {
      throw new NotFoundException(`Local avec l'ID ${id} non trouvé`);
    }

    if (updateLocalDto.code && updateLocalDto.code !== local.code) {
      const existing = await this.prisma.local.findUnique({
        where: { code: updateLocalDto.code },
      });
      if (existing) {
        throw new ConflictException(
          `Un local avec le code ${updateLocalDto.code} existe déjà`,
        );
      }
    }

    return this.prisma.local.update({
      where: { id },
      data: updateLocalDto,
    });
  }

  async remove(id: number) {
    const local = await this.prisma.local.findUnique({
      where: { id },
      include: { contracts: { take: 1 } },
    });

    if (!local) {
      throw new NotFoundException(`Local avec l'ID ${id} non trouvé`);
    }

    if (local.contracts.length > 0) {
      throw new ConflictException(
        `Impossible de supprimer un local ayant des contrats`,
      );
    }

    return this.prisma.local.delete({ where: { id } });
  }
}
