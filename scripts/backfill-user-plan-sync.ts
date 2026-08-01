import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();

// One-time fix for the syncUserPlan bug: it filtered users by
// { tenantId }, which never matches an owner's own document (owners never
// have a tenantId field set on themselves — only team members do, pointing
// at the owner's _id). So every owner who upgraded kept showing their old
// trial-era plan/trialEndsAt. This re-runs the same sync for every tenant
// with an ACTIVE subscription, now matching { $or: [{tenantId}, {_id}] }.
const PAID_PLANS = ["STARTER", "GROWTH", "BUSINESS", "ENTERPRISE"];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!, {
    serverSelectionTimeoutMS: 15000,
  });
  const db = mongoose.connection.db!;

  const activeSubs = await db
    .collection("subscriptions")
    .find({ status: "ACTIVE" })
    .toArray();

  console.log(`Found ${activeSubs.length} active subscriptions`);

  let usersUpdated = 0;
  for (const sub of activeSubs) {
    const tenantId = sub.tenantId as string;
    const plan = sub.plan as string;
    const isPaid = PAID_PLANS.includes(plan);
    const subscriptionType =
      plan === "BUSINESS" || plan === "ENTERPRISE"
        ? "business"
        : isPaid
          ? "pro"
          : "free";

    const update: Record<string, unknown> = {
      plan: isPaid ? "PRO" : "FREE",
      billingPlan: plan,
      subscriptionType,
      paidUser: isPaid,
    };
    if (isPaid) update.trialEndsAt = null;

    if (!mongoose.Types.ObjectId.isValid(tenantId)) {
      console.log(`Skipping invalid tenantId=${tenantId}`);
      continue;
    }

    const result = await db.collection("users").updateMany(
      {
        $or: [
          { tenantId },
          { _id: new mongoose.Types.ObjectId(tenantId) },
        ],
      },
      { $set: update },
    );

    if (result.modifiedCount > 0) {
      console.log(
        `tenant=${tenantId} plan=${plan} → updated ${result.modifiedCount} user(s)`,
      );
    }
    usersUpdated += result.modifiedCount;
  }

  console.log(`\nDone. ${usersUpdated} user record(s) updated in total.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
