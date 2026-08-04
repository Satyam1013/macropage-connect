import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();

/**
 * One-time migration: copies macropage-admin's AdminUser accounts
 * (collection "adminusers", same MongoDB cluster/database) into
 * macropage-connect's own User collection, setting `platformRole` so they
 * can log in via connect's normal POST /auth/login. AdminRole values map
 * 1:1 to PlatformRole. passwordHash is copied as-is — bcrypt hashes are
 * portable between the `bcrypt` (admin) and `bcryptjs` (connect) packages.
 *
 * Run once, by hand, after the platform-auth foundation lands and before
 * cutting the admin frontend over: `ts-node -r tsconfig-paths/register scripts/migrate-admin-users.ts`
 */

const ADMIN_ROLE_TO_PLATFORM_ROLE: Record<string, string> = {
  "super-admin": "SUPER_ADMIN",
  "support-agent": "SUPPORT_AGENT",
};

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!, {
    serverSelectionTimeoutMS: 15000,
  });
  const db = mongoose.connection.db!;

  const adminUsers = await db.collection("adminusers").find({}).toArray();
  console.log(`Found ${adminUsers.length} admin user(s) to migrate`);

  let created = 0;
  let updated = 0;

  for (const adminUser of adminUsers) {
    const email = String(adminUser.email).toLowerCase();
    const platformRole = ADMIN_ROLE_TO_PLATFORM_ROLE[adminUser.role as string];
    if (!platformRole) {
      console.warn(`Skipping ${email}: unknown role "${adminUser.role}"`);
      continue;
    }

    const existing = await db.collection("users").findOne({ email });

    if (existing) {
      await db
        .collection("users")
        .updateOne({ email }, { $set: { platformRole } });
      updated++;
      console.log(`Updated existing user ${email} -> platformRole=${platformRole}`);
      continue;
    }

    await db.collection("users").insertOne({
      name: adminUser.name,
      email,
      password: adminUser.passwordHash,
      role: "OWNER",
      platformRole,
      emailVerified: true,
      whatsappSetupDone: false,
      businessInfoSaved: false,
      onboardingComplete: true,
      onboardingStep: 1,
      country: "IN",
      plan: "FREE",
      subscriptionType: "free",
      paidUser: false,
      marketingOptIn: false,
      twoFactorEnabled: false,
      backupCodes: [],
      timezone: "Asia/Kolkata",
      language: "en",
      notificationPrefs: {},
      onlineStatus: "offline",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    created++;
    console.log(`Created new user ${email} -> platformRole=${platformRole}`);
  }

  console.log(`Done. Created ${created}, updated ${updated}.`);
  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
