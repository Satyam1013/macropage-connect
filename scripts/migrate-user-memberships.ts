import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();

/**
 * One-time migration for the multi-account membership feature: creates a
 * UserAccountMembership row for every existing user, mirroring their
 * current tenantId + role. Must run before deploying the account-selection
 * gate (jwt-auth.guard.ts) — until it runs, every existing user has zero
 * memberships and GET /auth/my-accounts returns an empty list, and since
 * every fresh login now sets pendingAccountSelection=true, they'd have no
 * account to select and be locked out entirely.
 *
 * A tenant owner's own User doc never has `tenantId` set (it IS the
 * tenantId, per the app's existing convention) — this migration accounts
 * for that by falling back to the user's own _id.
 *
 * Run once, by hand: `ts-node -r tsconfig-paths/register scripts/migrate-user-memberships.ts`
 */

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!, {
    serverSelectionTimeoutMS: 15000,
  });
  const db = mongoose.connection.db!;

  const users = await db.collection("users").find({}).toArray();
  console.log(`Found ${users.length} user(s) to migrate`);

  let created = 0;
  let skipped = 0;

  for (const user of users) {
    const tenantId = String(user.tenantId ?? user._id);
    const role = user.role as string | undefined;
    if (!role) {
      console.warn(`Skipping ${user.email as string}: no role set`);
      skipped++;
      continue;
    }

    const result = await db.collection("useraccountmemberships").updateOne(
      { userId: String(user._id), tenantId },
      {
        $set: {
          userId: String(user._id),
          tenantId,
          role,
          isActive: true,
        },
        $setOnInsert: { createdAt: new Date() },
        $currentDate: { updatedAt: true },
      },
      { upsert: true },
    );

    if (result.upsertedCount > 0) created++;
  }

  console.log(
    `Done. Created ${created} membership(s), skipped ${skipped} user(s) without a role.`,
  );
  console.log(`Total users: ${users.length}`);
  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
