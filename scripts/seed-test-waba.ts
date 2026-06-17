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
const APP_ID = process.env.META_APP_ID!;
const APP_SECRET = process.env.META_APP_SECRET!;
const BASE = "https://graph.facebook.com/v21.0";

async function getLongLivedToken(
  shortToken: string,
): Promise<{ token: string; expiresAt: Date }> {
  if (!APP_ID || !APP_SECRET || APP_SECRET === "your_meta_app_secret") {
    console.warn(
      "META_APP_SECRET not set — using token as-is (may expire quickly)",
    );
    return {
      token: shortToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }
  try {
    const resp = await axios.get<{ access_token: string; expires_in?: number }>(
      `${BASE}/oauth/access_token`,
      {
        params: {
          grant_type: "fb_exchange_token",
          client_id: APP_ID,
          client_secret: APP_SECRET,
          fb_exchange_token: shortToken,
        },
      },
    );
    const expiresIn = resp.data.expires_in ?? 60 * 24 * 60 * 60;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    console.log(
      `Long-lived token obtained. Expires: ${expiresAt.toISOString()}`,
    );
    return { token: resp.data.access_token, expiresAt };
  } catch (err) {
    console.warn(
      "Token exchange failed — using token as-is:",
      (err as Error).message,
    );
    return {
      token: shortToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }
}

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

  // Exchange for long-lived token (60 days) before storing
  const { token: longToken, expiresAt: tokenExpiresAt } =
    await getLongLivedToken(ACCESS_TOKEN);

  // Fetch phone number details from Meta
  let phoneData = {
    display_phone_number: "+1 555-649-7547",
    verified_name: "Test Number",
    quality_rating: "GREEN",
    messaging_limit_tier: "TIER_1K",
  };
  try {
    const phoneResp = await axios.get(`${BASE}/${PHONE_NUMBER_ID}`, {
      params: {
        fields:
          "display_phone_number,verified_name,quality_rating,messaging_limit_tier",
        access_token: longToken,
      },
    });
    phoneData = phoneResp.data as typeof phoneData;
    console.log("Phone details:", phoneData);
  } catch {
    console.warn(
      "Could not fetch phone details from Meta (token may be expired) — using cached values",
    );
  }

  // Find the target user — by META_TEST_USER_EMAIL if set, else first owner/admin
  const userCol = mongoose.connection.collection("users");
  const targetEmail = process.env.META_TEST_USER_EMAIL;
  const user = targetEmail
    ? await userCol.findOne({ email: targetEmail.toLowerCase() })
    : ((await userCol.findOne(
        { role: { $in: ["OWNER", "ADMIN"] } },
        { sort: { createdAt: 1 } },
      )) ?? (await userCol.findOne({}, { sort: { createdAt: 1 } })));

  if (!user) {
    console.error("No users found in database. Create a user first.");
    process.exit(1);
  }

  const tenantId: string =
    (user.tenantId as string | undefined) ?? user._id.toString();
  console.log(`Using tenantId: ${tenantId} (user: ${user.email as string})`);

  const encryptedToken = encrypt(longToken);

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
        tokenExpiresAt,
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
