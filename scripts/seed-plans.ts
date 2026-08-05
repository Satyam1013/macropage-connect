import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();

/**
 * One-time bootstrap: copies the static PLAN_PRICING catalog (duplicated
 * below rather than imported, since billing.constants.ts pulls in
 * plans.config.ts which reads Razorpay plan-id env vars at import time —
 * importing it here would run before dotenv.config() above due to how
 * TypeScript hoists imports) into the `plans` collection, which
 * BillingService now reads directly (see billing.service.ts's getPlans()
 * / updatePlanCatalog()).
 *
 * Also folds in any pre-existing admin edits from the old
 * `adminplanoverrides` collection so prior pricing-page changes aren't
 * lost in the cutover.
 *
 * Safe to re-run: only creates plans that don't already exist in the
 * `plans` collection — never overwrites a plan that's already been seeded
 * or edited via the admin API, so it won't clobber live changes.
 *
 * Run once, by hand: `npm run seed:plans`
 */

const PLAN_PRICING = [
  {
    id: "STARTER",
    name: "Starter",
    desc: "Perfect to explore and get started with WhatsApp API.",
    badge: "14-Day Trial",
    highlight: false,
    cta: "Start Free",
    ctaHref: "https://app.macropage.in/register",
    currency: "INR",
    razorpayPlanIds: {
      monthly: process.env.RAZORPAY_STARTER_MONTHLY_PLAN_ID ?? "",
      quarterly: process.env.RAZORPAY_STARTER_QUARTERLY_PLAN_ID ?? "",
      yearly: process.env.RAZORPAY_STARTER_YEARLY_PLAN_ID ?? "",
    },
    pricing: {
      monthly: { price: 1999, billedAs: "₹1,999/month" },
      quarterly: {
        price: 1799,
        billedAs: "₹5,397 every 3 months",
        savings: "Save 10%",
      },
      yearly: { price: 1499, billedAs: "₹17,988/year", savings: "Save 25%" },
    },
    features: [
      "1 WhatsApp Business Number",
      "Up to 1,000 messages/month",
      "Basic Chatbot Builder",
      "Shared Team Inbox",
      "Message Templates (5)",
      "Basic Analytics",
      "Email Support",
    ],
    notIncluded: [
      "Bulk Broadcasts",
      "CRM Integration",
      "API Access",
      "Dedicated Manager",
    ],
  },
  {
    id: "GROWTH",
    name: "Growth",
    desc: "For growing businesses ready to scale their WhatsApp marketing.",
    badge: "Most Popular",
    highlight: true,
    cta: "Start Free Trial",
    ctaHref: "https://app.macropage.in/register",
    currency: "INR",
    razorpayPlanIds: {
      monthly: process.env.RAZORPAY_GROWTH_MONTHLY_PLAN_ID ?? "",
      quarterly: process.env.RAZORPAY_GROWTH_QUARTERLY_PLAN_ID ?? "",
      yearly: process.env.RAZORPAY_GROWTH_YEARLY_PLAN_ID ?? "",
    },
    pricing: {
      monthly: { price: 3499, billedAs: "₹3,499/month" },
      quarterly: {
        price: 3149,
        billedAs: "₹9,447 every 3 months",
        savings: "Save 10%",
      },
      yearly: { price: 2624, billedAs: "₹31,488/year", savings: "Save 25%" },
    },
    features: [
      "3 WhatsApp Business Numbers",
      "Up to 25,000 messages/month",
      "Advanced Chatbot & Flows",
      "Team Inbox (5 agents)",
      "Unlimited Templates",
      "Bulk Broadcast Campaigns",
      "Basic CRM Integration",
      "Full Analytics Dashboard",
      "Priority Email & Chat Support",
    ],
    notIncluded: ["Dedicated Manager", "Custom API Rate Limits"],
  },
  {
    id: "BUSINESS",
    name: "Scale",
    desc: "For established businesses that need enterprise-grade power.",
    badge: null,
    highlight: false,
    cta: "Start Free Trial",
    ctaHref: "https://app.macropage.in/register",
    currency: "INR",
    razorpayPlanIds: {
      monthly: process.env.RAZORPAY_BUSINESS_MONTHLY_PLAN_ID ?? "",
      quarterly: process.env.RAZORPAY_BUSINESS_QUARTERLY_PLAN_ID ?? "",
      yearly: process.env.RAZORPAY_BUSINESS_YEARLY_PLAN_ID ?? "",
    },
    pricing: {
      monthly: { price: 8999, billedAs: "₹8,999/month" },
      quarterly: {
        price: 8099,
        billedAs: "₹24,297 every 3 months",
        savings: "Save 10%",
      },
      yearly: { price: 6749, billedAs: "₹80,988/year", savings: "Save 25%" },
    },
    features: [
      "Unlimited WhatsApp Numbers",
      "Unlimited Messages",
      "Full Automation Suite",
      "Unlimited Agents",
      "Unlimited Templates",
      "Bulk Broadcasts + Scheduling",
      "Full CRM & API Integration",
      "Advanced Analytics & Reports",
      "Webhooks & Custom Integrations",
      "Dedicated Account Manager",
      "SLA-backed Uptime",
    ],
    notIncluded: [],
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    desc: "Custom solutions for large teams with advanced needs.",
    badge: null,
    highlight: false,
    cta: "Contact Sales",
    ctaHref: "mailto:sales@macropage.in",
    currency: "INR",
    custom: true,
    pricing: {
      monthly: { price: 0, billedAs: "Custom pricing" },
      quarterly: { price: 0, billedAs: "Custom pricing" },
      yearly: { price: 0, billedAs: "Custom pricing" },
    },
    features: [
      "Everything in Scale",
      "Custom Integrations",
      "Dedicated Infrastructure",
      "Custom SLA",
      "Priority Onboarding",
    ],
    notIncluded: [],
  },
];

function mergePlan(
  current: Record<string, unknown>,
  changes: Record<string, unknown>,
): Record<string, unknown> {
  return Object.entries(changes).reduce<Record<string, unknown>>(
    (result, [key, value]) => {
      const existing = result[key];
      result[key] =
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        existing &&
        typeof existing === "object" &&
        !Array.isArray(existing)
          ? mergePlan(
              existing as Record<string, unknown>,
              value as Record<string, unknown>,
            )
          : value;
      return result;
    },
    { ...current },
  );
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!, {
    serverSelectionTimeoutMS: 15000,
  });
  const db = mongoose.connection.db!;

  const existingPlanIds = new Set(
    (await db.collection("plans").find({}).toArray()).map(
      (p) => p.planId as string,
    ),
  );
  const legacyOverrides = await db
    .collection("adminplanoverrides")
    .find({})
    .toArray();
  const overrideByPlanId = new Map(
    legacyOverrides.map((o) => [o.planId as string, o.plan as object]),
  );

  let seeded = 0;
  let skipped = 0;

  for (const defaultPlan of PLAN_PRICING) {
    if (existingPlanIds.has(defaultPlan.id)) {
      console.log(`Skipping ${defaultPlan.id}: already in plans collection`);
      skipped++;
      continue;
    }

    const legacyOverride = overrideByPlanId.get(defaultPlan.id);
    const plan = legacyOverride
      ? mergePlan(defaultPlan, legacyOverride as Record<string, unknown>)
      : defaultPlan;

    await db.collection("plans").insertOne({
      planId: defaultPlan.id,
      plan,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(
      `Seeded ${defaultPlan.id}${legacyOverride ? " (with legacy admin override applied)" : ""}`,
    );
    seeded++;
  }

  console.log(`Done. Seeded ${seeded}, skipped ${skipped}.`);
  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
