import * as bcrypt from 'bcrypt';
import { hashPassword } from './password';

describe('hashPassword', () => {
  it('produit un hash bcrypt vérifiable, différent du mot de passe en clair', async () => {
    const hash = await hashPassword('Secret123');

    expect(hash).not.toBe('Secret123');
    await expect(bcrypt.compare('Secret123', hash)).resolves.toBe(true);
    await expect(bcrypt.compare('Autre1234', hash)).resolves.toBe(false);
  });

  it('utilise un coût de 10', async () => {
    const hash = await hashPassword('Secret123');

    expect(bcrypt.getRounds(hash)).toBe(10);
  });
});
