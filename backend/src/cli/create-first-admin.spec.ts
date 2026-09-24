import * as bcrypt from 'bcrypt';
import { Prisma, Role } from '@generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  createFirstAdmin,
  FirstAdminError,
  FirstAdminInput,
} from './create-first-admin';

const mockPrisma = {
  user: { findFirst: jest.fn(), create: jest.fn() },
};
const prisma = mockPrisma as unknown as PrismaService;

const validInput: FirstAdminInput = {
  email: 'admin@example.com',
  name: 'Admin',
  password: 'Secret123',
  passwordConfirmation: 'Secret123',
};

interface CreateCall {
  data: { email: string; name: string; password: string; role: Role };
}

describe('createFirstAdmin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.create.mockImplementation(({ data }: CreateCall) =>
      Promise.resolve({ id: 1, email: data.email, name: data.name }),
    );
  });

  it('crée un ADMIN avec un mot de passe réellement haché', async () => {
    const admin = await createFirstAdmin(prisma, validInput);

    expect(admin).toEqual({ id: 1, email: 'admin@example.com', name: 'Admin' });
    const [{ data }] = mockPrisma.user.create.mock.calls[0] as [CreateCall];
    expect(data.role).toBe(Role.ADMIN);
    await expect(bcrypt.compare('Secret123', data.password)).resolves.toBe(
      true,
    );
  });

  it("normalise l'e-mail comme l'API (espaces et casse)", async () => {
    await createFirstAdmin(prisma, {
      ...validInput,
      email: '  Admin@Example.COM ',
    });

    const [{ data }] = mockPrisma.user.create.mock.calls[0] as [CreateCall];
    expect(data.email).toBe('admin@example.com');
  });

  it('refuse sans rien écrire quand un ADMIN existe déjà', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: 7 });

    await expect(createFirstAdmin(prisma, validInput)).rejects.toThrow(
      'Un ADMIN existe déjà',
    );
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it.each([
    ['e-mail invalide', { email: 'pas-un-email' }],
    [
      'mot de passe trop court',
      { password: 'court', passwordConfirmation: 'court' },
    ],
    ['nom vide', { name: '   ' }],
    ['confirmation différente', { passwordConfirmation: 'Autre1234' }],
  ])(
    'refuse une saisie invalide (%s) sans toucher à la base',
    async (_label, override) => {
      await expect(
        createFirstAdmin(prisma, { ...validInput, ...override }),
      ).rejects.toThrow(FirstAdminError);
      expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    },
  );

  it('refuse clairement un e-mail déjà utilisé par un autre compte', async () => {
    mockPrisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '7.4.2',
      }),
    );

    await expect(createFirstAdmin(prisma, validInput)).rejects.toThrow(
      "Un compte utilise déjà l'e-mail admin@example.com.",
    );
  });
});
