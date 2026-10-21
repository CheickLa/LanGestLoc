import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminUpdateUserDto } from './admin-update-user.dto';

const invalidFields = async (body: object) =>
  (await validate(plainToInstance(AdminUpdateUserDto, body))).map(
    (e) => e.property,
  );

describe('AdminUpdateUserDto', () => {
  it('accepte un mot de passe de 8 caractères', async () => {
    expect(await invalidFields({ password: 'P@ssw0rd' })).toEqual([]);
  });

  it('refuse un mot de passe de moins de 8 caractères', async () => {
    expect(await invalidFields({ password: 'court' })).toEqual(['password']);
  });
});
