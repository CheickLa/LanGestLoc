import { AuthService } from '@/auth/auth.service';
import { LocalStrategy } from './local.strategy';

describe('LocalStrategy', () => {
  const validateUser = jest.fn();
  const strategy = new LocalStrategy({
    validateUser,
  } as unknown as AuthService);

  beforeEach(() => validateUser.mockReset());

  it("normalise l'e-mail comme à l'inscription (espaces et casse ignorés)", async () => {
    validateUser.mockResolvedValue({ id: 1 });

    await strategy.validate('  Admin@Example.COM ', 'Secret123');

    expect(validateUser).toHaveBeenCalledWith('admin@example.com', 'Secret123');
  });

  it('transmet le mot de passe tel quel (espaces compris)', async () => {
    validateUser.mockResolvedValue({ id: 1 });

    await strategy.validate('admin@example.com', ' Secret123 ');

    expect(validateUser).toHaveBeenCalledWith(
      'admin@example.com',
      ' Secret123 ',
    );
  });
});
