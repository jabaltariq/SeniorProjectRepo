import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

if (!serviceAccountPath) {
  console.error(
    'Missing service account path. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_PATH to your Firebase Admin SDK JSON file.'
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

const achievementDefinitions = [
  {
    id: 'firstBetPlaced',
    title: 'First Bet Placed',
    description: 'Place your first bet.',
    icon: 'ticket',
    active: true,
    sortOrder: 10,
    rule: {
      type: 'metric_gte',
      metric: 'betsPlaced',
      value: 1,
    },
  },
  {
    id: 'bankrollBuilder',
    title: 'Bankroll Builder',
    description: 'Reach $15,000 in balance.',
    icon: 'wallet',
    active: true,
    sortOrder: 20,
    rule: {
      type: 'metric_gte',
      metric: 'money',
      value: 15000,
    },
  },
  {
    id: 'lossCollector25',
    title: 'Loss Collector',
    description: 'Record 25 losses.',
    icon: 'skull',
    active: true,
    sortOrder: 30,
    rule: {
      type: 'metric_gte',
      metric: 'losses',
      value: 25,
    },
  },
];

async function seedAchievementDefinitions() {
  const batch = db.batch();

  for (const achievement of achievementDefinitions) {
    const { id, ...data } = achievement;
    const ref = db.collection('achievementDefinitions').doc(id);
    batch.set(ref, data, { merge: true });
  }

  await batch.commit();

  console.log(`Seeded ${achievementDefinitions.length} achievement definition(s).`);
  console.log(
    achievementDefinitions.map((achievement) => `- ${achievement.id}`).join('\n')
  );
}

seedAchievementDefinitions().catch((error) => {
  console.error('Failed to seed achievement definitions.');
  console.error(error);
  process.exit(1);
});
