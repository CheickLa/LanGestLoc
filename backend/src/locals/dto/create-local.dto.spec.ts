import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateLocalDto, LOCAL_NAME_MAX_LENGTH } from './create-local.dto';
import { UpdateLocalDto } from './update-local.dto';

const invalidFields = async (
  dto: typeof CreateLocalDto | typeof UpdateLocalDto,
  body: object,
) => (await validate(plainToInstance(dto, body))).map((e) => e.property);

describe('CreateLocalDto', () => {
  it('limite le nom à 40 caractères', () => {
    expect(LOCAL_NAME_MAX_LENGTH).toBe(40);
  });

  it('accepte un nom à la limite', async () => {
    expect(
      await invalidFields(CreateLocalDto, {
        code: 'LOCAL-001',
        name: 'a'.repeat(LOCAL_NAME_MAX_LENGTH),
      }),
    ).toEqual([]);
  });

  it('refuse un nom trop long', async () => {
    expect(
      await invalidFields(CreateLocalDto, {
        code: 'LOCAL-001',
        name: 'a'.repeat(LOCAL_NAME_MAX_LENGTH + 1),
      }),
    ).toEqual(['name']);
  });
});

describe('UpdateLocalDto', () => {
  it('refuse un nom trop long', async () => {
    expect(
      await invalidFields(UpdateLocalDto, {
        name: 'a'.repeat(LOCAL_NAME_MAX_LENGTH + 1),
      }),
    ).toEqual(['name']);
  });
});
