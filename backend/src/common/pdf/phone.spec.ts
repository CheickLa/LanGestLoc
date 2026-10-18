import { formatPhone } from './phone';

describe('formatPhone', () => {
  it.each([
    ['+224621456789', '+224 621 45 67 89'],
    ['224621456789', '+224 621 45 67 89'],
    ['+224 621 45 67 89', '+224 621 45 67 89'],
    ['+22370123456', '+22370123456'],
    ['621456789', '621456789'],
  ])('%s → %s', (phone, formatted) => {
    expect(formatPhone(phone)).toBe(formatted);
  });
});
