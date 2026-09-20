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
const currentMonth = `${Y}-${pad(M + 1)}`; // YYYY-MM
const firstNextMonth = isoDay(new Date(Date.UTC(Y, M + 1, 1)));
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
  const due1 = await req('POST', '/rent-dues/generate', {
    token: adminToken,
    body: { contractId: c1, month: currentMonth },
  });
  expect('POST /rent-dues/generate → 201', due1, 201);
  const dueId = due1.json?.id;
  check('échéance générée = montant du loyer (500000)', due1.json?.amount === 500000);

  const dupDue = await req('POST', '/rent-dues/generate', {
    token: adminToken,
    body: { contractId: c1, month: currentMonth },
  });
  expect('POST /rent-dues/generate même mois → 409', dupDue, 409);

  const allDues = await req('GET', `/rent-dues/contract/${c1}`, { token: adminToken });
  expect('GET /rent-dues/contract/:id → 200', allDues, 200);

  const pendingDues = await req('GET', `/rent-dues/contract/${c1}/pending`, { token: adminToken });
  expect('GET /rent-dues/contract/:id/pending → 200', pendingDues, 200);
  check(
    "l'échéance générée est PENDING",
    Array.isArray(pendingDues.json) && pendingDues.json.some((d) => d.id === dueId),
  );

  // ===== PAIEMENTS =====
  section('Paiements');
  const badPay = await req('POST', '/payments', {
    token: adminToken,
    body: { rentDueIds: [], paymentDate: today, paymentMethod: 'CASH' },
  });
  expect('POST /payments rentDueIds vide → 400', badPay, 400);

  const pay1 = await req('POST', '/payments', {
    token: adminToken,
    body: { rentDueIds: [dueId], paymentDate: today, paymentMethod: 'CASH' },
  });
  expect('POST /payments (solde 1 échéance) → 201', pay1, 201);
  const payId = pay1.json?.id;
  check('montant du paiement = 500000', pay1.json?.amount === 500000);

  const rePay = await req('POST', '/payments', {
    token: adminToken,
    body: { rentDueIds: [dueId], paymentDate: today, paymentMethod: 'CASH' },
  });
  expect('POST /payments échéance déjà soldée → 409', rePay, 409);

  const payments = await req('GET', '/payments?skip=0&take=5', { token: adminToken });
  expect('GET /payments (paginé) → 200', payments, 200);

  const payByContract = await req('GET', `/payments/contract/${c1}`, { token: adminToken });
  expect('GET /payments/contract/:id → 200', payByContract, 200);
  check(
    'le contrat a ≥ 2 paiements (DEPOSIT_HELD + RENT)',
    Array.isArray(payByContract.json) && payByContract.json.length >= 2,
  );

  const payGet = await req('GET', `/payments/${payId}`, { token: adminToken });
  expect('GET /payments/:id → 200', payGet, 200);

  // ===== REÇUS (S3/MinIO) =====
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

  // Génère 3 échéances : M-2, M-1, M
  const mmDueIds = [];
  for (const off of [-2, -1, 0]) {
    const d = await req('POST', '/rent-dues/generate', {
      token: adminToken,
      body: { contractId: cMM, month: monthStr(off) },
    });
    if (d.status === 201) mmDueIds.push(d.json.id);
    else check(`génération échéance ${monthStr(off)}`, false, `status=${d.status} ${JSON.stringify(d.json)}`);
  }
  check('3 échéances générées (M-2, M-1, M)', mmDueIds.length === 3, `générées=${mmDueIds.length}`);

  // Un seul paiement qui solde les 3 mois d'un coup
  const payMM = await req('POST', '/payments', {
    token: adminToken,
    body: { rentDueIds: mmDueIds, paymentDate: today, paymentMethod: 'ORANGE_MONEY' },
  });
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
  const mmPending = await req('GET', `/rent-dues/contract/${cMM}/pending`, { token: adminToken });
  check(
    'plus aucune échéance PENDING après le paiement',
    Array.isArray(mmPending.json) && mmPending.json.length === 0,
    `restantes=${mmPending.json?.length}`,
  );

  // Règle métier : repayer un lot dont une échéance est déjà soldée → 409
  const mmRepay = await req('POST', '/payments', {
    token: adminToken,
    body: { rentDueIds: mmDueIds, paymentDate: today, paymentMethod: 'CASH' },
  });
  expect('POST /payments multi-mois déjà soldé → 409', mmRepay, 409);

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

  // Règle 9 : une échéance impayée dont le mois précède la date de fin
  // interdit la résiliation. Les loyers se règlent AVANT de résilier.
  const dueT = await req('POST', '/rent-dues/generate', {
    token: adminToken,
    body: { contractId: ctId, month: currentMonth },
  });
  expect('échéance générée sur le contrat à résilier → 201', dueT, 201);

  const earlyTerminate = await req('PATCH', `/contracts/${ctId}/terminate`, {
    token: adminToken,
    body: { endDate: today, paymentDate: today, paymentMethod: 'CASH' },
  });
  expect('PATCH /terminate avec une échéance impayée → 409', earlyTerminate, 409);

  const payT = await req('POST', '/payments', {
    token: adminToken,
    body: { rentDueIds: [dueT.json?.id], paymentDate: today, paymentMethod: 'CASH' },
  });
  expect("solde de l'échéance avant résiliation → 201", payT, 201);

  const terminate = await req('PATCH', `/contracts/${ctId}/terminate`, {
    token: adminToken,
    body: { endDate: today, paymentDate: today, paymentMethod: 'CASH' },
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

  // ===== BASCULE EN LATE =====
  // une échéance impayée dont l'exigibilité est passée doit basculer
  // en LATE. Jusqu'ici le cron était appelé sans qu'on vérifie son effet.
  section('Bascule automatique en LATE');
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

  const dueL = await req('POST', '/rent-dues/generate', {
    token: adminToken,
    body: { contractId: clId, month: monthStr(-2) },
  });
  expect('échéance de M-2 générée → 201', dueL, 201);
  check(
    "l'échéance naît PENDING",
    dueL.json?.status === 'PENDING',
    `status=${dueL.json?.status}`,
  );

  const markLate = await req('POST', '/rent-dues/cron/mark-late', { token: adminToken });
  expect('POST /rent-dues/cron/mark-late → 2xx', markLate, [200, 201]);

  const duesL = await req('GET', `/rent-dues/contract/${clId}`, { token: adminToken });
  const dueLAfter = (duesL.json || []).find((d) => d.id === dueL.json?.id);
  check(
    "l'échéance impayée de M-2 est passée en LATE",
    dueLAfter?.status === 'LATE',
    `status=${dueLAfter?.status}`,
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
