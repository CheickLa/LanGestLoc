import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ReceiptsService } from '@/receipts/receipts.service';
import { dueDateOf } from '@/rent-due/due-date';
import { MAX_ADVANCE_MONTHS } from '@/rent-due/payable-months';
import {
  ContractStatus,
  DepositStatus,
  PaymentMethod,
  PaymentType,
  Prisma,
  RentDueStatus,
} from '@generated/prisma/client';

const mockTx = {
  $queryRaw: jest.fn(),
  contract: { findUnique: jest.fn() },
  rentDue: {
    createManyAndReturn: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  payment: { create: jest.fn() },
  deposit: { findUnique: jest.fn(), update: jest.fn() },
};

const mockPrisma = {
  contract: { findUnique: jest.fn() },
  payment: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
  $transaction: jest.fn(
    (arg: unknown[] | ((tx: typeof mockTx) => Promise<unknown>)) =>
      Array.isArray(arg) ? Promise.all(arg) : arg(mockTx),
  ),
};

const mockReceiptsService = {
  generate: jest.fn(),
};

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-17T10:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ReceiptsService, useValue: mockReceiptsService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((arg) =>
      Array.isArray(arg) ? Promise.all(arg) : arg(mockTx),
    );
  });

  const RENT = 1500000;
  const rent = {
    id: 7,
    amount: RENT,
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
  };
  const due = (id: number, month: string, status: RentDueStatus) => ({
    id,
    contractId: 1,
    rentId: 7,
    month: new Date(`${month}-01`),
    amount: RENT,
    dueDate: dueDateOf(new Date(`${month}-01`)),
    status,
  });
  const paidUntilJuly = ['01', '02', '03', '04', '05', '06', '07'].map((m, i) =>
    due(i + 1, `2026-${m}`, RentDueStatus.PAID),
  );
  const augToOct = [
    due(8, '2026-08', RentDueStatus.LATE),
    due(9, '2026-09', RentDueStatus.LATE),
    due(10, '2026-10', RentDueStatus.PENDING),
  ];
  const depositHeld = (date: string) => ({
    id: 50,
    type: PaymentType.DEPOSIT_HELD,
    paymentDate: new Date(date),
  });
  const contract = (overrides: object = {}) => ({
    id: 1,
    status: ContractStatus.ACTIVE,
    startDate: new Date('2026-01-01'),
    endDate: null,
    rents: [rent],
    rentDues: [...paidUntilJuly, ...augToOct],
    payments: [depositHeld('2026-01-02')],
    ...overrides,
  });
  const notStarted = (overrides: object = {}) =>
    contract({
      startDate: new Date('2026-12-01'),
      rents: [{ ...rent, effectiveFrom: new Date('2026-12-01') }],
      rentDues: [],
      payments: [depositHeld('2026-10-10')],
      ...overrides,
    });
  const pay = (untilMonth: string, amount: number, overrides: object = {}) =>
    service.create(
      {
        contractId: 1,
        untilMonth,
        amount,
        paymentDate: '2026-10-17',
        paymentMethod: PaymentMethod.CASH,
        ...overrides,
      },
      1,
    );
  const detail = {
    id: 99,
    amount: RENT,
    receipt: { id: 3, receiptNo: 'REC-2026-00001' },
  };
  const paidIds = () =>
    (
      mockTx.payment.create.mock.calls[0] as [
        { data: { paymentLines: { create: { rentDueId: number }[] } } },
      ]
    )[0].data.paymentLines.create.map((l) => l.rentDueId);
  const createdDue = (month: string) => ({
    contractId: 1,
    rentId: 7,
    month: new Date(`${month}-01`),
    amount: RENT,
    dueDate: dueDateOf(new Date(`${month}-01`)),
    status: RentDueStatus.PAID,
  });

  describe('create', () => {
    beforeEach(() => {
      mockTx.contract.findUnique.mockResolvedValue(contract());
      mockTx.rentDue.createManyAndReturn.mockImplementation(
        ({ data }: { data: object[] }) =>
          Promise.resolve(data.map((d, i) => ({ id: 100 + i, ...d }))),
      );
      mockTx.payment.create.mockResolvedValue({ id: 99 });
      mockPrisma.payment.findUnique.mockResolvedValue(detail);
      mockReceiptsService.generate.mockResolvedValue({});
    });

    it("solde août seul jusqu'à 2026-08", async () => {
      await pay('2026-08', RENT);

      expect(mockTx.contract.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          rents: true,
          rentDues: true,
          payments: { where: { type: PaymentType.DEPOSIT_HELD } },
        },
      });
      expect(mockTx.rentDue.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [8] } },
        data: { status: RentDueStatus.PAID },
      });
      expect(mockTx.rentDue.createManyAndReturn).not.toHaveBeenCalled();
      expect(mockTx.payment.create).toHaveBeenCalledWith({
        data: {
          contractId: 1,
          type: PaymentType.RENT,
          amount: RENT,
          paymentDate: new Date('2026-10-17'),
          paymentMethod: PaymentMethod.CASH,
          createdById: 1,
          paymentLines: { create: [{ rentDueId: 8 }] },
        },
      });
    });

    it('verrouille le contrat avant toute lecture de la transaction', async () => {
      await pay('2026-08', RENT);

      expect(mockTx.$queryRaw).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('FOR UPDATE')]),
        1,
      );
      expect(mockTx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        mockTx.contract.findUnique.mock.invocationCallOrder[0],
      );
    });

    it("solde août → octobre en trois lignes, dans l'ordre", async () => {
      await pay('2026-10', 3 * RENT);

      expect(paidIds()).toEqual([8, 9, 10]);
      expect(mockTx.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ amount: 3 * RENT }),
      });
    });

    it("crée PAID novembre et décembre jusqu'à 2026-12", async () => {
      await pay('2026-12', 5 * RENT);

      expect(mockTx.rentDue.createManyAndReturn).toHaveBeenCalledWith({
        data: [createdDue('2026-11'), createdDue('2026-12')],
      });
      expect(paidIds()).toEqual([8, 9, 10, 100, 101]);
    });

    it('accepte la limite, 2027-10', async () => {
      await pay('2027-10', 15 * RENT);

      expect(paidIds()).toHaveLength(15);
    });

    it('refuse 2027-11, après la limite', async () => {
      await expect(pay('2027-11', 16 * RENT)).rejects.toThrow(
        `Le paiement à l'avance est limité à ${MAX_ADVANCE_MONTHS} mois après le mois en cours`,
      );
      expect(mockTx.payment.create).not.toHaveBeenCalled();
    });

    it('refuse 2025-12, avant le début', async () => {
      await expect(pay('2025-12', RENT)).rejects.toThrow(
        'Le mois 2025-12 est avant le début du contrat',
      );
    });

    it('refuse 2026-07, déjà soldé', async () => {
      const result = pay('2026-07', RENT);

      await expect(result).rejects.toThrow(ConflictException);
      await expect(result).rejects.toThrow(
        "Les loyers sont déjà soldés jusqu'à 2026-07",
      );
    });

    it('refuse un montant différent de la somme, sans rien enregistrer', async () => {
      await expect(pay('2026-10', 3 * RENT - 1)).rejects.toThrow(
        ConflictException,
      );
      expect(mockTx.rentDue.createManyAndReturn).not.toHaveBeenCalled();
      expect(mockTx.rentDue.updateMany).not.toHaveBeenCalled();
      expect(mockTx.payment.create).not.toHaveBeenCalled();
    });

    it("deux paiements simultanés : la violation d'unicité donne 409", async () => {
      mockPrisma.$transaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: '7.4.2',
        }),
      );

      await expect(pay('2026-08', RENT)).rejects.toThrow(
        "Les mois à payer viennent d'être modifiés : recommencer.",
      );
    });

    it("passe l'année : payé jusqu'à novembre, puis jusqu'à 2027-01", async () => {
      mockTx.contract.findUnique.mockResolvedValue(
        contract({
          rentDues: [
            ...paidUntilJuly,
            due(8, '2026-08', RentDueStatus.PAID),
            due(9, '2026-09', RentDueStatus.PAID),
            due(10, '2026-10', RentDueStatus.PAID),
            due(11, '2026-11', RentDueStatus.PAID),
          ],
        }),
      );

      await pay('2027-01', 2 * RENT);

      expect(mockTx.rentDue.createManyAndReturn).toHaveBeenCalledWith({
        data: [createdDue('2026-12'), createdDue('2027-01')],
      });
    });

    it('refuse 2027-01 pour un contrat qui finit en 12/2026', async () => {
      mockTx.contract.findUnique.mockResolvedValue(
        contract({ endDate: new Date('2026-12-31') }),
      );

      await expect(pay('2027-01', RENT)).rejects.toThrow(
        'Le mois 2027-01 est après la fin du contrat',
      );
    });

    it("paie à l'avance un contrat pas commencé, daté après la caution", async () => {
      mockTx.contract.findUnique.mockResolvedValue(notStarted());

      await pay('2026-12', RENT);

      expect(mockTx.rentDue.createManyAndReturn).toHaveBeenCalledWith({
        data: [createdDue('2026-12')],
      });
    });

    it('refuse une date avant le versement de la caution', async () => {
      mockTx.contract.findUnique.mockResolvedValue(notStarted());

      await expect(
        pay('2026-12', RENT, { paymentDate: '2026-10-09' }),
      ).rejects.toThrow(
        'La date de paiement ne peut pas être antérieure au versement de la caution',
      );
    });

    it('accepte une date égale au versement de la caution', async () => {
      mockTx.contract.findUnique.mockResolvedValue(notStarted());

      await expect(
        pay('2026-12', RENT, { paymentDate: '2026-10-10' }),
      ).resolves.toEqual(detail);
    });

    it('refuse une date de demain', async () => {
      await expect(
        pay('2026-08', RENT, { paymentDate: '2026-10-18' }),
      ).rejects.toThrow('La date de paiement ne peut pas être dans le futur');
    });

    it.each([ContractStatus.TERMINATED, ContractStatus.CANCELED])(
      'refuse un contrat %s',
      async (status) => {
        mockTx.contract.findUnique.mockResolvedValue(contract({ status }));

        await expect(pay('2026-08', RENT)).rejects.toThrow(BadRequestException);
      },
    );

    it('lève NotFoundException pour un contrat inconnu', async () => {
      mockTx.contract.findUnique.mockResolvedValue(null);

      await expect(pay('2026-08', RENT)).rejects.toThrow(NotFoundException);
    });

    it('refuse un contrat sans versement de caution', async () => {
      mockTx.contract.findUnique.mockResolvedValue(contract({ payments: [] }));

      await expect(pay('2026-08', RENT)).rejects.toThrow(
        "Le contrat #1 n'a pas de versement de caution",
      );
    });

    it('solde une échéance future générée à la main sans la recréer', async () => {
      mockTx.contract.findUnique.mockResolvedValue(
        contract({
          rentDues: [
            ...paidUntilJuly,
            ...augToOct,
            due(11, '2026-11', RentDueStatus.PENDING),
          ],
        }),
      );

      await pay('2026-11', 4 * RENT);

      expect(mockTx.rentDue.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [8, 9, 10, 11] } },
        data: { status: RentDueStatus.PAID },
      });
      expect(mockTx.rentDue.createManyAndReturn).not.toHaveBeenCalled();
    });

    it('renvoie le détail du paiement, reçu compris, lu après sa génération', async () => {
      await expect(pay('2026-08', RENT)).resolves.toEqual(detail);

      expect(mockReceiptsService.generate).toHaveBeenCalledWith(99);
      expect(mockPrisma.payment.findUnique).toHaveBeenCalledWith({
        where: { id: 99 },
        include: {
          paymentLines: { include: { rentDue: true } },
          contract: { include: { tenant: true, local: true } },
          receipt: true,
        },
      });
      expect(
        mockReceiptsService.generate.mock.invocationCallOrder[0],
      ).toBeLessThan(mockPrisma.payment.findUnique.mock.invocationCallOrder[0]);
    });

    it('renvoie receipt à null si la génération échoue', async () => {
      mockReceiptsService.generate.mockRejectedValue(new Error('S3 down'));
      mockPrisma.payment.findUnique.mockResolvedValue({
        ...detail,
        receipt: null,
      });

      await expect(pay('2026-08', RENT)).resolves.toEqual(
        expect.objectContaining({ receipt: null }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated payments with relations', async () => {
      const payments = [{ id: 1, amount: 1000000 }];
      mockPrisma.payment.findMany.mockResolvedValue(payments);
      mockPrisma.payment.count.mockResolvedValue(1);

      const result = await service.findAll({ skip: 0, take: 20 });

      expect(result).toEqual({ items: payments, total: 1, skip: 0, take: 20 });
      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        include: {
          paymentLines: { include: { rentDue: true } },
          contract: { include: { tenant: true, local: true } },
        },
        orderBy: [{ paymentDate: 'desc' }, { id: 'desc' }],
      });
      expect(mockPrisma.payment.count).toHaveBeenCalledWith({ where: {} });
    });

    it('filtre par nom de local ou de locataire, insensible à la casse', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([]);
      mockPrisma.payment.count.mockResolvedValue(0);

      await service.findAll({ skip: 0, take: 20, search: 'diallo' });

      const where = {
        contract: {
          OR: [
            { local: { name: { contains: 'diallo', mode: 'insensitive' } } },
            { tenant: { name: { contains: 'diallo', mode: 'insensitive' } } },
          ],
        },
      };
      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where }),
      );
      expect(mockPrisma.payment.count).toHaveBeenCalledWith({ where });
    });
  });

  describe('findAllByContract', () => {
    it('should return payments for a contract', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(contract());
      const payments = [{ id: 1 }];
      mockPrisma.payment.findMany.mockResolvedValue(payments);

      const result = await service.findAllByContract(1);

      expect(result).toEqual(payments);
      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith({
        where: { contractId: 1 },
        include: { paymentLines: { include: { rentDue: true } } },
        orderBy: [{ paymentDate: 'desc' }, { id: 'desc' }],
      });
    });

    it('should throw NotFoundException when contract does not exist', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(null);

      await expect(service.findAllByContract(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findOne', () => {
    it('should return a payment with all relations', async () => {
      const payment = { id: 1, amount: 1000000, receipt: null };
      mockPrisma.payment.findUnique.mockResolvedValue(payment);

      const result = await service.findOne(1);

      expect(result).toEqual(payment);
      expect(mockPrisma.payment.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          paymentLines: { include: { rentDue: true } },
          contract: { include: { tenant: true, local: true } },
          receipt: true,
        },
      });
    });

    it('should throw NotFoundException when payment does not exist', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createDepositHeld', () => {
    const params = {
      contractId: 1,
      amount: 500000,
      userId: 7,
      paymentDate: new Date('2026-01-01'),
      paymentMethod: PaymentMethod.CASH,
    };

    it('should create a DEPOSIT_HELD payment without payment lines', async () => {
      mockTx.payment.create.mockResolvedValue({ id: 33 });

      const result = await service.createDepositHeld(
        mockTx as unknown as Prisma.TransactionClient,
        params,
      );

      expect(mockTx.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contractId: 1,
          type: PaymentType.DEPOSIT_HELD,
          amount: 500000,
          paymentDate: params.paymentDate,
          paymentMethod: PaymentMethod.CASH,
          createdById: 7,
        }),
      });
      expect(mockTx.payment.create).toHaveBeenCalledWith({
        data: expect.not.objectContaining({ paymentLines: expect.anything() }),
      });
      expect(result).toEqual({ id: 33 });
    });
  });

  describe('createDepositRefund', () => {
    const params = {
      contractId: 1,
      userId: 7,
      paymentDate: new Date('2026-12-31'),
      paymentMethod: PaymentMethod.CASH,
    };
    const held = { id: 10, status: DepositStatus.HELD, amount: 500000 };

    it('should create DEPOSIT_REFUND payment and mark deposit REFUNDED', async () => {
      mockTx.deposit.findUnique.mockResolvedValue(held);
      mockTx.rentDue.count.mockResolvedValue(0);
      mockTx.payment.create.mockResolvedValue({ id: 88 });

      const result = await service.createDepositRefund(
        mockTx as unknown as Prisma.TransactionClient,
        params,
      );

      expect(mockTx.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contractId: 1,
          type: PaymentType.DEPOSIT_REFUND,
          amount: 500000,
          paymentMethod: PaymentMethod.CASH,
          createdById: 7,
        }),
      });
      expect(mockTx.deposit.update).toHaveBeenCalledWith({
        where: { contractId: 1 },
        data: expect.objectContaining({ status: DepositStatus.REFUNDED }),
      });
      expect(result).toEqual({ id: 88 });
    });

    it('should throw NotFoundException when deposit does not exist', async () => {
      mockTx.deposit.findUnique.mockResolvedValue(null);

      await expect(
        service.createDepositRefund(
          mockTx as unknown as Prisma.TransactionClient,
          params,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when deposit is not HELD', async () => {
      mockTx.deposit.findUnique.mockResolvedValue({
        ...held,
        status: DepositStatus.REFUNDED,
      });

      await expect(
        service.createDepositRefund(
          mockTx as unknown as Prisma.TransactionClient,
          params,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when unpaid rent dues remain', async () => {
      mockTx.deposit.findUnique.mockResolvedValue(held);
      mockTx.rentDue.count.mockResolvedValue(2);

      await expect(
        service.createDepositRefund(
          mockTx as unknown as Prisma.TransactionClient,
          params,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('generateReceiptSafe', () => {
    it('should call receiptsService.generate and swallow errors', async () => {
      mockReceiptsService.generate.mockRejectedValue(new Error('S3 down'));

      await expect(service.generateReceiptSafe(42)).resolves.toBeUndefined();
      expect(mockReceiptsService.generate).toHaveBeenCalledWith(42);
    });
  });
});
