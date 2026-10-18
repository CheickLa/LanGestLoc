import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePaymentDto } from './create-payment.dto';

const valid = {
  contractId: 1,
  untilMonth: '2026-10',
  amount: 1500000,
  paymentDate: '2026-10-17',
  paymentMethod: 'CASH',
};
const invalidFields = async (body: object) =>
  (await validate(plainToInstance(CreatePaymentDto, body))).map(
    (e) => e.property,
  );

describe('CreatePaymentDto', () => {
  it('accepte un paiement bien formé', async () => {
    expect(await invalidFields(valid)).toEqual([]);
  });

  it.each(['2026-13', '10/2026', '2026-1', ''])(
    'refuse le mois %p',
    async (untilMonth) => {
      expect(await invalidFields({ ...valid, untilMonth })).toEqual([
        'untilMonth',
      ]);
    },
  );

  it.each([0, -1, 1.5])('refuse le montant %p', async (amount) => {
    expect(await invalidFields({ ...valid, amount })).toEqual(['amount']);
  });

  it('exige le contrat', async () => {
    expect(await invalidFields({ ...valid, contractId: undefined })).toEqual([
      'contractId',
    ]);
  });
});
