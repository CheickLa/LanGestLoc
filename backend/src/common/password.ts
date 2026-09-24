import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/** Hache un mot de passe en clair (bcrypt, même coût dans toute l'application) */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}
