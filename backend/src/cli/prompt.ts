import { createInterface } from 'node:readline/promises';

/** Sous-ensemble de `process.stdin` utilisé par `askHidden` (remplaçable en test) */
export interface PromptInput {
  isTTY?: boolean;
  setRawMode?(mode: boolean): unknown;
  setEncoding(encoding: BufferEncoding): unknown;
  resume(): unknown;
  pause(): unknown;
  on(event: 'data', listener: (chunk: string) => void): unknown;
  removeListener(event: 'data', listener: (chunk: string) => void): unknown;
}

export interface PromptOutput {
  write(text: string): unknown;
}

/** Refuse de continuer sans terminal : sans lui, la saisie masquée est impossible */
export function assertInteractive(input: PromptInput): void {
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error(
      'Cette commande est interactive : lance-la dans un terminal (docker compose run, sans -T).',
    );
  }
}

/** Pose une question et renvoie la réponse, sans les espaces autour */
export async function askVisible(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

/**
 * Pose une question sans afficher la saisie (mot de passe).
 * Entrée valide, Retour arrière efface, Ctrl+C annule.
 */
export function askHidden(
  question: string,
  input: PromptInput = process.stdin,
  output: PromptOutput = process.stdout,
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      assertInteractive(input);
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    let value = '';

    const finish = (settle: () => void) => {
      input.removeListener('data', onData);
      input.setRawMode?.(false);
      input.pause();
      output.write('\n');
      settle();
    };

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n' || char === '\u0004') {
          finish(() => resolve(value));
          return;
        }
        if (char === '\u0003') {
          finish(() => reject(new Error('Saisie annulée.')));
          return;
        }
        value =
          char === '\u007f' || char === '\b'
            ? value.slice(0, -1)
            : value + char;
      }
    };

    output.write(question);
    input.setRawMode?.(true);
    input.setEncoding('utf8');
    input.resume();
    input.on('data', onData);
  });
}
