import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@generated/prisma/client';
import { FindTenantsQueryDto } from './dto/find-tenants-query.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTenantDto: CreateTenantDto) {
    if (new Date(createTenantDto.dateOfBirth) >= new Date()) {
      throw new BadRequestException(
        'La date de naissance doit être dans le passé',
      );
    }

    const [existingByIdNumber, existingByPhone] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { idNumber: createTenantDto.idNumber },
      }),
      this.prisma.tenant.findUnique({
        where: { phone: createTenantDto.phone },
      }),
    ]);

    if (existingByIdNumber) {
      throw new ConflictException(
        `Un locataire avec le numéro d'identité ${createTenantDto.idNumber} existe déjà`,
      );
    }

    if (existingByPhone) {
      throw new ConflictException(
        `Un locataire avec le numéro de téléphone ${createTenantDto.phone} existe déjà`,
      );
    }

    return this.prisma.tenant.create({
      data: {
        ...createTenantDto,
        dateOfBirth: new Date(createTenantDto.dateOfBirth),
      },
    });
  }

  async findAll({ skip, take, search }: FindTenantsQueryDto) {
    const where: Prisma.TenantWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { idNumber: { contains: search, mode: 'insensitive' } },
            { activity: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [tenants, total] = await this.prisma.$transaction([
      this.prisma.tenant.findMany({
        where,
        skip,
        take,
        // Départage par id : les noms ne sont pas uniques, l'ordre doit être stable entre pages
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        include: { _count: { select: { contracts: true } } },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    const items = tenants.map(({ _count, ...tenant }) => ({
      ...tenant,
      hasContracts: _count.contracts > 0,
    }));

    return { items, total, skip, take };
  }

  async findOne(id: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException(`Locataire avec l'ID ${id} non trouvé`);
    }

    return tenant;
  }

  async update(id: number, updateTenantDto: UpdateTenantDto) {
    await this.findOne(id);

    if (
      updateTenantDto.dateOfBirth &&
      new Date(updateTenantDto.dateOfBirth) >= new Date()
    ) {
      throw new BadRequestException(
        'La date de naissance doit être dans le passé',
      );
    }

    if (updateTenantDto.idNumber) {
      const existing = await this.prisma.tenant.findUnique({
        where: { idNumber: updateTenantDto.idNumber },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Un locataire avec le numéro d'identité ${updateTenantDto.idNumber} existe déjà`,
        );
      }
    }

    if (updateTenantDto.phone) {
      const existing = await this.prisma.tenant.findUnique({
        where: { phone: updateTenantDto.phone },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Un locataire avec le numéro de téléphone ${updateTenantDto.phone} existe déjà`,
        );
      }
    }

    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...updateTenantDto,
        ...(updateTenantDto.dateOfBirth && {
          dateOfBirth: new Date(updateTenantDto.dateOfBirth),
        }),
      },
    });
  }

  async remove(id: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { contracts: { take: 1 } },
    });

    if (!tenant) {
      throw new NotFoundException(`Locataire avec l'ID ${id} non trouvé`);
    }

    if (tenant.contracts.length > 0) {
      throw new ConflictException(
        `Impossible de supprimer le locataire avec l'ID ${id} car il est lié à des contrats existants`,
      );
    }

    return this.prisma.tenant.delete({
      where: { id },
    });
  }
}
