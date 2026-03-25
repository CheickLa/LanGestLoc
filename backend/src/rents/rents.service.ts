import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { CreateRentDto } from './dto/create-rent.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { ContractStatus } from '@generated/prisma/client';

@Injectable()
export class RentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRentDto) {
    const { contractId, amount, effectiveFrom } = dto;
    const newEffectiveFrom = new Date(effectiveFrom);

    const contract = await this.prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract) throw new NotFoundException(`Contrat #${contractId} non trouvé`);
    if (contract.status !== ContractStatus.ACTIVE) throw new ConflictException(`Le contrat #${contractId} n'est pas actif`);

    // Trouver le loyer actif (effectiveTo = null)
    const activeRent = await this.prisma.rent.findFirst({
      where: { contractId, effectiveTo: null },
    });
    if (!activeRent) throw new ConflictException(`Aucun loyer actif trouvé sur le contrat #${contractId}`);

    // Le nouveau montant doit être différent de l'actuel
    if (amount === activeRent.amount) {
      throw new BadRequestException(
        `Le nouveau montant (${amount}) est identique au loyer actuel — aucune modification nécessaire`,
      );
    }

    // La date d'entrée en vigueur doit être strictement après effectiveFrom de l'actuel
    if (newEffectiveFrom <= activeRent.effectiveFrom) {
      throw new BadRequestException(
        `La date d'entrée en vigueur doit être après le ${activeRent.effectiveFrom.toISOString().split('T')[0]}`,
      );
    }

    // effectiveTo de l'ancien = veille du nouveau effectiveFrom
    const effectiveTo = new Date(newEffectiveFrom);
    effectiveTo.setUTCDate(effectiveTo.getUTCDate() - 1);

    return this.prisma.$transaction(async (tx) => {
      // Clôturer l'ancien loyer
      await tx.rent.update({
        where: { id: activeRent.id },
        data: { effectiveTo },
      });

      // Créer le nouveau loyer
      return tx.rent.create({
        data: {
          contractId,
          amount,
          effectiveFrom: newEffectiveFrom,
        },
      });
    });
  }

  async findCurrent(contractId: number) {
    const contract = await this.prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract) throw new NotFoundException(`Contrat #${contractId} non trouvé`);

    const rent = await this.prisma.rent.findFirst({
      where: { contractId, effectiveTo: null },
    });
    if (!rent) throw new NotFoundException(`Aucun loyer actif sur le contrat #${contractId}`);
    return rent;
  }

  async findAllByContract(contractId: number) {
    const contract = await this.prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract) throw new NotFoundException(`Contrat #${contractId} non trouvé`);

    return this.prisma.rent.findMany({
      where: { contractId },
      orderBy: { effectiveFrom: 'asc' },
    });
  }
}


