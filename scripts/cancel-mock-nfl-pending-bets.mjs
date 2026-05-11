/**
 * Cancels all PENDING bets for one user that are exclusively mock NFL markets
 * (same rules as `cancelPendingMockNflBetsForUser` in services/dbOps.ts):
 * singles with marketId prefix `mock-`, parlays whose every leg has mock- marketId.
 *
 * For each slip: status → CANCELLED, stake refunded to userInfo.money (unless isFree),
 * then pending head-to-head proposals on that slip are declined and challenger escrow refunded.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT_PATH=./path-to.json node scripts/cancel-mock-nfl-pending-bets.mjs <uid>
 *   node scripts/cancel-mock-nfl-pending-bets.mjs <uid> --dry-run
 *
 * @author maintenance script
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

const args = process.argv.slice(2).filter((a) => a !== '--dry-run');
const dryRun = process.argv.includes('--dry-run');
const uid = args[0]?.trim();

if (!uid) {
  console.error('Usage: node scripts/cancel-mock-nfl-pending-bets.mjs <firebaseAuthUid> [--dry-run]');
  process.exit(1);
}

if (!serviceAccountPath) {
  console.error(
    'Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_PATH to your service account JSON.',
  );
  process.exit(1);
}

const resolvedServiceAccountPath = path.isAbsolute(serviceAccountPath)
  ? serviceAccountPath
  : path.resolve(repoRoot, serviceAccountPath);

if (!fs.existsSync(resolvedServiceAccountPath)) {
  console.error(`Service account file not found: ${resolvedServiceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(resolvedServiceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const H2H_COLLECTION = 'headToHead';

function isMockNflOnlyBet(data) {
  const betType = data.betType === 'parlay' ? 'parlay' : 'single';
  if (betType === 'parlay') {
    const legs = Array.isArray(data.parlayLegs) ? data.parlayLegs : [];
    return legs.length > 0 && legs.every((leg) => String(leg.marketId ?? '').startsWith('mock-'));
  }
  return String(data.marketId ?? '').startsWith('mock-');
}

async function closePendingHeadToHeadsForOriginalBet(originalBetId) {
  const snap = await db.collection(H2H_COLLECTION).where('originalBetId', '==', originalBetId).get();
  for (const d of snap.docs) {
    const row = d.data();
    if (row.status !== 'PENDING_ACCEPT') continue;
    if (dryRun) {
      console.log(`  [dry-run] would decline H2H ${d.id} (refund challenger escrow)`);
      continue;
    }
    await db.runTransaction(async (tx) => {
      const ref = d.ref;
      const s = await tx.get(ref);
      if (!s.exists) return;
      if (s.data().status !== 'PENDING_ACCEPT') return;
      const challengerStake = Number(s.data().challengerStake) || 0;
      const challengerUserId = String(s.data().challengerUserId ?? '');
      if (challengerUserId && challengerStake > 0) {
        tx.update(db.collection('userInfo').doc(challengerUserId), { money: FieldValue.increment(challengerStake) });
      }
      tx.update(ref, { status: 'DECLINED', settledAt: FieldValue.serverTimestamp() });
    });
  }
}

async function main() {
  // Query by userID only (same as the app) so we do not require a composite index on (userID, status).
  const q = await db.collection('bets').where('userID', '==', uid).get();

  const targets = [];
  q.forEach((doc) => {
    const data = doc.data();
    if ((data.status ?? 'PENDING') !== 'PENDING') return;
    if (isMockNflOnlyBet(data)) targets.push({ id: doc.id, data });
  });

  if (targets.length === 0) {
    console.log(`No pending mock-NFL-only bets for uid ${uid}.`);
    return;
  }

  console.log(`${dryRun ? '[dry-run] ' : ''}Found ${targets.length} pending mock-NFL-only bet(s) for ${uid}:`);
  for (const { id, data } of targets) {
    console.log(`  - ${id}: ${data.marketTitle ?? ''} / ${data.optionLabel ?? ''} stake=${data.stake}`);
  }

  if (dryRun) {
    for (const { id } of targets) await closePendingHeadToHeadsForOriginalBet(id);
    return;
  }

  for (const { id, data } of targets) {
    const stake = Number(data.stake) || 0;
    const isFree = data.isFree === true;
    const userId = String(data.userID ?? uid);

    const batch = db.batch();
    const betRef = db.collection('bets').doc(id);
    batch.update(betRef, {
      status: 'CANCELLED',
      settledAt: FieldValue.serverTimestamp(),
    });
    if (!isFree && stake > 0) {
      batch.update(db.collection('userInfo').doc(userId), { money: FieldValue.increment(stake) });
    }
    await batch.commit();

    const marketId = String(data.marketId ?? '');
    if (marketId.startsWith('mock-')) {
      await closePendingHeadToHeadsForOriginalBet(id);
    }
    console.log(`Cancelled ${id}`);
  }

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
