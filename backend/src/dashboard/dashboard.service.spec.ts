import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  ContractStatus,
  PaymentType,
  RentDueStatus,
} from '@generated/prisma/client';

interface PaymentRow {
  amount: number;
  paymentDate: Date;
}

interface CurrentDueRow {
  status: RentDueStatus;
  amount: number;
}

interface LateDueRow {
  month: Date;
  amount: number;
  contract: {
    id: number;
    local: { code: string; name: string };
    tenant: { name: string };
  };
}

const mockPrisma = {
  payment: { findMany: jest.fn() },
  contract: { count: jest.fn() },
  local: { count: jest.fn() },
  rentDue: { findMany: jest.fn(), aggregate: jest.fn() },
};

const m = (year: number, month: number): Date =>
  new Date(Date.UTC(year, month - 1, 1));

function mockData(
  data: {
    payments?: PaymentRow[];
    current?: CurrentDueRow[];
    late?: LateDueRow[];
  } = {},
) {
  const { payments = [], current = [], late = [] } = data;
  mockPrisma.payment.findMany.mockResolvedValue(payments);
  mockPrisma.rentDue.findMany.mockImplementation(
    ({ where }: { where: { status?: RentDueStatus } }) =>
      Promise.resolve(where.status === RentDueStatus.LATE ? late : current),
  );
}

const lateDue = (
  contractId: number,
  local: { code: string; name: string },
  tenantName: string,
  month: Date,
  amount: number,
): LateDueRow => ({
  month,
  amount,
  contract: { id: contractId, local, tenant: { name: tenantName } },
});

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-22T10:00:00Z'));
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    jest.clearAllMocks();
    mockData();
    mockPrisma.contract.count.mockResolvedValue(0);
    mockPrisma.local.count.mockResolvedValue(0);
    mockPrisma.rentDue.aggregate.mockResolvedValue({
      _count: 0,
      _sum: { amount: null },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('summary', () => {
    it('reads the RENT payments of the last six months only', async () => {
      await service.summary();

      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            type: PaymentType.RENT,
            paymentDate: { gte: m(2026, 5), lt: m(2026, 11) },
          },
        }),
      );
    });

    it('returns the current month and its due date', async () => {
      const result = await service.summary();

      expect(result.month).toEqual(m(2026, 10));
      expect(result.dueDate).toEqual(new Date(Date.UTC(2026, 10, 5)));
    });

    describe('collected per month', () => {
      const payments: PaymentRow[] = [
        { amount: 1500000, paymentDate: new Date('2026-10-01T00:00:00Z') },
        { amount: 700000, paymentDate: new Date('2026-10-21T00:00:00Z') },
        { amount: 900000, paymentDate: new Date('2026-09-30T00:00:00Z') },
        { amount: 400000, paymentDate: new Date('2026-05-01T00:00:00Z') },
      ];

      it('splits the payments by UTC month over six months', async () => {
        mockData({ payments });

        const result = await service.summary();

        expect(result.monthly).toEqual([
          { month: m(2026, 5), amount: 400000 },
          { month: m(2026, 6), amount: 0 },
          { month: m(2026, 7), amount: 0 },
          { month: m(2026, 8), amount: 0 },
          { month: m(2026, 9), amount: 900000 },
          { month: m(2026, 10), amount: 2200000 },
        ]);
      });

      it('collects the amount and the count of the current month', async () => {
        mockData({ payments });

        const result = await service.summary();

        expect(result.collected).toEqual({ amount: 2200000, payments: 2 });
      });

      it('keeps six months at 0 when there is no payment', async () => {
        const result = await service.summary();

        expect(result.monthly).toHaveLength(6);
        expect(result.monthly.map((entry) => entry.amount)).toEqual([
          0, 0, 0, 0, 0, 0,
        ]);
        expect(result.collected).toEqual({ amount: 0, payments: 0 });
      });
    });

    describe('current month dues', () => {
      it('reads the dues of the first of the current month', async () => {
        await service.summary();

        expect(mockPrisma.rentDue.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: { month: m(2026, 10) } }),
        );
      });

      it('splits paid and pending dues and rounds the recovery down', async () => {
        mockData({
          current: [
            { status: RentDueStatus.PAID, amount: 1000000 },
            { status: RentDueStatus.PAID, amount: 1000000 },
            { status: RentDueStatus.PENDING, amount: 1000000 },
          ],
        });

        const result = await service.summary();

        expect(result.currentDues).toEqual({
          paid: { count: 2, amount: 2000000 },
          pending: { count: 1, amount: 1000000 },
        });
        expect(result.recoveryRate).toBe(66);
      });

      it('rounds one paid due out of three down to 33', async () => {
        mockData({
          current: [
            { status: RentDueStatus.PAID, amount: 1000000 },
            { status: RentDueStatus.PENDING, amount: 1000000 },
            { status: RentDueStatus.PENDING, amount: 1000000 },
          ],
        });

        const result = await service.summary();

        expect(result.recoveryRate).toBe(33);
      });

      it('never shows 100 while a due is unpaid', async () => {
        mockData({
          current: [
            { status: RentDueStatus.PAID, amount: 2490000 },
            { status: RentDueStatus.PENDING, amount: 10000 },
          ],
        });

        const result = await service.summary();

        expect(result.recoveryRate).toBe(99);
      });

      it('returns 100 when every due is paid', async () => {
        mockData({
          current: [
            { status: RentDueStatus.PAID, amount: 1000000 },
            { status: RentDueStatus.PAID, amount: 500000 },
          ],
        });

        const result = await service.summary();

        expect(result.recoveryRate).toBe(100);
      });

      it('returns a null recovery and empty totals without any due', async () => {
        const result = await service.summary();

        expect(result.recoveryRate).toBeNull();
        expect(result.currentDues).toEqual({
          paid: { count: 0, amount: 0 },
          pending: { count: 0, amount: 0 },
        });
      });
    });

    describe('request instant', () => {
      it('uses the month of the first instant of a month', async () => {
        jest.setSystemTime(new Date('2026-11-01T00:00:00Z'));

        const result = await service.summary();

        expect(result.month).toEqual(m(2026, 11));
        expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              type: PaymentType.RENT,
              paymentDate: { gte: m(2026, 6), lt: m(2026, 12) },
            },
          }),
        );
      });

      it('uses the month of the last instant of a month', async () => {
        jest.setSystemTime(new Date('2026-10-31T23:59:59.999Z'));

        const result = await service.summary();

        expect(result.month).toEqual(m(2026, 10));
      });

      it('crosses the year boundary in the six months window', async () => {
        jest.setSystemTime(new Date('2027-02-10T10:00:00Z'));

        const result = await service.summary();

        expect(result.monthly.map((entry) => entry.month)).toEqual([
          m(2026, 9),
          m(2026, 10),
          m(2026, 11),
          m(2026, 12),
          m(2027, 1),
          m(2027, 2),
        ]);
        expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              paymentDate: { gte: m(2026, 9), lt: m(2027, 3) },
            }),
          }),
        );
      });
    });

    describe('late rents', () => {
      it('aggregates the LATE dues', async () => {
        await service.summary();

        expect(mockPrisma.rentDue.aggregate).toHaveBeenCalledWith({
          where: { status: RentDueStatus.LATE },
          _count: true,
          _sum: { amount: true },
        });
      });

      it('counts and sums the late dues from the aggregate', async () => {
        mockPrisma.rentDue.aggregate.mockResolvedValue({
          _count: 4,
          _sum: { amount: 4700000 },
        });

        const result = await service.summary();

        expect(result.late).toEqual({ count: 4, amount: 4700000 });
      });

      it('returns 0 for the amount when the sum is null', async () => {
        const result = await service.summary();

        expect(result.late).toEqual({ count: 0, amount: 0 });
      });

      it('no longer reads the LATE rows', async () => {
        await service.summary();

        const calls = mockPrisma.rentDue.findMany.mock.calls as [
          { where: { status?: RentDueStatus } },
        ][];
        expect(calls.length).toBeGreaterThan(0);
        expect(
          calls.some(([args]) => args.where.status === RentDueStatus.LATE),
        ).toBe(false);
      });
    });

    describe('contracts and locals', () => {
      it('counts the ACTIVE contracts and all the locals', async () => {
        mockPrisma.contract.count.mockResolvedValue(7);
        mockPrisma.local.count.mockResolvedValue(8);

        const result = await service.summary();

        expect(result.contracts).toEqual({ active: 7, locals: 8 });
        expect(mockPrisma.contract.count).toHaveBeenCalledWith({
          where: { status: ContractStatus.ACTIVE },
        });
      });
    });
  });

  describe('lateContracts', () => {
    const page = { skip: 0, take: 20 };
    const b2 = { code: 'B2', name: 'Boutique B2' };
    const a3 = { code: 'A3', name: 'Boutique A3' };
    const a1 = { code: 'A1', name: 'Boutique A1' };
    const late: LateDueRow[] = [
      lateDue(2, b2, 'Fatoumata Sylla', m(2026, 8), 1200000),
      lateDue(2, b2, 'Fatoumata Sylla', m(2026, 9), 1200000),
      lateDue(3, a3, 'Ibrahima Sow', m(2026, 9), 1800000),
      lateDue(4, a1, 'Mamadou Bah', m(2026, 9), 500000),
    ];

    it('reads the LATE dues from the oldest month', async () => {
      await service.lateContracts(page);

      expect(mockPrisma.rentDue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: RentDueStatus.LATE },
          orderBy: { month: 'asc' },
        }),
      );
    });

    it('orders the contracts by oldest late month, then by local code', async () => {
      mockData({ late });

      const result = await service.lateContracts(page);

      expect(result.items.map((c) => c.contractId)).toEqual([2, 4, 3]);
    });

    it('groups the late months of a contract on one line', async () => {
      mockData({ late });

      const result = await service.lateContracts(page);

      expect(result.items[0]).toEqual({
        contractId: 2,
        local: { code: 'B2', name: 'Boutique B2' },
        tenant: { name: 'Fatoumata Sylla' },
        months: [m(2026, 8), m(2026, 9)],
        amount: 2400000,
      });
    });

    it('returns an empty page without any late due', async () => {
      const result = await service.lateContracts(page);

      expect(result).toEqual({ items: [], total: 0, skip: 0, take: 20 });
    });

    describe('paging', () => {
      it('returns the first slice with the total of contracts', async () => {
        mockData({ late });

        const result = await service.lateContracts({ skip: 0, take: 2 });

        expect(result.items.map((c) => c.contractId)).toEqual([2, 4]);
        expect(result.total).toBe(3);
        expect(result.skip).toBe(0);
        expect(result.take).toBe(2);
      });

      it('returns the last, shorter slice', async () => {
        mockData({ late });

        const result = await service.lateContracts({ skip: 2, take: 2 });

        expect(result.items.map((c) => c.contractId)).toEqual([3]);
        expect(result.total).toBe(3);
        expect(result.skip).toBe(2);
      });

      it('returns no item past the end but keeps the total', async () => {
        mockData({ late });

        const result = await service.lateContracts({ skip: 5, take: 2 });

        expect(result.items).toEqual([]);
        expect(result.total).toBe(3);
        expect(result.skip).toBe(5);
      });
    });
  });
});
