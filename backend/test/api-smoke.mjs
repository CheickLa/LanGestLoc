// Smoke-test e2e de toute l'API LanGestLoc.
// Lance un scénario réaliste de bout en bout contre un serveur déjà démarré
// (docker compose up) et vérifie status codes + règles métier.
//
//   node test/api-smoke.mjs            # cible http://localhost:3000
//   API_URL=http://host:3000 node test/api-smoke.mjs
//
// Lit ADMIN_EMAIL / ADMIN_PASSWORD depuis le .env à la racine du projet.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, '../../.env');

function parseEnv(path) {
  const out = {};
  let raw = '';
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return out;
  }
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const env = parseEnv(ENV_PATH);
const PORT = process.env.PORT || env.PORT || '3000';
const BASE = (process.env.API_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || env.ADMIN_PASSWORD;

// ── ANSI ─────────────────────────────────────────────────────────────────────
const c = {
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
  y: (s) => `\x1b[33m${s}\x1b[0m`,
  b: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

// ── Harness ──────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

function section(title) {
  console.log('\n' + c.b(`── ${title} ` + '─'.repeat(Math.max(0, 56 - title.length))));
}

function check(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ${c.g('✓')} ${name}`);
  } else {
    failed++;
    failures.push(name + (detail ? ` — ${detail}` : ''));
    console.log(`  ${c.r('✗')} ${name}${detail ? c.dim(` — ${detail}`) : ''}`);
  }
}

function expect(name, res, status) {
  const ok = Array.isArray(status) ? status.includes(res.status) : res.status === status;
  const body = res.json ?? res.text;
  const snippet = body ? JSON.stringify(body).slice(0, 180) : '';
  check(name, ok, ok ? undefined : `attendu ${status}, reçu ${res.status} ${snippet}`);
  return ok;
}

async function req(method, path, { token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    return { status: 0, json: null, text: String(e), headers: new Headers() };
  }
  const ct = res.headers.get('content-type') || '';
  let json = null;
  let text = null;
  if (ct.includes('application/json')) json = await res.json().catch(() => null);
  else text = await res.text().catch(() => null);
  return { status: res.status, json, text, headers: res.headers };
}

// ── Dates (calculées sur l'horloge système = celle du serveur) ───────────────
const now = new Date();
const Y = now.getUTCFullYear();
const M = now.getUTCMonth(); // 0-based
const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d) => d.toISOString().slice(0, 10);
const startDate = isoDay(new Date(Date.UTC(Y, M, 1))); // 1er du mois courant
const today = isoDay(now);
const tomorrow = isoDay(new Date(now.getTime() + 24 * 60 * 60 * 1000));
const yesterday = isoDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));
const currentMonth = `${Y}-${pad(M + 1)}`; // YYYY-MM
const firstNextMonth = isoDay(new Date(Date.UTC(Y, M + 1, 1)));
const lastDayOfMonth = isoDay(new Date(Date.UTC(Y, M + 1, 0))); // dernier jour du mois courant
// Mois décalé (offset en mois, gère le passage d'année via Date.UTC)
const monthStr = (offset) => {
  const d = new Date(Date.UTC(Y, M + offset, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};
const firstOfOffset = (offset) => isoDay(new Date(Date.UTC(Y, M + offset, 1)));

const TS = Date.now();
const rnd3 = () => pad(Math.floor(Math.random() * 1000)).padStart(3, '0');

// ── Helpers de création (re-runnables) ───────────────────────────────────────
async function createLocal(token, name) {
  for (let i = 0; i < 8; i++) {
    const res = await req('POST', '/locals', {
      token,
      body: { code: `LOCAL-${rnd3()}`, name },
    });
    if (res.status === 201) return res.json;
    if (res.status !== 409) {
      throw new Error(`createLocal a échoué: ${res.status} ${JSON.stringify(res.json)}`);
    }
  }
  throw new Error('createLocal: impossible de trouver un code libre');
}

// L'échéance du mois courant naît avec le contrat
async function currentMonthDue(token, contractId) {
  const res = await req('GET', `/rent-dues/contract/${contractId}`, { token });
  return (res.json || []).find((d) => d.month?.startsWith(startDate));
}

async function payableOf(token, contractId) {
  const res = await req('GET', `/rent-dues/contract/${contractId}/payable`, { token });
  return Array.isArray(res.json) ? res.json : [];
}

function payUntil(token, contractId, untilMonth, amount, extra = {}) {
  return req('POST', '/payments', {
    token,
    body: {
      contractId,
      untilMonth,
      amount,
      paymentDate: today,
      paymentMethod: 'CASH',
      ...extra,
    },
  });
}

// ── Scénario ─────────────────────────────────────────────────────────────────
async function main() {
  console.log(c.b(`\nLanGestLoc — Smoke-test API`));
  console.log(c.dim(`  cible    : ${BASE}`));
  console.log(c.dim(`  mois     : ${currentMonth}  (start=${startDate}, today=${today})`));

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log(c.r('\nADMIN_EMAIL / ADMIN_PASSWORD introuvables dans .env — abandon.'));
    process.exit(2);
  }

  // ===== AUTH =====
  section('Auth');
  const health = await req('GET', '/health');
  expect('GET /health → 200', health, 200);
  check('GET /health renvoie status ok', health.json?.status === 'ok');

  const ping = await req('GET', '/auth/me');
  expect('GET /auth/me sans token → 401', ping, 401);

  const login = await req('POST', '/auth/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!expect('POST /auth/login (admin) → 200', login, 200)) {
    console.log(c.r('\nLogin admin impossible, impossible de continuer.'));
    return finish();
  }
  const adminToken = login.json?.accessToken;
  check('login renvoie un accessToken', !!adminToken);

  // Sur téléphone, le clavier met souvent une majuscule en tête du champ e-mail
  const upperLogin = await req('POST', '/auth/login', {
    body: { email: ADMIN_EMAIL.toUpperCase(), password: ADMIN_PASSWORD },
  });
  expect('POST /auth/login e-mail en majuscules → 200', upperLogin, 200);

  const badLogin = await req('POST', '/auth/login', {
    body: { email: ADMIN_EMAIL, password: 'wrong-password-xyz' },
  });
  expect('POST /auth/login mauvais mot de passe → 401', badLogin, 401);

  const me = await req('GET', '/auth/me', { token: adminToken });
  expect('GET /auth/me (admin) → 200', me, 200);
  check('GET /auth/me renvoie le bon email', me.json?.email === ADMIN_EMAIL?.toLowerCase());

  // ===== LOCAUX =====
  section('Locaux');
  const local1 = await createLocal(adminToken, 'E2E Boutique principale');
  check('POST /locals (ADMIN) → 201', !!local1?.id, local1 ? undefined : 'pas de local créé');

  const badCode = await req('POST', '/locals', {
    token: adminToken,
    body: { code: 'NOPE', name: 'x' },
  });
  expect('POST /locals code invalide → 400', badCode, 400);

  const locals = await req('GET', '/locals?skip=0&take=5', { token: adminToken });
  expect('GET /locals (paginé skip/take) → 200', locals, 200);
  check(
    'GET /locals renvoie { items, total, skip, take }',
    locals.json && Array.isArray(locals.json.items) && typeof locals.json.total === 'number',
  );

  const local1Get = await req('GET', `/locals/${local1.id}`, { token: adminToken });
  expect('GET /locals/:id → 200', local1Get, 200);

  const local404 = await req('GET', '/locals/99999999', { token: adminToken });
  expect('GET /locals/:id inexistant → 404', local404, 404);

  const localPatch = await req('PATCH', `/locals/${local1.id}`, {
    token: adminToken,
    body: { name: 'E2E Boutique renommée' },
  });
  expect('PATCH /locals/:id (ADMIN) → 200', localPatch, 200);

  // ===== TENANTS =====
  section('Locataires');
  const tenantBody = {
    name: 'E2E Locataire',
    activity: 'Test',
    phone: `+22466${String(TS).slice(-7)}`,
    dateOfBirth: '1990-05-15',
    birthPlace: 'Conakry',
    idNumber: `E2E-${TS}`,
  };
  const tenant1 = await req('POST', '/tenants', { token: adminToken, body: tenantBody });
  expect('POST /tenants (ADMIN) → 201', tenant1, 201);

  const dupTenant = await req('POST', '/tenants', { token: adminToken, body: tenantBody });
  expect('POST /tenants téléphone dupliqué → 409', dupTenant, 409);

  const tenants = await req('GET', '/tenants?skip=0&take=5', { token: adminToken });
  expect('GET /tenants (paginé skip/take) → 200', tenants, 200);
  check(
    'GET /tenants renvoie { items, total, skip, take }',
    tenants.json && Array.isArray(tenants.json.items) && typeof tenants.json.total === 'number',
  );

  const tenant1Get = await req('GET', `/tenants/${tenant1.json.id}`, { token: adminToken });
  expect('GET /tenants/:id → 200', tenant1Get, 200);

  const tenantPatch = await req('PATCH', `/tenants/${tenant1.json.id}`, {
    token: adminToken,
    body: { activity: 'Commerce modifié' },
  });
  expect('PATCH /tenants/:id (ADMIN) → 200', tenantPatch, 200);

  // ===== CONTRATS =====
  section('Contrats');
  const contractBody = {
    localId: local1.id,
    tenantId: tenant1.json.id,
    startDate,
    rentAmount: 500000,
    depositPaymentMethod: 'CASH',
    depositPaymentDate: today,
  };
  const contract1 = await req('POST', '/contracts', { token: adminToken, body: contractBody });
  expect('POST /contracts (ADMIN) → 201 (crée deposit+rent+DEPOSIT_HELD)', contract1, 201);
  const c1 = contract1.json?.id;

  const dupContract = await req('POST', '/contracts', { token: adminToken, body: contractBody });
  expect('POST /contracts 2e contrat actif même local → 409', dupContract, 409);

  const badStart = await req('POST', '/contracts', {
    token: adminToken,
    body: { ...contractBody, startDate: `${currentMonth}-15` },
  });
  expect('POST /contracts début hors 1er du mois → 400', badStart, 400);

  const contracts = await req('GET', '/contracts?skip=0&take=5', { token: adminToken });
  expect('GET /contracts (paginé) → 200', contracts, 200);

  const contract1Get = await req('GET', `/contracts/${c1}`, { token: adminToken });
  expect('GET /contracts/:id → 200', contract1Get, 200);
  check(
    'le contrat a un deposit = loyer initial (500000)',
    contract1Get.json?.deposit?.amount === 500000,
    `deposit=${JSON.stringify(contract1Get.json?.deposit)}`,
  );

  // Le bail PDF est généré à la création du contrat et stocké sur S3.
  const bail = await req('GET', `/contracts/${c1}/document/download`, { token: adminToken });
  expect('GET /contracts/:id/document/download → 200', bail, 200);
  check(
    'le bail téléchargé est un PDF',
    (bail.headers.get('content-type') || '').includes('pdf'),
    `ct=${bail.headers.get('content-type')}`,
  );

  // ===== LOYERS (SCD) =====
  section('Loyers (SCD)');
  const rentsC1 = await req('GET', `/rents/contract/${c1}`, { token: adminToken });
  expect('GET /rents/contract/:id → 200', rentsC1, 200);
  check('1 loyer initial présent', Array.isArray(rentsC1.json) && rentsC1.json.length === 1);

  const rentCurrent = await req('GET', `/rents/contract/${c1}/current`, { token: adminToken });
  expect('GET /rents/contract/:id/current → 200', rentCurrent, 200);
  check('loyer actif = 500000', rentCurrent.json?.amount === 500000);

  // ===== ÉCHÉANCES =====
  section('Échéances (RentDue)');
  const allDues = await req('GET', `/rent-dues/contract/${c1}`, { token: adminToken });
  expect('GET /rent-dues/contract/:id → 200', allDues, 200);
  const due1 = (allDues.json || []).find((d) => d.month?.startsWith(startDate));
  check(
    "l'échéance du mois courant est créée avec le contrat",
    !!due1,
    `échéances=${JSON.stringify(allDues.json)}`,
  );
  const dueId = due1?.id;
  check('échéance = montant du loyer (500000)', due1?.amount === 500000);

  const dupDue = await req('POST', '/rent-dues/generate', {
    token: adminToken,
    body: { contractId: c1, month: currentMonth },
  });
  expect('POST /rent-dues/generate sur le mois déjà créé → 409', dupDue, 409);

  check("l'échéance du mois courant est PENDING", due1?.status === 'PENDING', `status=${due1?.status}`);

  // ===== PAIEMENTS =====
  section('Paiements');
  const oldShape = await req('POST', '/payments', {
    token: adminToken,
    body: {
      rentDueIds: [dueId],
      paymentDate: today,
      paymentMethod: 'CASH',
    },
  });
  expect('POST /payments au format rentDueIds → 400', oldShape, 400);
  expect('POST /payments mois 2026-13 → 400', await payUntil(adminToken, c1, '2026-13', 500000), 400);
  expect('POST /payments mois 10/2026 → 400', await payUntil(adminToken, c1, '10/2026', 500000), 400);

  const pay1 = await payUntil(adminToken, c1, currentMonth, 500000);
  expect("POST /payments jusqu'au mois en cours → 201", pay1, 201);
  const payId = pay1.json?.id;
  check('montant du paiement = 500000', pay1.json?.amount === 500000);
  check('la réponse porte le reçu', !!pay1.json?.receipt?.receiptNo, `receipt=${JSON.stringify(pay1.json?.receipt)}`);
  check(
    'la réponse porte le local et le locataire',
    pay1.json?.contract?.local?.id === local1.id && pay1.json?.contract?.tenant?.id === tenant1.json.id,
  );
  expect('POST /payments mois déjà soldé → 409', await payUntil(adminToken, c1, currentMonth, 500000), 409);

  const payments = await req('GET', '/payments?skip=0&take=5', { token: adminToken });
  expect('GET /payments (paginé) → 200', payments, 200);

  const searchPayments = (q) =>
    req('GET', `/payments?take=100&search=${encodeURIComponent(q)}`, { token: adminToken });
  const byTenant = await searchPayments('e2e locataire');
  check(
    'recherche par locataire, en minuscules',
    byTenant.json?.total > 0 && (byTenant.json?.items || []).every((p) => p.contract.tenant.name === 'E2E Locataire'),
    `total=${byTenant.json?.total}`,
  );
  const byLocal = await searchPayments('Boutique renommée');
  check(
    'recherche par local',
    byLocal.json?.total > 0 && (byLocal.json?.items || []).every((p) => p.contract.local.name === 'E2E Boutique renommée'),
    `total=${byLocal.json?.total}`,
  );
  const noMatch = await searchPayments(`aucun-${TS}`);
  check('recherche sans résultat : items vide, total 0', noMatch.json?.items?.length === 0 && noMatch.json?.total === 0);

  const payByContract = await req('GET', `/payments/contract/${c1}`, { token: adminToken });
  expect('GET /payments/contract/:id → 200', payByContract, 200);
  check(
    'le contrat a ≥ 2 paiements (DEPOSIT_HELD + RENT)',
    Array.isArray(payByContract.json) && payByContract.json.length >= 2,
  );

  const payGet = await req('GET', `/payments/${payId}`, { token: adminToken });
  expect('GET /payments/:id → 200', payGet, 200);

  // ===== REÇUS (S3) =====
  section('Reçus (PDF / S3)');
  const receipt = await req('GET', `/receipts/payment/${payId}`, { token: adminToken });
  expect('GET /receipts/payment/:paymentId → 200', receipt, 200);
  const receiptId = receipt.json?.id;
  if (receiptId) {
    const dl = await req('GET', `/receipts/${receiptId}/download`, { token: adminToken });
    const isPdf = (dl.headers.get('content-type') || '').includes('pdf');
    expect('GET /receipts/:id/download → 200', dl, 200);
    check('le téléchargement renvoie un content-type PDF', isPdf, `ct=${dl.headers.get('content-type')}`);
  } else {
    check('reçu disponible pour téléchargement', false, 'pas de receiptId (génération S3 échouée ?)');
  }

  // ===== AUGMENTATION DE LOYER =====
  section('Augmentation de loyer (SCD)');
  const rentUp = await req('POST', '/rents', {
    token: adminToken,
    body: { contractId: c1, amount: 600000, effectiveFrom: firstNextMonth },
  });
  expect('POST /rents (augmentation) → 201', rentUp, 201);
  const rentCurrent2 = await req('GET', `/rents/contract/${c1}/current`, { token: adminToken });
  check('le loyer actif est maintenant 600000', rentCurrent2.json?.amount === 600000);
  const rentsAll = await req('GET', `/rents/contract/${c1}`, { token: adminToken });
  check(
    "l'historique contient 2 loyers (ancien clôturé)",
    Array.isArray(rentsAll.json) && rentsAll.json.length === 2,
  );

  // ===== CRONS (déclenchement manuel) =====
  section('Crons (DEV)');
  const cronGen = await req('POST', '/rent-dues/cron/generate', { token: adminToken });
  expect('POST /rent-dues/cron/generate → 2xx', cronGen, [200, 201]);
  const cronLate = await req('POST', '/rent-dues/cron/mark-late', { token: adminToken });
  expect('POST /rent-dues/cron/mark-late → 2xx', cronLate, [200, 201]);

  // ===== PAIEMENT MULTI-MOIS =====
  section('Paiement multi-mois (1 paiement → N échéances)');
  const localMM = await createLocal(adminToken, 'E2E Local multi-mois');
  const RENT_MM = 400000;
  const startMM = firstOfOffset(-2); // contrat démarré il y a 2 mois
  const contractMM = await req('POST', '/contracts', {
    token: adminToken,
    body: {
      localId: localMM.id,
      tenantId: tenant1.json.id,
      startDate: startMM,
      rentAmount: RENT_MM,
      depositPaymentMethod: 'ORANGE_MONEY',
      depositPaymentDate: startMM,
    },
  });
  check('contrat multi-mois créé', contractMM.status === 201, `status=${contractMM.status}`);
  const cMM = contractMM.json?.id;

  // Les mois écoulés (M-2, M-1, M) naissent avec le contrat
  const mmDues = await req('GET', `/rent-dues/contract/${cMM}`, { token: adminToken });
  const mmDueIds = (mmDues.json || []).map((d) => d.id);
  check('3 échéances créées avec le contrat (M-2, M-1, M)', mmDueIds.length === 3, `créées=${mmDueIds.length}`);

  // Une augmentation ne peut pas viser un mois dont l'échéance est déjà créée
  const rentUpMM = await req('POST', '/rents', {
    token: adminToken,
    body: { contractId: cMM, amount: RENT_MM + 100000, effectiveFrom: firstOfOffset(-1) },
  });
  expect('POST /rents sur un mois déjà facturé → 409', rentUpMM, 409);

  // Un seul paiement qui solde les 3 mois d'un coup
  const payMM = await payUntil(adminToken, cMM, currentMonth, 3 * RENT_MM, { paymentMethod: 'ORANGE_MONEY' });
  expect('POST /payments multi-mois (3 échéances) → 201', payMM, 201);
  check(
    `montant = somme des 3 loyers (${3 * RENT_MM})`,
    payMM.json?.amount === 3 * RENT_MM,
    `amount=${payMM.json?.amount}`,
  );
  check(
    'le paiement contient 3 PaymentLines',
    Array.isArray(payMM.json?.paymentLines) && payMM.json.paymentLines.length === 3,
    `lines=${payMM.json?.paymentLines?.length}`,
  );

  // Les 3 échéances sont désormais PAID, plus aucune PENDING
  const mmPayable = await payableOf(adminToken, cMM);
  check(
    'plus aucun mois dû après le paiement',
    mmPayable.length > 0 && mmPayable.every((m) => m.status === 'ADVANCE'),
    `statuts=${mmPayable.map((m) => m.status).join(',')}`,
  );

  // Règle métier : repayer un lot dont une échéance est déjà soldée → 409
  const mmRepay = await payUntil(adminToken, cMM, currentMonth, 3 * RENT_MM);
  expect('POST /payments multi-mois déjà soldé → 409', mmRepay, 409);

  // ===== SOLDER JUSQU'À UN MOIS =====
  section("Solder jusqu'à un mois");
  const localU = await createLocal(adminToken, 'E2E Local solder');
  const RENT_U = 350000;
  const startU = firstOfOffset(-2);
  const cu = await req('POST', '/contracts', {
    token: adminToken,
    body: {
      localId: localU.id,
      tenantId: tenant1.json.id,
      startDate: startU,
      rentAmount: RENT_U,
      depositPaymentMethod: 'CASH',
      depositPaymentDate: startU,
    },
  });
  expect('POST /contracts démarré en M-2 → 201', cu, 201);
  const cuId = cu.json?.id;
  const payU = (untilMonth, amount, extra) => payUntil(adminToken, cuId, untilMonth, amount, extra);

  const payableU = await req('GET', `/rent-dues/contract/${cuId}/payable`, { token: adminToken });
  expect('GET /rent-dues/contract/:id/payable → 200', payableU, 200);
  const listU = Array.isArray(payableU.json) ? payableU.json : [];
  check(
    'mois payables de M-2 à M+12 (15 mois)',
    listU.length === 15 && listU[0]?.month.startsWith(startU) && listU[14]?.month.startsWith(firstOfOffset(12)),
    `mois=${listU.length}`,
  );
  check(
    "M-2 en retard, mois en cours en attente, M+1 à l'avance",
    listU[0]?.status === 'LATE' && listU[2]?.status === 'PENDING' && listU[3]?.status === 'ADVANCE',
    `statuts=${listU.map((m) => m.status).join(',')}`,
  );
  expect('GET payable sur un contrat inconnu → 404', await req('GET', '/rent-dues/contract/99999999/payable', { token: adminToken }), 404);

  expect('avant le début du contrat → 400', await payU(monthStr(-3), RENT_U), 400);
  expect('après la limite de 12 mois → 400', await payU(monthStr(13), RENT_U), 400);
  expect('daté de demain → 400', await payU(monthStr(-2), RENT_U, { paymentDate: tomorrow }), 400);
  expect('montant différent du total → 409', await payU(monthStr(-2), RENT_U + 1), 409);
  check('rien enregistré après le 409', (await payableOf(adminToken, cuId)).length === 15);

  const simultaneous = await Promise.all([payU(monthStr(-2), RENT_U), payU(monthStr(-2), RENT_U)]);
  check(
    'deux paiements simultanés des mêmes mois : un 201, un 409',
    simultaneous.map((r) => r.status).sort().join(',') === '201,409',
    `statuts=${simultaneous.map((r) => r.status).join(',')}`,
  );

  const advance = await payU(monthStr(2), 4 * RENT_U);
  expect("jusqu'à M+2 → 201", advance, 201);
  // L'ordre des lignes est vérifié par les tests unitaires ; la lecture ne le garantit pas.
  const advanceMonths = (advance.json?.paymentLines || []).map((l) => l.rentDue.month.slice(0, 7)).sort().join(',');
  check(
    'M-1, M, M+1 et M+2 soldés',
    advanceMonths === [monthStr(-1), monthStr(0), monthStr(1), monthStr(2)].join(','),
    `mois=${advanceMonths}`,
  );
  const statusOfU = async (offset) => {
    const res = await req('GET', `/rent-dues/contract/${cuId}`, { token: adminToken });
    return (res.json || []).find((d) => d.month?.startsWith(firstOfOffset(offset)))?.status;
  };
  check('M+1 et M+2 créés PAID', (await statusOfU(1)) === 'PAID' && (await statusOfU(2)) === 'PAID');
  expect(
    'génération manuelle de M+1 déjà payé → 409',
    await req('POST', '/rent-dues/generate', {
      token: adminToken,
      body: { contractId: cuId, month: monthStr(1) },
    }),
    409,
  );
  expect('POST /rent-dues/cron/generate → 2xx', await req('POST', '/rent-dues/cron/generate', { token: adminToken }), [200, 201]);
  check('après le cron, M+1 reste PAID', (await statusOfU(1)) === 'PAID');
  expect(
    'résiliation à la fin du mois en cours, M+1 payé → 409',
    await req('PATCH', `/contracts/${cuId}/terminate`, {
      token: adminToken,
      body: { endDate: lastDayOfMonth, paymentDate: today, paymentMethod: 'CASH' },
    }),
    409,
  );
  const raiseU = (offset) =>
    req('POST', '/rents', {
      token: adminToken,
      body: { contractId: cuId, amount: RENT_U + 50000, effectiveFrom: firstOfOffset(offset) },
    });
  expect('augmentation au M+2, déjà payé → 409', await raiseU(2), 409);
  expect('augmentation au M+3 → 201', await raiseU(3), 201);
  const afterRaise = await payableOf(adminToken, cuId);
  check(
    'M+3 est le premier mois payable, au nouveau loyer',
    afterRaise[0]?.month.startsWith(firstOfOffset(3)) && afterRaise[0]?.amount === RENT_U + 50000,
    `premier=${JSON.stringify(afterRaise[0])}`,
  );

  // ===== CONTRAT PAS ENCORE COMMENCÉ =====
  section('Contrat pas encore commencé');
  const localN = await createLocal(adminToken, 'E2E Local à venir');
  const cn = await req('POST', '/contracts', {
    token: adminToken,
    body: {
      localId: localN.id,
      tenantId: tenant1.json.id,
      startDate: firstOfOffset(1),
      rentAmount: 220000,
      depositPaymentMethod: 'CASH',
      depositPaymentDate: today,
    },
  });
  expect('POST /contracts qui commence le mois prochain → 201', cn, 201);
  const cnId = cn.json?.id;
  const payableN = await payableOf(adminToken, cnId);
  check(
    "12 mois à l'avance, de M+1 à M+12",
    payableN.length === 12 && payableN[0]?.month.startsWith(firstOfOffset(1)) && payableN.every((m) => m.status === 'ADVANCE'),
    `mois=${payableN.length}`,
  );
  expect('daté avant le versement de la caution → 400', await payUntil(adminToken, cnId, monthStr(1), 220000, { paymentDate: yesterday }), 400);
  expect("paiement de M+1 à l'avance → 201", await payUntil(adminToken, cnId, monthStr(1), 220000), 201);
  expect(
    "annulation après un paiement à l'avance → 409",
    await req('PATCH', `/contracts/${cnId}/cancel`, {
      token: adminToken,
      body: { paymentDate: today, paymentMethod: 'CASH' },
    }),
    409,
  );

  // ===== RÉSILIATION (terminate) =====
  section('Résiliation de contrat');
  const localT = await createLocal(adminToken, 'E2E Local terminate');
  const ct = await req('POST', '/contracts', {
    token: adminToken,
    body: {
      localId: localT.id,
      tenantId: tenant1.json.id,
      startDate,
      rentAmount: 300000,
      depositPaymentMethod: 'CASH',
      depositPaymentDate: today,
    },
  });
  check('contrat à résilier créé', ct.status === 201, `status=${ct.status}`);
  const ctId = ct.json?.id;

  // Règle 9 : le dernier mois est dû en entier, il se règle avant la résiliation
  const dueT = await currentMonthDue(adminToken, ctId);
  check("l'échéance du mois courant existe sur le contrat à résilier", !!dueT);

  const earlyTerminate = await req('PATCH', `/contracts/${ctId}/terminate`, {
    token: adminToken,
    body: { endDate: lastDayOfMonth, paymentDate: today, paymentMethod: 'CASH' },
  });
  expect('PATCH /terminate avec le mois courant impayé → 409', earlyTerminate, 409);

  const payT = await payUntil(adminToken, ctId, currentMonth, 300000);
  expect("solde de l'échéance avant résiliation → 201", payT, 201);

  const terminate = await req('PATCH', `/contracts/${ctId}/terminate`, {
    token: adminToken,
    body: { endDate: lastDayOfMonth, paymentDate: today, paymentMethod: 'CASH' },
  });
  expect('PATCH /contracts/:id/terminate (loyers soldés) → 200', terminate, 200);
  check('contrat passé en TERMINATED', terminate.json?.status === 'TERMINATED');

  // la caution est une garantie pure, restituée à la fin du contrat.
  const ctAfter = await req('GET', `/contracts/${ctId}`, { token: adminToken });
  check(
    'la caution est passée en REFUNDED',
    ctAfter.json?.deposit?.status === 'REFUNDED',
    `deposit=${JSON.stringify(ctAfter.json?.deposit)}`,
  );

  const payAfterT = await req('GET', `/payments/contract/${ctId}`, { token: adminToken });
  check(
    'un paiement DEPOSIT_REFUND a été créé',
    Array.isArray(payAfterT.json) && payAfterT.json.some((p) => p.type === 'DEPOSIT_REFUND'),
    `types=${JSON.stringify((payAfterT.json || []).map((p) => p.type))}`,
  );

  // ===== ANNULATION (cancel) =====
  section('Annulation de contrat');
  const localX = await createLocal(adminToken, 'E2E Local cancel');
  const cx = await req('POST', '/contracts', {
    token: adminToken,
    body: {
      localId: localX.id,
      tenantId: tenant1.json.id,
      startDate,
      rentAmount: 200000,
      depositPaymentMethod: 'CASH',
      depositPaymentDate: today,
    },
  });
  check('contrat à annuler créé', cx.status === 201, `status=${cx.status}`);
  const cancel = await req('PATCH', `/contracts/${cx.json?.id}/cancel`, {
    token: adminToken,
    body: { paymentDate: today, paymentMethod: 'CASH' },
  });
  expect('PATCH /contracts/:id/cancel (aucun paiement RENT) → 200', cancel, 200);
  check('contrat passé en CANCELED', cancel.json?.status === 'CANCELED');

  const duesX = await req('GET', `/rent-dues/contract/${cx.json?.id}`, { token: adminToken });
  check(
    "l'échéance impayée du mois courant est supprimée",
    Array.isArray(duesX.json) && duesX.json.length === 0,
    `restantes=${duesX.json?.length}`,
  );

  // ===== RETARDS À LA CRÉATION =====
  // Une échéance dont la date limite est passée naît LATE ; le cron ne touche pas aux autres.
  section('Retards à la création');
  const localL = await createLocal(adminToken, 'E2E Local late');
  const startL = firstOfOffset(-2);
  const cl = await req('POST', '/contracts', {
    token: adminToken,
    body: {
      localId: localL.id,
      tenantId: tenant1.json.id,
      startDate: startL,
      rentAmount: 250000,
      depositPaymentMethod: 'CASH',
      depositPaymentDate: startL,
    },
  });
  check('contrat démarré il y a 2 mois créé', cl.status === 201, `status=${cl.status}`);
  const clId = cl.json?.id;

  const duesL = await req('GET', `/rent-dues/contract/${clId}`, { token: adminToken });
  const dueOfL = (offset) => (duesL.json || []).find((d) => d.month?.startsWith(firstOfOffset(offset)));
  check("l'échéance de M-2 naît LATE", dueOfL(-2)?.status === 'LATE', `status=${dueOfL(-2)?.status}`);
  check("l'échéance du mois en cours naît PENDING", dueOfL(0)?.status === 'PENDING', `status=${dueOfL(0)?.status}`);

  const markLate = await req('POST', '/rent-dues/cron/mark-late', { token: adminToken });
  expect('POST /rent-dues/cron/mark-late → 2xx', markLate, [200, 201]);
  const duesLAfter = await req('GET', `/rent-dues/contract/${clId}`, { token: adminToken });
  const dueLAfter = (duesLAfter.json || []).find((d) => d.id === dueOfL(0)?.id);
  check('le cron laisse PENDING le mois en cours', dueLAfter?.status === 'PENDING', `status=${dueLAfter?.status}`);

  // ===== CONTRAT SUR UNE PÉRIODE PASSÉE =====
  // Saisi après coup : échéances limitées à sa période, résiliation à sa fin.
  section('Contrat sur une période passée');
  const localP = await createLocal(adminToken, 'E2E Local période passée');
  const startP = firstOfOffset(-3);
  const endP = isoDay(new Date(Date.UTC(Y, M - 1, 0))); // dernier jour de M-2
  const cp = await req('POST', '/contracts', {
    token: adminToken,
    body: {
      localId: localP.id,
      tenantId: tenant1.json.id,
      startDate: startP,
      endDate: endP,
      rentAmount: 150000,
      depositPaymentMethod: 'CASH',
      depositPaymentDate: startP,
    },
  });
  expect('POST /contracts sur une période passée → 201', cp, 201);
  const cpId = cp.json?.id;

  const monthsOfP = async () => {
    const res = await req('GET', `/rent-dues/contract/${cpId}`, { token: adminToken });
    return (res.json || []).map((d) => d.month.slice(0, 7)).sort().join(',');
  };
  const expectedP = [monthStr(-3), monthStr(-2)].join(',');
  const monthsP = await monthsOfP();
  check('seuls les mois de la période sont créés (M-3, M-2)', monthsP === expectedP, `mois=${monthsP}`);

  const cronP = await req('POST', '/rent-dues/cron/generate', { token: adminToken });
  expect('POST /rent-dues/cron/generate → 2xx', cronP, [200, 201]);
  const monthsAfterCron = await monthsOfP();
  check('le cron ne facture pas un mois après la fin', monthsAfterCron === expectedP, `mois=${monthsAfterCron}`);

  const outOfPeriod = await req('POST', '/rent-dues/generate', {
    token: adminToken,
    body: { contractId: cpId, month: monthStr(-1) },
  });
  expect('POST /rent-dues/generate après la fin du contrat → 400', outOfPeriod, 400);

  expect('POST /payments après la fin du contrat → 400', await payUntil(adminToken, cpId, monthStr(-1), 3 * 150000), 400);
  expect('solde des mois de la période → 201', await payUntil(adminToken, cpId, monthStr(-2), 2 * 150000), 201);

  const terminateP = await req('PATCH', `/contracts/${cpId}/terminate`, {
    token: adminToken,
    body: { endDate: endP, paymentDate: today, paymentMethod: 'CASH' },
  });
  expect('PATCH /terminate à la fin passée du contrat → 200', terminateP, 200);
  check('contrat passé en TERMINATED', terminateP.json?.status === 'TERMINATED');

  // Un local ne se loue pas deux fois le même mois
  const newContractOnP = (startDate, endDate) =>
    req('POST', '/contracts', {
      token: adminToken,
      body: {
        localId: localP.id,
        tenantId: tenant1.json.id,
        startDate,
        ...(endDate && { endDate }),
        rentAmount: 150000,
        depositPaymentMethod: 'CASH',
        depositPaymentDate: startDate,
      },
    });
  const beforeP = await newContractOnP(firstOfOffset(-6), isoDay(new Date(Date.UTC(Y, M - 3, 0))));
  expect('POST /contracts entièrement avant le contrat résilié → 201', beforeP, 201);
  const cancelBeforeP = await req('PATCH', `/contracts/${beforeP.json?.id}/cancel`, {
    token: adminToken,
    body: { paymentDate: today, paymentMethod: 'CASH' },
  });
  expect('annulation de ce contrat → 200', cancelBeforeP, 200);
  const overlapP = await newContractOnP(firstOfOffset(-2));
  expect('POST /contracts qui chevauche le contrat résilié → 409', overlapP, 409);
  const afterP = await newContractOnP(firstOfOffset(-1));
  expect('POST /contracts juste après le contrat résilié → 201', afterP, 201);

  // ===== RÉSILIATION À UNE FIN PASSÉE =====
  // Elle n'efface aucune dette passée et ne laisse aucun paiement après sa fin.
  section('Résiliation à une fin passée');
  const localR = await createLocal(adminToken, 'E2E Local fin passée');
  const startR = firstOfOffset(-2);
  const cr = await req('POST', '/contracts', {
    token: adminToken,
    body: {
      localId: localR.id,
      tenantId: tenant1.json.id,
      startDate: startR,
      rentAmount: 200000,
      depositPaymentMethod: 'CASH',
      depositPaymentDate: startR,
    },
  });
  expect('POST /contracts démarré en M-2 → 201', cr, 201);
  const crId = cr.json?.id;
  const payR = (offset) => payUntil(adminToken, crId, monthStr(offset), 200000);
  const terminateR = (endDate) =>
    req('PATCH', `/contracts/${crId}/terminate`, {
      token: adminToken,
      body: { endDate, paymentDate: today, paymentMethod: 'CASH' },
    });
  const endOfM2 = isoDay(new Date(Date.UTC(Y, M - 1, 0)));
  const endOfM1 = isoDay(new Date(Date.UTC(Y, M, 0)));

  expect('paiement de M-2 → 201', await payR(-2), 201);
  const unpaidAfterR = await terminateR(endOfM2);
  expect('PATCH /terminate en M-2, M-1 impayé → 409', unpaidAfterR, 409);
  check(
    'refusé pour une échéance postérieure',
    String(unpaidAfterR.json?.message).includes('postérieure'),
    `message=${unpaidAfterR.json?.message}`,
  );
  expect('paiement de M-1 → 201', await payR(-1), 201);
  expect('PATCH /terminate en M-2, M-1 payé → 409', await terminateR(endOfM2), 409);
  const terminateR1 = await terminateR(endOfM1);
  expect('PATCH /terminate en M-1, mois en cours impayé → 200', terminateR1, 200);
  const monthsR = await req('GET', `/rent-dues/contract/${crId}`, { token: adminToken });
  const monthsRList = (monthsR.json || []).map((d) => d.month.slice(0, 7)).sort().join(',');
  check(
    "l'échéance impayée du mois en cours est supprimée",
    monthsRList === [monthStr(-2), monthStr(-1)].join(','),
    `mois=${monthsRList}`,
  );

  // ===== UTILISATEURS + RÔLES =====
  section('Utilisateurs & contrôle des rôles');
  const newUserEmail = `e2e-user-${TS}@test.com`;
  const userPwd = 'P@ssw0rd!';
  const register = await req('POST', '/auth/register', {
    token: adminToken,
    body: { name: 'E2E User', email: newUserEmail, password: userPwd, role: 'USER' },
  });
  expect('POST /auth/register (ADMIN crée un USER) → 201', register, 201);

  const userLogin = await req('POST', '/auth/login', {
    body: { email: newUserEmail, password: userPwd },
  });
  const userToken = userLogin.json?.accessToken;
  check('login du nouvel utilisateur OK', !!userToken);

  const agentEmail = `e2e-agent-${TS}@test.com`;
  const agentRegister = await req('POST', '/auth/register', {
    token: adminToken,
    body: {
      name: 'E2E Agent',
      email: agentEmail,
      password: userPwd,
      role: 'USER',
    },
  });
  expect('POST /auth/register (ADMIN crée un agent USER) → 201', agentRegister, 201);

  const agentLogin = await req('POST', '/auth/login', {
    body: { email: agentEmail, password: userPwd },
  });
  const agentToken = agentLogin.json?.accessToken;
  check("login de l'agent OK", !!agentToken);

  const agentPayable = await req('GET', `/rent-dues/contract/${c1}/payable`, { token: agentToken });
  expect("GET payable en tant qu'agent (USER) → 200", agentPayable, 200);
  check(
    'M+1 au loyer augmenté (600000)',
    agentPayable.json?.[0]?.month.startsWith(firstNextMonth) && agentPayable.json?.[0]?.amount === 600000,
    `premier=${JSON.stringify(agentPayable.json?.[0])}`,
  );
  expect(
    "POST /payments en tant qu'agent (USER) → 201",
    await payUntil(agentToken, c1, monthStr(1), 600000, { paymentMethod: 'MOBILE_MONEY' }),
    201,
  );

  const usersList = await req('GET', '/users?skip=0&take=5', { token: adminToken });
  expect('GET /users (ADMIN, paginé) → 200', usersList, 200);

  // récupère l'id du user créé via la liste
  const createdUser = (usersList.json?.items || []).find((u) => u.email === newUserEmail);
  if (createdUser) {
    const userGet = await req('GET', `/users/${createdUser.id}`, { token: adminToken });
    expect('GET /users/:id (ADMIN) → 200', userGet, 200);
  } else {
    check('user créé visible dans la liste', false, 'introuvable dans /users (page 1)');
  }

  const meUpdate = await req('PATCH', '/users/me', {
    token: userToken,
    body: { name: 'E2E User Modifié' },
  });
  expect('PATCH /users/me → 200', meUpdate, 200);

  const pwdChange = await req('PATCH', '/users/me/password', {
    token: userToken,
    body: { currentPassword: userPwd, newPassword: 'N3wP@ssw0rd!' },
  });
  expect('PATCH /users/me/password → 200', pwdChange, 200);

  // contrôle des rôles : un USER ne peut pas faire d'actions ADMIN
  const userForbidLocal = await req('POST', '/locals', {
    token: userToken,
    body: { code: `LOCAL-${rnd3()}`, name: 'interdit' },
  });
  expect('POST /locals en tant que USER → 403', userForbidLocal, 403);

  const userForbidUsers = await req('GET', '/users', { token: userToken });
  expect('GET /users en tant que USER → 403', userForbidUsers, 403);

  const userForbidRegister = await req('POST', '/auth/register', {
    token: userToken,
    body: { name: 'x', email: `x-${TS}@t.com`, password: 'P@ssw0rd!' },
  });
  expect('POST /auth/register en tant que USER → 403', userForbidRegister, 403);

  if (createdUser) {
    const adminPatchUser = await req('PATCH', `/users/${createdUser.id}`, {
      token: adminToken,
      body: { name: 'E2E User (admin patch)' },
    });
    expect('PATCH /users/:id (ADMIN) → 200', adminPatchUser, 200);

    const del = await req('DELETE', `/users/${createdUser.id}`, { token: adminToken });
    expect('DELETE /users/:id (ADMIN) → 204', del, 204);
  }

  // ===== RATE-LIMITING =====
  // Le login est limité à 5 tentatives/minute PAR E-MAIL, pas par IP : en prod,
  // toutes les requêtes arrivent du BFF Vercel via Caddy, un compteur par IP
  // bloquerait tout le monde en même temps. Ici aussi tout vient de la même IP.
  section('Rate-limiting');
  const throttledEmail = `ratelimit-${TS}@e2e.local`;
  const attempts = [];
  for (let i = 0; i < 6; i++) {
    attempts.push(
      await req('POST', '/auth/login', {
        body: { email: throttledEmail, password: 'wrong-password-xyz' },
      }),
    );
  }
  check(
    '5 premières tentatives sur un même e-mail → 401',
    attempts.slice(0, 5).every((r) => r.status === 401),
    attempts.map((r) => r.status).join(','),
  );
  expect('6e tentative sur le même e-mail → 429', attempts[5], 429);

  const adminAfterThrottle = await req('POST', '/auth/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(
    'login admin juste après → 200 (compteur par e-mail, pas par IP)',
    adminAfterThrottle,
    200,
  );

  return finish();
}

function finish() {
  console.log('\n' + c.b('── Résumé ' + '─'.repeat(50)));
  const total = passed + failed;
  console.log(`  ${c.g(passed + ' réussis')} / ${failed > 0 ? c.r(failed + ' échoués') : '0 échoué'}  (${total} vérifications)`);
  if (failures.length) {
    console.log(c.r('\n  Échecs:'));
    for (const f of failures) console.log(c.r('   • ') + f);
  }
  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(c.r('\nErreur fatale du script:'), e);
  process.exit(2);
});
