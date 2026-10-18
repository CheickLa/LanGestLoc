import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { PrismaService } from '@/prisma/prisma.service';
import { PaymentsService } from '@/payments/payments.service';
import { ContractDocumentsService } from './contract-documents.service';
import {
  ContractStatus,
  PaymentMethod,
  PaymentType,
  Prisma,
  RentDueStatus,
} from '@generated/prisma/client';

const mockTx = {
  $queryRaw: jest.fn(),
  contract: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findFirst: jest.fn(),
  },
  rent: { create: jest.fn() },
  rentDue: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
  },
  deposit: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

type MockTx = typeof mockTx;

const runInTransaction = <T>(
  arg: ((tx: MockTx) => Promise<T>) | Promise<T>[],
) => (Array.isArray(arg) ? Promise.all(arg) : arg(mockTx));

const mockPrisma = {
  local: { findUnique: jest.fn() },
  tenant: { findUnique: jest.fn() },
  contract: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
  $transaction: jest.fn(runInTransaction),
};

const mockPaymentsService = {
  createDepositHeld: jest.fn(),
  createDepositRefund: jest.fn(),
  generateReceiptSafe: jest.fn(),
};

const mockContractDocumentsService = {
  generateSafe: jest.fn(),
};

describe('ContractsService', () => {
  let service: ContractsService;

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2027-06-15'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PaymentsService, useValue: mockPaymentsService },
        {
          provide: ContractDocumentsService,
          useValue: mockContractDocumentsService,
        },
      ],
    }).compile();

    service = module.get<ContractsService>(ContractsService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(runInTransaction);
  });

  const createDto = {
    localId: 1,
    tenantId: 1,
    startDate: '2026-01-01',
    rentAmount: 500000,
    depositPaymentMethod: PaymentMethod.CASH,
    depositPaymentDate: '2026-01-01',
  };

  const mockCreatableContract = () => {
    mockPrisma.local.findUnique.mockResolvedValue({ id: 1 });
    mockPrisma.tenant.findUnique.mockResolvedValue({ id: 1 });
    mockTx.contract.findFirst.mockResolvedValue(null);
    mockTx.contract.create.mockResolvedValue({ id: 1 });
    mockTx.rent.create.mockResolvedValue({ id: 7 });
    mockPaymentsService.createDepositHeld.mockResolvedValue({ id: 55 });
  };

  const due = (month: string, dueDate: string, status: RentDueStatus) => ({
    contractId: 1,
    rentId: 7,
    month: new Date(month),
    amount: 500000,
    dueDate: new Date(dueDate),
    status,
  });

  describe('create', () => {
    it('should create a contract with rent, deposit, and DEPOSIT_HELD payment', async () => {
      mockPrisma.local.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 1 });
      mockTx.contract.findFirst.mockResolvedValue(null);
      const contract = {
        id: 1,
        localId: 1,
        tenantId: 1,
        status: ContractStatus.ACTIVE,
      };
      mockTx.contract.create.mockResolvedValue(contract);
      mockTx.rent.create.mockResolvedValue({ id: 7 });
      mockPaymentsService.createDepositHeld.mockResolvedValue({ id: 55 });

      const result = await service.create(createDto, 1);

      expect(result).toEqual(contract);
      expect(mockTx.rent.create).toHaveBeenCalledWith({
        data: {
          contractId: 1,
          amount: 500000,
          effectiveFrom: new Date('2026-01-01'),
        },
      });
      expect(mockTx.deposit.create).toHaveBeenCalledWith({
        data: { contractId: 1, amount: 500000 },
      });
      expect(mockPaymentsService.createDepositHeld).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          contractId: 1,
          amount: 500000,
          userId: 1,
          paymentDate: new Date('2026-01-01'),
          paymentMethod: PaymentMethod.CASH,
        }),
      );
      expect(mockPaymentsService.generateReceiptSafe).toHaveBeenCalledWith(55);
      expect(mockContractDocumentsService.generateSafe).toHaveBeenCalledWith(1);
    });

    it('should throw BadRequestException when endDate is not after startDate', async () => {
      await expect(
        service.create({ ...createDto, endDate: '2025-12-31' }, 1),
      ).rejects.toThrow(
        'La date de fin doit être postérieure à la date de début',
      );
    });

    it('should throw BadRequestException when depositPaymentDate is in the future', async () => {
      mockPrisma.local.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 1 });

      await expect(
        service.create({ ...createDto, depositPaymentDate: '2030-01-01' }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when local does not exist', async () => {
      mockPrisma.local.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when tenant does not exist', async () => {
      mockPrisma.local.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when local already has an active contract', async () => {
      mockPrisma.local.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 1 });
      mockTx.contract.findFirst.mockResolvedValue({ id: 99 });

      await expect(service.create(createDto, 1)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException on Prisma P2002 (concurrent active contract)', async () => {
      mockPrisma.local.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 1 });
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
        },
      );
      mockPrisma.$transaction.mockRejectedValueOnce(prismaError);

      await expect(service.create(createDto, 1)).rejects.toThrow(
        ConflictException,
      );
    });

    it("refuse une date de début qui ne tombe pas le 1er d'un mois", async () => {
      await expect(
        service.create({ ...createDto, startDate: '2026-01-15' }, 1),
      ).rejects.toThrow("La date de début doit être le 1er d'un mois");
    });

    it("refuse une date de fin qui n'est pas le dernier jour d'un mois", async () => {
      await expect(
        service.create({ ...createDto, endDate: '2026-12-30' }, 1),
      ).rejects.toThrow("La date de fin doit être le dernier jour d'un mois");
    });

    it('crée tous les mois écoulés pour un contrat commencé avant, sans fin', async () => {
      mockCreatableContract();

      await service.create({ ...createDto, startDate: '2027-04-01' }, 1);

      expect(mockTx.rentDue.createMany).toHaveBeenCalledWith({
        data: [
          due('2027-04-01', '2027-05-05', RentDueStatus.LATE),
          due('2027-05-01', '2027-06-05', RentDueStatus.LATE),
          due('2027-06-01', '2027-07-05', RentDueStatus.PENDING),
        ],
      });
    });

    it('crée seulement le mois en cours pour un contrat qui commence ce mois-ci', async () => {
      mockCreatableContract();

      await service.create({ ...createDto, startDate: '2027-06-01' }, 1);

      expect(mockTx.rentDue.createMany).toHaveBeenCalledWith({
        data: [due('2027-06-01', '2027-07-05', RentDueStatus.PENDING)],
      });
    });

    it('ne crée aucune échéance pour un contrat qui commence un mois futur', async () => {
      mockCreatableContract();

      await service.create({ ...createDto, startDate: '2027-07-01' }, 1);

      expect(mockTx.rentDue.createMany).not.toHaveBeenCalled();
    });

    it('crée seulement les mois de la période pour un contrat déjà terminé', async () => {
      mockCreatableContract();

      await service.create(
        { ...createDto, startDate: '2027-01-01', endDate: '2027-03-31' },
        1,
      );

      expect(mockTx.rentDue.createMany).toHaveBeenCalledWith({
        data: [
          due('2027-01-01', '2027-02-05', RentDueStatus.LATE),
          due('2027-02-01', '2027-03-05', RentDueStatus.LATE),
          due('2027-03-01', '2027-04-05', RentDueStatus.LATE),
        ],
      });
    });

    it("s'arrête au mois en cours quand la fin prévue est plus tard", async () => {
      mockCreatableContract();

      await service.create(
        { ...createDto, startDate: '2027-05-01', endDate: '2027-12-31' },
        1,
      );

      expect(mockTx.rentDue.createMany).toHaveBeenCalledWith({
        data: [
          due('2027-05-01', '2027-06-05', RentDueStatus.LATE),
          due('2027-06-01', '2027-07-05', RentDueStatus.PENDING),
        ],
      });
    });

    it('inclut le mois en cours quand la fin tombe ce mois-ci', async () => {
      mockCreatableContract();

      await service.create(
        { ...createDto, startDate: '2027-05-01', endDate: '2027-06-30' },
        1,
      );

      expect(mockTx.rentDue.createMany).toHaveBeenCalledWith({
        data: [
          due('2027-05-01', '2027-06-05', RentDueStatus.LATE),
          due('2027-06-01', '2027-07-05', RentDueStatus.PENDING),
        ],
      });
    });

    it("passe d'une année à l'autre pour un contrat déjà terminé", async () => {
      mockCreatableContract();

      await service.create(
        { ...createDto, startDate: '2026-11-01', endDate: '2027-01-31' },
        1,
      );

      expect(mockTx.rentDue.createMany).toHaveBeenCalledWith({
        data: [
          due('2026-11-01', '2026-12-05', RentDueStatus.LATE),
          due('2026-12-01', '2027-01-05', RentDueStatus.LATE),
          due('2027-01-01', '2027-02-05', RentDueStatus.LATE),
        ],
      });
    });

    it("crée en retard les 21 mois d'un contrat saisi après coup (01/2025 → 09/2026)", async () => {
      mockCreatableContract();

      await service.create(
        {
          ...createDto,
          startDate: '2025-01-01',
          endDate: '2026-09-30',
          depositPaymentDate: '2025-01-01',
        },
        1,
      );

      const [{ data }] = mockTx.rentDue.createMany.mock.calls[0] as [
        { data: { status: RentDueStatus }[] },
      ];
      expect(data).toHaveLength(21);
      expect(data.every((d) => d.status === RentDueStatus.LATE)).toBe(true);
    });

    it('refuse une période qui chevauche un contrat résilié du même local', async () => {
      mockCreatableContract();
      mockTx.contract.findFirst.mockImplementation(
        ({ where }: { where: { status: ContractStatus } }) =>
          Promise.resolve(
            where.status === ContractStatus.TERMINATED ? { id: 9 } : null,
          ),
      );

      await expect(
        service.create(
          { ...createDto, startDate: '2027-03-01', endDate: '2027-05-31' },
          1,
        ),
      ).rejects.toThrow('contrat #9');
      expect(mockTx.contract.findFirst).toHaveBeenLastCalledWith({
        where: {
          localId: 1,
          status: ContractStatus.TERMINATED,
          endDate: { gte: new Date('2027-03-01') },
          startDate: { lte: new Date('2027-05-31') },
        },
      });
      expect(mockTx.contract.create).not.toHaveBeenCalled();
    });

    it('sans date de fin, tout contrat résilié qui finit après le début chevauche', async () => {
      mockCreatableContract();

      await service.create({ ...createDto, startDate: '2027-04-01' }, 1);

      expect(mockTx.contract.findFirst).toHaveBeenLastCalledWith({
        where: {
          localId: 1,
          status: ContractStatus.TERMINATED,
          endDate: { gte: new Date('2027-04-01') },
        },
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated contracts with activeRent mapped', async () => {
      const rent = { id: 1, amount: 500000, effectiveTo: null };
      mockPrisma.contract.findMany.mockResolvedValue([
        { id: 1, local: {}, tenant: {}, rents: [rent] },
      ]);
      mockPrisma.contract.count.mockResolvedValue(1);

      const result = await service.findAll({ skip: 0, take: 20 });

      expect(result).toMatchObject({ total: 1, skip: 0, take: 20 });
      expect(result.items[0].activeRent).toEqual(rent);
      expect(result.items[0]).not.toHaveProperty('rents');
    });

    it('should return null activeRent when no active rent exists', async () => {
      mockPrisma.contract.findMany.mockResolvedValue([
        { id: 1, local: {}, tenant: {}, rents: [] },
      ]);
      mockPrisma.contract.count.mockResolvedValue(1);

      const result = await service.findAll({ skip: 0, take: 20 });

      expect(result.items[0].activeRent).toBeNull();
    });

    it('filtre par nom de local ou de locataire quand search est fourni', async () => {
      mockPrisma.contract.findMany.mockResolvedValue([]);
      mockPrisma.contract.count.mockResolvedValue(0);

      await service.findAll({ skip: 0, take: 20, search: 'centre' });

      const expectedWhere = {
        status: { not: ContractStatus.CANCELED },
        OR: [
          { local: { name: { contains: 'centre', mode: 'insensitive' } } },
          { tenant: { name: { contains: 'centre', mode: 'insensitive' } } },
        ],
      };
      expect(mockPrisma.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(mockPrisma.contract.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });
    });

    it('exclut les contrats annulés (CANCELED) quand search est absent', async () => {
      mockPrisma.contract.findMany.mockResolvedValue([]);
      mockPrisma.contract.count.mockResolvedValue(0);

      await service.findAll({ skip: 0, take: 20 });

      const expectedWhere = { status: { not: ContractStatus.CANCELED } };
      expect(mockPrisma.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(mockPrisma.contract.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });
    });
  });

  describe('findOne', () => {
    it('should return a contract with activeRent', async () => {
      const rent = { id: 1, amount: 500000, effectiveTo: null };
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 1,
        local: {},
        tenant: {},
        rents: [rent],
        deposit: null,
      });

      const result = await service.findOne(1);

      expect(result.activeRent).toEqual(rent);
    });

    it('should throw NotFoundException when contract does not exist', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it('inclut le document de bail dans le détail', async () => {
      const document = {
        id: 1,
        contractId: 1,
        documentNo: 'BAIL-2026-00001',
        s3Key: 'contracts/2026/BAIL-2026-00001.pdf',
      };
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 1,
        rents: [{ id: 1, effectiveTo: null }],
        document,
      });

      const result = await service.findOne(1);

      expect(result.document).toEqual(document);
      expect(mockPrisma.contract.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({ document: true }),
        }),
      );
    });
  });

  describe('terminate', () => {
    const refundDto = {
      endDate: '2027-06-30',
      paymentDate: '2027-06-15',
      paymentMethod: PaymentMethod.CASH,
    };
    const contract = {
      id: 1,
      status: ContractStatus.ACTIVE,
      startDate: new Date('2026-01-01'),
      deposit: { id: 1 },
    };

    it('should terminate a contract, clean future rent dues and refund deposit', async () => {
      mockTx.contract.findUnique.mockResolvedValue(contract);
      mockTx.rentDue.count.mockResolvedValue(0);
      const terminated = {
        id: 1,
        status: ContractStatus.TERMINATED,
        rents: [{ id: 5, effectiveTo: null }],
      };
      mockTx.contract.findUniqueOrThrow.mockResolvedValue(terminated);
      mockPaymentsService.createDepositRefund.mockResolvedValue({ id: 42 });

      const result = await service.terminate(1, refundDto, 7);

      expect(mockTx.rentDue.deleteMany).toHaveBeenCalledWith({
        where: {
          contractId: 1,
          month: { gt: new Date('2027-06-30') },
          status: { in: [RentDueStatus.PENDING, RentDueStatus.LATE] },
        },
      });
      expect(mockTx.contract.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: ContractStatus.TERMINATED,
          endDate: new Date('2027-06-30'),
        },
      });
      expect(mockPaymentsService.createDepositRefund).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          contractId: 1,
          userId: 7,
          paymentMethod: PaymentMethod.CASH,
        }),
      );
      expect(mockPaymentsService.generateReceiptSafe).toHaveBeenCalledWith(42);
      expect(result).toEqual({
        ...terminated,
        activeRent: terminated.rents[0],
      });
    });

    it('should throw ConflictException when unpaid rent dues remain before endDate', async () => {
      mockTx.contract.findUnique.mockResolvedValue(contract);
      mockTx.rentDue.count.mockResolvedValue(2);

      await expect(service.terminate(1, refundDto, 7)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPaymentsService.createDepositRefund).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when contract does not exist', async () => {
      mockTx.contract.findUnique.mockResolvedValue(null);

      await expect(service.terminate(999, refundDto, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('verrouille le contrat avant toute lecture de la transaction', async () => {
      mockTx.contract.findUnique.mockResolvedValue(contract);
      mockTx.rentDue.count.mockResolvedValue(0);
      mockTx.contract.findUniqueOrThrow.mockResolvedValue({ id: 1, rents: [] });
      mockPaymentsService.createDepositRefund.mockResolvedValue({ id: 42 });

      await service.terminate(1, refundDto, 7);

      expect(mockTx.$queryRaw).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('FOR UPDATE')]),
        1,
      );
      expect(mockTx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        mockTx.contract.findUnique.mock.invocationCallOrder[0],
      );
    });

    it('should throw ConflictException when contract is not active', async () => {
      mockTx.contract.findUnique.mockResolvedValue({
        id: 1,
        status: ContractStatus.TERMINATED,
        deposit: { id: 1 },
      });

      await expect(service.terminate(1, refundDto, 1)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when contract has no deposit', async () => {
      mockTx.contract.findUnique.mockResolvedValue({
        id: 1,
        status: ContractStatus.ACTIVE,
        deposit: null,
      });

      await expect(service.terminate(1, refundDto, 1)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException when endDate is before contract startDate', async () => {
      mockTx.contract.findUnique.mockResolvedValue({
        ...contract,
        startDate: new Date('2027-06-01'),
      });

      await expect(
        service.terminate(1, { ...refundDto, endDate: '2027-05-31' }, 1),
      ).rejects.toThrow(
        'La date de fin doit être postérieure ou égale à la date de début du contrat',
      );
    });

    it('accepte la fin du mois précédent et supprime les échéances qui suivent', async () => {
      mockTx.contract.findUnique.mockResolvedValue(contract);
      mockTx.rentDue.count.mockResolvedValue(0);
      mockTx.contract.findUniqueOrThrow.mockResolvedValue({ id: 1, rents: [] });
      mockPaymentsService.createDepositRefund.mockResolvedValue({ id: 42 });

      await service.terminate(1, { ...refundDto, endDate: '2027-05-31' }, 7);

      expect(mockTx.rentDue.deleteMany).toHaveBeenCalledWith({
        where: {
          contractId: 1,
          month: { gt: new Date('2027-05-31') },
          status: { in: [RentDueStatus.PENDING, RentDueStatus.LATE] },
        },
      });
      expect(mockTx.contract.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: ContractStatus.TERMINATED,
          endDate: new Date('2027-05-31'),
        },
      });
    });

    it('refuse une fin après le mois en cours', async () => {
      mockTx.contract.findUnique.mockResolvedValue(contract);

      await expect(
        service.terminate(1, { ...refundDto, endDate: '2027-07-31' }, 1),
      ).rejects.toThrow(
        'La date de fin ne peut pas dépasser la fin du mois en cours',
      );
    });

    it('refuse une fin après la fin prévue du contrat', async () => {
      mockTx.contract.findUnique.mockResolvedValue({
        ...contract,
        endDate: new Date('2027-03-31'),
      });

      await expect(
        service.terminate(1, { ...refundDto, endDate: '2027-05-31' }, 1),
      ).rejects.toThrow(
        'La date de fin ne peut pas dépasser la fin prévue du contrat',
      );
    });

    it('accepte une fin plus ancienne quand rien ne reste après', async () => {
      mockTx.contract.findUnique.mockResolvedValue(contract);
      mockTx.rentDue.count.mockResolvedValue(0);
      mockTx.contract.findUniqueOrThrow.mockResolvedValue({ id: 1, rents: [] });
      mockPaymentsService.createDepositRefund.mockResolvedValue({ id: 42 });

      await service.terminate(1, { ...refundDto, endDate: '2027-03-31' }, 7);

      expect(mockTx.rentDue.count).toHaveBeenLastCalledWith({
        where: {
          contractId: 1,
          month: { gt: new Date('2027-03-31') },
          OR: [
            { status: RentDueStatus.PAID },
            { month: { lt: new Date('2027-06-01') } },
          ],
        },
      });
      expect(mockTx.contract.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: ContractStatus.TERMINATED,
          endDate: new Date('2027-03-31'),
        },
      });
    });

    it('refuse une fin quand des échéances après elle sont payées ou déjà dues', async () => {
      mockTx.contract.findUnique.mockResolvedValue(contract);
      mockTx.rentDue.count.mockResolvedValueOnce(0).mockResolvedValueOnce(2);

      await expect(
        service.terminate(1, { ...refundDto, endDate: '2027-03-31' }, 1),
      ).rejects.toThrow('Choisir une date de fin plus tardive');
      expect(mockPaymentsService.createDepositRefund).not.toHaveBeenCalled();
    });

    it('refuse une résiliation quand des loyers sont payés au-delà du mois en cours', async () => {
      mockTx.contract.findUnique.mockResolvedValue(contract);
      mockTx.rentDue.count.mockResolvedValueOnce(0).mockResolvedValue(1);
      mockTx.rentDue.findFirst.mockResolvedValueOnce({
        month: new Date('2027-07-01'),
        status: RentDueStatus.PAID,
      });

      const result = service.terminate(1, refundDto, 1);

      await expect(result).rejects.toThrow(ConflictException);
      await expect(result).rejects.toThrow(
        "Loyers déjà payés jusqu'à 2027-07 : la résiliation n'est possible qu'à partir de la fin de ce mois.",
      );
      expect(mockTx.rentDue.findFirst).toHaveBeenCalledWith({
        where: {
          contractId: 1,
          status: RentDueStatus.PAID,
          month: { gt: new Date('2027-06-01') },
        },
        orderBy: { month: 'desc' },
      });
      expect(mockPaymentsService.createDepositRefund).not.toHaveBeenCalled();
    });

    it("accepte la fin prévue d'un contrat déjà terminé", async () => {
      mockTx.contract.findUnique.mockResolvedValue({
        ...contract,
        startDate: new Date('2027-01-01'),
        endDate: new Date('2027-03-31'),
      });
      mockTx.rentDue.count.mockResolvedValue(0);
      mockTx.contract.findUniqueOrThrow.mockResolvedValue({ id: 1, rents: [] });
      mockPaymentsService.createDepositRefund.mockResolvedValue({ id: 42 });

      await service.terminate(
        1,
        { ...refundDto, endDate: '2027-03-31', paymentDate: '2027-04-02' },
        7,
      );

      expect(mockTx.contract.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: ContractStatus.TERMINATED,
          endDate: new Date('2027-03-31'),
        },
      });
    });

    it('compare au mois une fin prévue qui ne tombe pas en fin de mois', async () => {
      mockTx.contract.findUnique.mockResolvedValue({
        ...contract,
        endDate: new Date('2027-03-15'),
      });
      mockTx.rentDue.count.mockResolvedValue(0);
      mockTx.contract.findUniqueOrThrow.mockResolvedValue({ id: 1, rents: [] });
      mockPaymentsService.createDepositRefund.mockResolvedValue({ id: 42 });

      await expect(
        service.terminate(1, { ...refundDto, endDate: '2027-03-31' }, 7),
      ).resolves.toBeDefined();
    });

    it("refuse une date de fin qui n'est pas le dernier jour d'un mois", async () => {
      mockTx.contract.findUnique.mockResolvedValue(contract);

      await expect(
        service.terminate(1, { ...refundDto, endDate: '2027-06-15' }, 1),
      ).rejects.toThrow("La date de fin doit être le dernier jour d'un mois");
    });

    describe('en janvier', () => {
      beforeAll(() => {
        jest.setSystemTime(new Date('2028-01-10'));
      });

      afterAll(() => {
        jest.setSystemTime(new Date('2027-06-15'));
      });

      it("accepte la fin de décembre de l'année précédente", async () => {
        mockTx.contract.findUnique.mockResolvedValue(contract);
        mockTx.rentDue.count.mockResolvedValue(0);
        mockTx.contract.findUniqueOrThrow.mockResolvedValue({
          id: 1,
          rents: [],
        });
        mockPaymentsService.createDepositRefund.mockResolvedValue({ id: 42 });

        await service.terminate(
          1,
          { ...refundDto, endDate: '2027-12-31', paymentDate: '2028-01-10' },
          7,
        );

        expect(mockTx.contract.update).toHaveBeenCalledWith({
          where: { id: 1 },
          data: {
            status: ContractStatus.TERMINATED,
            endDate: new Date('2027-12-31'),
          },
        });
      });
    });

    it('should throw BadRequestException when refund paymentDate is in the future', async () => {
      mockTx.contract.findUnique.mockResolvedValue(contract);

      await expect(
        service.terminate(1, { ...refundDto, paymentDate: '2030-01-01' }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when refund paymentDate is before contract start', async () => {
      mockTx.contract.findUnique.mockResolvedValue(contract);

      await expect(
        service.terminate(1, { ...refundDto, paymentDate: '2025-06-01' }, 1),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    const cancelDto = {
      paymentDate: '2026-04-27',
      paymentMethod: PaymentMethod.CASH,
    };

    const activeContractWithDepositOnly = {
      id: 1,
      status: ContractStatus.ACTIVE,
      startDate: new Date('2026-01-01'),
      deposit: { id: 10 },
      payments: [
        {
          id: 5,
          type: PaymentType.DEPOSIT_HELD,
          paymentDate: new Date('2026-01-01'),
        },
      ],
    };

    it('should cancel a contract, clean unpaid rent dues and refund deposit', async () => {
      mockTx.contract.findUnique.mockResolvedValue(
        activeContractWithDepositOnly,
      );
      mockPaymentsService.createDepositRefund.mockResolvedValue({ id: 99 });
      mockTx.contract.update.mockResolvedValue({
        id: 1,
        status: ContractStatus.CANCELED,
      });

      const result = await service.cancel(1, cancelDto, 7);

      expect(mockTx.rentDue.deleteMany).toHaveBeenCalledWith({
        where: {
          contractId: 1,
          status: { in: [RentDueStatus.PENDING, RentDueStatus.LATE] },
        },
      });
      expect(mockPaymentsService.createDepositRefund).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          contractId: 1,
          userId: 7,
          paymentDate: new Date('2026-04-27'),
          paymentMethod: PaymentMethod.CASH,
        }),
      );
      expect(mockTx.contract.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: ContractStatus.CANCELED },
      });
      expect(mockPaymentsService.generateReceiptSafe).toHaveBeenCalledWith(99);
      expect(result.status).toBe(ContractStatus.CANCELED);
    });

    it('should throw NotFoundException when contract does not exist', async () => {
      mockTx.contract.findUnique.mockResolvedValue(null);

      await expect(service.cancel(999, cancelDto, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('verrouille le contrat avant toute lecture de la transaction', async () => {
      mockTx.contract.findUnique.mockResolvedValue(
        activeContractWithDepositOnly,
      );
      mockPaymentsService.createDepositRefund.mockResolvedValue({ id: 99 });
      mockTx.contract.update.mockResolvedValue({
        id: 1,
        status: ContractStatus.CANCELED,
      });

      await service.cancel(1, cancelDto, 7);

      expect(mockTx.$queryRaw).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('FOR UPDATE')]),
        1,
      );
      expect(mockTx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        mockTx.contract.findUnique.mock.invocationCallOrder[0],
      );
    });

    it('should throw ConflictException when contract is not active', async () => {
      mockTx.contract.findUnique.mockResolvedValue({
        id: 1,
        status: ContractStatus.CANCELED,
        deposit: { id: 10 },
        payments: [],
      });

      await expect(service.cancel(1, cancelDto, 1)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when contract has no deposit', async () => {
      mockTx.contract.findUnique.mockResolvedValue({
        id: 1,
        status: ContractStatus.ACTIVE,
        deposit: null,
        payments: [],
      });

      await expect(service.cancel(1, cancelDto, 1)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when rent payments exist', async () => {
      mockTx.contract.findUnique.mockResolvedValue({
        id: 1,
        status: ContractStatus.ACTIVE,
        startDate: new Date('2026-01-01'),
        deposit: { id: 10 },
        payments: [
          { id: 5, type: PaymentType.DEPOSIT_HELD },
          { id: 6, type: PaymentType.RENT },
        ],
      });

      await expect(service.cancel(1, cancelDto, 1)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException when refund paymentDate is in the future', async () => {
      mockTx.contract.findUnique.mockResolvedValue(
        activeContractWithDepositOnly,
      );

      await expect(
        service.cancel(1, { ...cancelDto, paymentDate: '2030-01-01' }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuse un remboursement antérieur au versement de la caution', async () => {
      mockTx.contract.findUnique.mockResolvedValue({
        ...activeContractWithDepositOnly,
        payments: [
          {
            id: 5,
            type: PaymentType.DEPOSIT_HELD,
            paymentDate: new Date('2026-03-10'),
          },
        ],
      });

      await expect(
        service.cancel(1, { ...cancelDto, paymentDate: '2026-03-01' }, 1),
      ).rejects.toThrow(
        'La date de remboursement ne peut pas être antérieure au versement de la caution',
      );
    });

    it('refuse si le versement de la caution est introuvable', async () => {
      mockTx.contract.findUnique.mockResolvedValue({
        ...activeContractWithDepositOnly,
        payments: [],
      });

      await expect(service.cancel(1, cancelDto, 1)).rejects.toThrow(
        ConflictException,
      );
    });

    it("annule un contrat qui n'a pas encore commencé", async () => {
      mockTx.contract.findUnique.mockResolvedValue({
        ...activeContractWithDepositOnly,
        startDate: new Date('2027-07-01'),
        payments: [
          {
            id: 5,
            type: PaymentType.DEPOSIT_HELD,
            paymentDate: new Date('2027-06-10'),
          },
        ],
      });
      mockPaymentsService.createDepositRefund.mockResolvedValue({ id: 99 });
      mockTx.contract.update.mockResolvedValue({
        id: 1,
        status: ContractStatus.CANCELED,
      });

      const result = await service.cancel(
        1,
        { ...cancelDto, paymentDate: '2027-06-12' },
        7,
      );

      expect(result.status).toBe(ContractStatus.CANCELED);
    });
  });
});
