import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateLocalDto } from './dto/create-local.dto';
import { UpdateLocalDto } from './dto/update-local.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { PaginationDto } from '@/common/dto/pagination.dto';

@Injectable()
export class LocalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createLocalDto: CreateLocalDto) {
    const existingLocal = await this.prisma.local.findUnique({
      where: { code: createLocalDto.code },
    });

    if (existingLocal) {
      throw new ConflictException(`Un local avec le code ${createLocalDto.code} existe déjà`);
    }

    return this.prisma.local.create({
      data: createLocalDto,
    });
  }

  async findAll({ skip, take }: PaginationDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.local.findMany({ skip, take }),
      this.prisma.local.count(),
    ]);

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
        throw new ConflictException(`Un local avec le code ${updateLocalDto.code} existe déjà`);
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