import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { CreateRentDto } from './dto/create-rent.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { firstOfMonth } from '@/common/months';
import { ContractStatus } from '@generated/prisma/client';

@Injectable()
export class RentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRentDto) {
    const { contractId, amount, effectiveFrom } = dto;
    const newEffectiveFrom = new Date(effectiveFrom);

    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });
    if (!contract)
      throw new NotFoundException(`Contrat #${contractId} non trouvé`);
    if (contract.status !== ContractStatus.ACTIVE)
      throw new ConflictException(`Le contrat #${contractId} n'est pas actif`);

    // Trouver le loyer actif (effectiveTo = null)
    const activeRent = await this.prisma.rent.findFirst({
      where: { contractId, effectiveTo: null },
    });
    if (!activeRent)
      throw new ConflictException(
        `Aucun loyer actif trouvé sur le contrat #${contractId}`,
      );

    // Une augmentation : le nouveau montant doit être strictement supérieur à l'actuel
    if (amount <= activeRent.amount) {
      throw new BadRequestException(
        `Le nouveau loyer (${amount}) doit être supérieur au loyer actuel (${activeRent.amount})`,
      );
    }

    // La facturation est mensuelle : une augmentation prend effet au 1er d'un mois,
    // pour qu'une échéance (toujours datée au 1er) corresponde à un seul loyer.
    if (newEffectiveFrom.getUTCDate() !== 1) {
      throw new BadRequestException(
        "La date d'entrée en vigueur doit être le 1er d'un mois",
      );
    }

    // La date d'entrée en vigueur doit être strictement après effectiveFrom de l'actuel
    if (newEffectiveFrom <= activeRent.effectiveFrom) {
      throw new BadRequestException(
        `La date d'entrée en vigueur doit être après le ${activeRent.effectiveFrom.toISOString().split('T')[0]}`,
      );
    }

    if (contract.endDate && newEffectiveFrom > firstOfMonth(contract.endDate)) {
      throw new BadRequestException(
        "L'augmentation ne peut pas prendre effet après la fin prévue du contrat",
      );
    }

    // Le montant d'une échéance est figé : une augmentation ne vise que des mois pas encore facturés.
    const lastBilled = await this.prisma.rentDue.findFirst({
      where: { contractId, month: { gte: newEffectiveFrom } },
      orderBy: { month: 'desc' },
    });
    if (lastBilled) {
      throw new ConflictException(
        `Le loyer est déjà facturé jusqu'en ${lastBilled.month.toISOString().slice(0, 7)} : l'augmentation doit prendre effet après ce mois`,
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
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });
    if (!contract)
      throw new NotFoundException(`Contrat #${contractId} non trouvé`);

    const rent = await this.prisma.rent.findFirst({
      where: { contractId, effectiveTo: null },
    });
    if (!rent)
      throw new NotFoundException(
        `Aucun loyer actif sur le contrat #${contractId}`,
      );
    return rent;
  }

  async findAllByContract(contractId: number) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });
    if (!contract)
      throw new NotFoundException(`Contrat #${contractId} non trouvé`);

    return this.prisma.rent.findMany({
      where: { contractId },
      orderBy: { effectiveFrom: 'asc' },
    });
  }
}
