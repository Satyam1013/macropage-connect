/**
 * Seeds a WABAAccount for the first owner/admin user using META_TEST_* env vars.
 * Run with: npx ts-node -r tsconfig-paths/register scripts/seed-test-waba.ts
 */

// Node 18 doesn't expose globalThis.crypto; MongoDB driver v6+ requires it
import { webcrypto } from "crypto";
if (!globalThis.crypto)
  (globalThis as Record<string, unknown>).crypto = webcrypto;

import * as dotenv from "dotenv";
dotenv.config();

import * as crypto from "crypto";
import mongoose from "mongoose";
import axios from "axios";

const MONGODB_URI = process.env.MONGODB_URI!;
const ENCRYPTION_KEY = Buffer.from(
  (process.env.TOKEN_ENCRYPTION_KEY ?? "").padEnd(64, "0"),
  "hex",
);
const WABA_ID = process.env.META_TEST_WABA_ID!;
const PHONE_NUMBER_ID = process.env.META_TEST_PHONE_NUMBER_ID!;
const ACCESS_TOKEN = process.env.META_TEST_ACCESS_TOKEN!;
const BASE = "https://graph.facebook.com/v21.0";

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

async function main() {
  if (!MONGODB_URI || !WABA_ID || !PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    console.error(
      "Missing required env vars: MONGODB_URI, META_TEST_WABA_ID, META_TEST_PHONE_NUMBER_ID, META_TEST_ACCESS_TOKEN",
    );
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  // Fetch phone number details from Meta
  const phoneResp = await axios.get(`${BASE}/${PHONE_NUMBER_ID}`, {
    params: {
      fields:
        "display_phone_number,verified_name,quality_rating,messaging_limit_tier",
      access_token: ACCESS_TOKEN,
    },
  });
  const phoneData = phoneResp.data as {
    display_phone_number: string;
    verified_name: string;
    quality_rating?: string;
    messaging_limit_tier?: string;
  };
  console.log("Phone details:", phoneData);

  // Find the target user — by META_TEST_USER_EMAIL if set, else first owner/admin
  const userCol = mongoose.connection.collection("users");
  const targetEmail = process.env.META_TEST_USER_EMAIL;
  const user = targetEmail
    ? await userCol.findOne({ email: targetEmail.toLowerCase() })
    : ((await userCol.findOne(
        { role: { $in: ["owner", "admin", "OWNER", "ADMIN"] } },
        { sort: { createdAt: 1 } },
      )) ?? (await userCol.findOne({}, { sort: { createdAt: 1 } })));

  if (!user) {
    console.error("No users found in database. Create a user first.");
    process.exit(1);
  }

  const tenantId: string =
    (user.tenantId as string | undefined) ?? user._id.toString();
  console.log(`Using tenantId: ${tenantId} (user: ${user.email as string})`);

  const encryptedToken = encrypt(ACCESS_TOKEN);

  const wabaCol = mongoose.connection.collection("wabaaccounts");
  const result = await wabaCol.findOneAndUpdate(
    { tenantId },
    {
      $set: {
        tenantId,
        wabaId: WABA_ID,
        phoneNumberId: PHONE_NUMBER_ID,
        phoneNumber: phoneData.display_phone_number,
        displayName: phoneData.verified_name,
        businessName: phoneData.verified_name,
        accessToken: encryptedToken,
        tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        tokenExpired: false,
        metaConnected: true,
        qualityRating: phoneData.quality_rating ?? "GREEN",
        messagingTier: phoneData.messaging_limit_tier ?? "TIER_1K",
        webhookVerified: false,
        connectedAt: new Date(),
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  console.log("WABAAccount upserted:", result);

  // Mark the user's whatsappSetupDone = true
  await userCol.updateOne(
    { _id: user._id },
    { $set: { whatsappSetupDone: true } },
  );
  console.log("User whatsappSetupDone set to true");

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
