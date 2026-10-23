import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTenantDto, TENANT_NAME_MAX_LENGTH } from './create-tenant.dto';
import { UpdateTenantDto } from './update-tenant.dto';

const valid = {
  name: 'Aminata Barry',
  phone: '+224612345678',
  dateOfBirth: '1990-05-15',
  birthPlace: 'Conakry',
  idNumber: '234567890',
};
const invalidFields = async (
  dto: typeof CreateTenantDto | typeof UpdateTenantDto,
  body: object,
) => (await validate(plainToInstance(dto, body))).map((e) => e.property);

describe('CreateTenantDto', () => {
  it('limite le nom à 60 caractères', () => {
    expect(TENANT_NAME_MAX_LENGTH).toBe(60);
  });

  it('accepte un nom à la limite', async () => {
    expect(
      await invalidFields(CreateTenantDto, {
        ...valid,
        name: 'a'.repeat(TENANT_NAME_MAX_LENGTH),
      }),
    ).toEqual([]);
  });

  it('refuse un nom trop long', async () => {
    expect(
      await invalidFields(CreateTenantDto, {
        ...valid,
        name: 'a'.repeat(TENANT_NAME_MAX_LENGTH + 1),
      }),
    ).toEqual(['name']);
  });
});

describe('UpdateTenantDto', () => {
  it('refuse un nom trop long', async () => {
    expect(
      await invalidFields(UpdateTenantDto, {
        name: 'a'.repeat(TENANT_NAME_MAX_LENGTH + 1),
      }),
    ).toEqual(['name']);
  });
});
