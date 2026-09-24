import { PassThrough } from 'node:stream';
import { askHidden, assertInteractive, PromptInput } from './prompt';

function fakeTerminal() {
  const setRawMode = jest.fn();
  const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode });
  const output = { write: jest.fn() };
  return { input, output, setRawMode };
}

describe('assertInteractive', () => {
  it("refuse une entrée qui n'est pas un terminal (pipe, docker compose run -T)", () => {
    const pipe: PromptInput = new PassThrough();

    expect(() => assertInteractive(pipe)).toThrow(
      'Cette commande est interactive',
    );
  });

  it('accepte un terminal', () => {
    expect(() => assertInteractive(fakeTerminal().input)).not.toThrow();
  });
});

describe('askHidden', () => {
  it("renvoie la saisie sans jamais l'afficher", async () => {
    const { input, output, setRawMode } = fakeTerminal();

    const answer = askHidden('Mot de passe : ', input, output);
    input.write('secret\r');

    await expect(answer).resolves.toBe('secret');
    expect(output.write).toHaveBeenCalledWith('Mot de passe : ');
    expect(output.write).not.toHaveBeenCalledWith(
      expect.stringContaining('secret'),
    );
    expect(setRawMode).toHaveBeenLastCalledWith(false);
  });

  it('gère le retour arrière', async () => {
    const { input, output } = fakeTerminal();

    const answer = askHidden('Mot de passe : ', input, output);
    input.write('secrex\u007ft\r');

    await expect(answer).resolves.toBe('secret');
  });

  it('annule sur Ctrl+C', async () => {
    const { input, output } = fakeTerminal();

    const answer = askHidden('Mot de passe : ', input, output);
    input.write('abc\u0003');

    await expect(answer).rejects.toThrow('Saisie annulée.');
  });

  it('refuse sans terminal au lieu d’attendre indéfiniment', async () => {
    await expect(
      askHidden('Mot de passe : ', new PassThrough(), { write: jest.fn() }),
    ).rejects.toThrow('Cette commande est interactive');
  });
});
