export const DOC_ARTICLES = [
  // ── getting-started ──────────────────────────────────────────────────────
  {
    title: "Welcome to Macropage Connect",
    slug: "welcome-to-macropage-connect",
    category: "getting-started",
    order: 1,
    tags: ["overview", "intro", "start"],
    content: `# Welcome to Macropage Connect

Macropage Connect is a WhatsApp Business API platform that helps Indian businesses manage customer conversations, run bulk campaigns, automate replies, and collaborate as a team — all from one portal.

## What you can do

**Inbox** — Manage all WhatsApp conversations in one place. Assign chats to agents, add internal notes, resolve conversations, and see real-time message status ticks.

**Campaigns** — Send bulk WhatsApp messages to your contacts using approved templates. Schedule campaigns, track delivery rates, and estimate costs before sending.

**Templates** — Create and submit WhatsApp message templates for Meta approval. Use variables for personalised messages.

**Contacts** — Import and manage your customer database. Tag contacts, search, filter, and view conversation history.

**Automation** — Set up keyword-based auto replies (Rules), build multi-step conversation flows, and configure AI responses.

**Team** — Invite agents and managers, assign roles, and manage who can access what in the portal.

**Analytics** — Track message volume, campaign performance, agent response times, and quality ratings.

## Quick start checklist

1. Complete WhatsApp Business setup
2. Import your contacts
3. Create your first message template
4. Send a test campaign
5. Invite your team members

## Getting help

Use the chat widget (bottom-right corner) to search our help docs or reach our support team.`,
  },

  {
    title: "How to set up WhatsApp Business",
    slug: "whatsapp-business-setup",
    category: "getting-started",
    order: 2,
    tags: ["whatsapp", "setup", "waba", "connect", "meta"],
    content: `# How to set up WhatsApp Business

Connecting your WhatsApp Business Account (WABA) is the first and most important step. Once connected, you can send and receive WhatsApp messages through the portal.

## What you need before starting

- A Facebook account (personal or business)
- A Facebook Business Portfolio (create free at business.facebook.com)
- A WhatsApp Business phone number (can be a new number or existing one)

## Step 1 — Go to WhatsApp Setup

From the dashboard, click the setup banner or go to Settings → WhatsApp → Setup.

## Step 2 — Connect with Facebook

Click **Continue with Facebook**. A popup will open asking you to log into your Facebook account.

## Step 3 — Select your WABA

Inside the popup:
- Select your Facebook Business Portfolio
- Select or create a WhatsApp Business Account
- Select your phone number

If you don't have a WABA yet, you can create one directly inside the popup.

## Step 4 — Verify connection

After completing the popup, your phone number and display name will be shown automatically. No manual entry needed.

## Step 5 — Send a test message

Send a test message to confirm your connection is working. You should receive it on the target phone within seconds.

## Troubleshooting

**"Token expired" error**
Your WhatsApp access token has expired. Go to Settings → WhatsApp → Reconnect and complete the Facebook login again.

**"No WABA found" error**
Make sure you selected a WhatsApp Business Account during the Facebook popup flow. Check that your Facebook Business Portfolio has a WABA attached to it.

**Messages not sending**
Check Settings → WhatsApp to confirm your quality rating is GREEN and your token is not expired.`,
  },

  {
    title: "Understanding your free trial",
    slug: "free-trial-guide",
    category: "getting-started",
    order: 3,
    tags: ["trial", "free", "plan", "limits"],
    content: `# Understanding your free trial

Every new Macropage Connect account gets a 14-day free trial with full Growth plan access. No credit card required.

## What's included in the trial

- Unlimited team members
- Up to 25,000 contacts
- Unlimited automation rules
- Conversation flows
- All inbox features
- Campaign creation and sending
- Template management
- Analytics dashboard

## What's NOT included in trial

- AI Bot (Business plan feature)
- Dedicated support
- Custom integrations

## What happens when trial ends

If you don't subscribe before your trial ends, automation features will be locked. Your conversations, contacts, and data remain safe. You can subscribe anytime to restore access.

## How to subscribe

Click **Upgrade** in the top navigation bar or go to Settings → Billing → Choose a plan. Plans start at ₹999/month for the Starter plan.

## Can I extend my trial?

Contact our support team before your trial ends. We may be able to extend it based on your usage and business needs.`,
  },

  // ── inbox ────────────────────────────────────────────────────────────────
  {
    title: "Using the Inbox",
    slug: "using-the-inbox",
    category: "inbox",
    order: 1,
    tags: ["inbox", "conversations", "messages", "chat"],
    content: `# Using the Inbox

The Inbox is where all customer WhatsApp conversations are managed. Every message your business receives appears here in real time.

## Sending a message

Type in the input box at the bottom and press Enter or click Send.

**Important:** WhatsApp only allows free-form messages within 24 hours of the last customer message. After that you must use an approved template.

## Using Quick Replies

Type **/** in the message box to see your saved quick replies. Select one to insert it as editable text.

## Internal Notes

Switch to the **Note** tab in the input area to add internal notes visible only to your team — customers cannot see these.

## Assigning conversations

Click the **Assign** button in the chat header to assign the conversation to yourself or another team member. Only Admins, Owners, and Managers can assign conversations.

## Resolving conversations

Click **Resolve** to mark a conversation as done. It moves to the Resolved tab. Resolved conversations can be reopened at any time.

## Message status ticks

- **Single grey tick** — message sent
- **Double grey tick** — delivered to phone
- **Double blue tick** — read by customer`,
  },

  {
    title: "Assigning and transferring conversations",
    slug: "assigning-conversations",
    category: "inbox",
    order: 2,
    tags: ["assign", "transfer", "agent", "conversation"],
    content: `# Assigning and transferring conversations

## How to assign

1. Open a conversation in the inbox
2. Click the **Assign** button in the chat header
3. A modal opens showing all team members with their online/offline status
4. Click on a team member to assign

## Who can assign conversations

Only **Owners**, **Admins**, and **Managers** can assign conversations. Agents can only view and reply to conversations assigned to them.

## Transferring to another agent

Follow the same steps as assigning. Selecting a different agent transfers the conversation to them.

## Notification on assignment

When a conversation is assigned to you, you receive an instant notification in the portal. The conversation also appears in your inbox immediately.`,
  },

  // ── campaigns ────────────────────────────────────────────────────────────
  {
    title: "Creating and launching campaigns",
    slug: "creating-campaigns",
    category: "campaigns",
    order: 1,
    tags: ["campaign", "bulk", "broadcast", "send", "launch"],
    content: `# Creating and launching campaigns

Campaigns let you send bulk WhatsApp messages to your contacts using approved templates.

## Before you start

You need:
- At least one **approved** WhatsApp template
- At least one contact imported

## Step 1 — Campaign name and template

1. Go to Campaigns → New Campaign
2. Enter a campaign name
3. Select an approved template from the dropdown
4. Click Next

## Step 2 — Select audience

Choose who receives the campaign:
- **All contacts** — everyone in your list
- **By tag** — only contacts with specific tags

## Step 3 — Schedule

Choose when to send:
- **Send now** — launches immediately after review
- **Schedule** — pick a future date and time

## Step 4 — Review and launch

Review the template preview, recipient count, estimated cost, and click **Launch**.

**Note:** Only Owners, Admins, and Managers can launch campaigns.

## Campaign cost estimate

Cost is estimated using Meta's India rates:
- Marketing template: ₹0.83 per conversation
- Utility template: ₹0.15 per conversation
- Authentication: ₹0.13 per conversation

These are Meta's charges billed directly to your WhatsApp Business account. Macropage Connect does not charge per message.`,
  },

  // ── templates ────────────────────────────────────────────────────────────
  {
    title: "Creating message templates",
    slug: "creating-templates",
    category: "templates",
    order: 1,
    tags: ["template", "create", "submit", "approval", "meta", "pending"],
    content: `# Creating message templates

WhatsApp templates must be approved by Meta before you can use them in campaigns or to start conversations with customers.

## Template categories

**Marketing** — Promotions, offers, announcements. Cost: ₹0.83/conv.
**Utility** — Order updates, appointment reminders. Cost: ₹0.15/conv.
**Authentication** — OTPs and verification codes. Cost: ₹0.13/conv.

## How to create a template

1. Go to Campaigns → Templates → Create Template
2. Enter a template name (lowercase, numbers, underscores only)
3. Select category and language
4. Build header, body, footer, and buttons
5. Click Submit for Approval

## Using variables

Use {{1}}, {{2}} etc for dynamic content:

\`Hello {{1}}, your order {{2}} has been confirmed!\`

Always provide example values when submitting templates with variables.

## Template statuses

- **Pending** — under Meta review
- **Approved** — ready to use in campaigns
- **Rejected** — did not meet Meta guidelines
- **Paused** — paused by Meta due to low quality

## Why is my template stuck on Pending?

Most common reason: your Meta app is still in **Development mode**. Templates in Dev mode are never reviewed. Switch your app to **Live mode** at developers.facebook.com → your app → top right toggle.`,
  },

  // ── automation ───────────────────────────────────────────────────────────
  {
    title: "Setting up automation rules",
    slug: "automation-rules",
    category: "automation",
    order: 1,
    tags: ["automation", "rules", "auto reply", "keyword", "bot"],
    content: `# Setting up automation rules

Automation rules let you automatically reply to customer messages based on keywords — without any human involvement.

## Types of rules

**Built-in rules** (always available):
- **First message greeting** — sent when a contact messages you for the first time
- **Outside business hours** — sent when someone messages outside your working hours

**Custom rules** — create your own keyword triggers with custom replies.

## Creating a custom rule

1. Go to Automation → Rules → New Rule
2. Set a trigger keyword (e.g. "price", "menu", "help")
3. Set the reply message
4. Toggle the rule ON and Save

## Rule availability by plan

- **Starter** — Up to 5 custom rules
- **Growth** — Unlimited custom rules + Flows
- **Business/Enterprise** — All features + AI Bot

## When rules don't fire

Rules stop firing for a conversation when a human agent has replied to it — automation pauses to avoid conflicting with the agent's responses.`,
  },

  {
    title: "Using Quick Replies",
    slug: "quick-replies",
    category: "automation",
    order: 2,
    tags: ["quick replies", "canned", "saved", "shortcuts", "slash"],
    content: `# Using Quick Replies

Quick Replies are saved text snippets that agents can instantly insert into the chat input.

## How to use Quick Replies in chat

**Method 1 — Slash command:**
Type **/** in the message input box. A searchable list appears. Type a few letters to filter. Click or press Enter to insert.

**Method 2 — Button:**
Click the 💬 button in the chat input toolbar.

Inserting a quick reply adds the text to your input box as **editable text** — you can modify it before sending. It does NOT send automatically.

## Creating Quick Replies

1. Go to Automation → Quick Replies
2. Click New Quick Reply
3. Enter a title and message content
4. Save

Quick Replies are shared across your whole team — everyone sees all saved replies.`,
  },

  // ── team ─────────────────────────────────────────────────────────────────
  {
    title: "Managing your team",
    slug: "managing-team",
    category: "team",
    order: 1,
    tags: ["team", "invite", "agent", "role", "member", "permission"],
    content: `# Managing your team

## Roles and what they can do

**Owner** — Full access including billing. Only one Owner per account.
**Admin** — Full access except billing.
**Manager** — Can view all conversations, create campaigns/templates, view settings.
**Agent** — Can view and reply to assigned conversations only.

## Inviting a team member

1. Go to Settings → Team
2. Click **Invite Member**
3. Enter their email address and select a role
4. Click Send Invite

They receive an email with a link to set up their account. The link expires in 7 days.

## Team member limits by plan

- Starter: 3 team members
- Growth: 10 team members
- Business: 25 team members
- Enterprise: Unlimited`,
  },

  // ── billing ───────────────────────────────────────────────────────────────
  {
    title: "Plans, billing and payments",
    slug: "plans-billing-payments",
    category: "billing",
    order: 1,
    tags: [
      "billing",
      "plan",
      "payment",
      "invoice",
      "subscription",
      "razorpay",
      "upgrade",
      "cost",
      "price",
    ],
    content: `# Plans, billing and payments

## Available plans

| Plan | Price | Team | Contacts |
|------|-------|------|----------|
| Starter | ₹999/mo | 3 | 5,000 |
| Growth | ₹2,499/mo | 10 | 25,000 |
| Business | ₹5,999/mo | 25 | 1,00,000 |
| Enterprise | Custom | Unlimited | Unlimited |

Save 10% on quarterly billing. Save 20% on yearly billing.

## How to upgrade

Click **Upgrade** in the top navigation or go to Settings → Billing → Choose Plan. Complete payment via Razorpay (cards, UPI, net banking accepted).

## Cancelling your subscription

Go to Settings → Billing → Cancel Subscription. You keep access until the end of the current billing period. No refunds for unused time.

## WhatsApp message costs

WhatsApp charges are billed directly by Meta to your WhatsApp Business account. Macropage Connect does NOT charge per message.`,
  },

  // ── contacts ─────────────────────────────────────────────────────────────
  {
    title: "Managing contacts",
    slug: "managing-contacts",
    category: "contacts",
    order: 1,
    tags: ["contacts", "import", "csv", "tags", "customer", "upload"],
    content: `# Managing contacts

## Importing contacts

1. Go to Contacts → Import
2. Download the CSV template
3. Fill in: name (required), phone with country code (required), email (optional), tags (optional)
4. Upload the CSV and confirm

## Using tags for segmentation

Tags help you send campaigns to specific groups. Examples:
- City: "Mumbai", "Delhi", "Bangalore"
- Type: "VIP", "Lead", "Customer"
- Stage: "Trial", "Subscribed", "Churned"

## Contact limits by plan

- Starter: 5,000 contacts
- Growth: 25,000 contacts
- Business: 1,00,000 contacts
- Enterprise: Unlimited`,
  },

  // ── settings ──────────────────────────────────────────────────────────────
  {
    title: "Portal settings overview",
    slug: "portal-settings",
    category: "settings",
    order: 1,
    tags: ["settings", "profile", "notifications", "whatsapp", "account"],
    content: `# Portal settings overview

## Profile settings (all roles)

- Update your name and avatar
- Change your email address
- Change your password
- Manage notification preferences

## Notification preferences (all roles)

Control in-app, email, and WhatsApp notifications for events like new messages, conversation assignments, campaign results, and template approvals.

## WhatsApp settings (Owner/Admin only to change)

- View WABA ID, Phone Number ID, quality rating, messaging tier
- Reconnect WhatsApp if token expired
- Verify webhook status

## Billing settings (Owner only)

- View current plan and status
- Upgrade or change plan
- View payment history
- Cancel subscription`,
  },
];

export const FAQ_ITEMS = [
  // ── general ───────────────────────────────────────────────────────────────
  {
    category: "general",
    order: 1,
    question: "What is Macropage Connect?",
    answer:
      "Macropage Connect is a WhatsApp Business API platform for Indian businesses. It lets you manage all customer WhatsApp conversations in one inbox, send bulk campaigns using approved templates, set up automated replies, and collaborate as a team — all from one web portal.",
    tags: ["overview", "what is", "intro"],
  },
  {
    category: "general",
    order: 2,
    question:
      "Do I need a WhatsApp Business account to use Macropage Connect?",
    answer:
      "Yes. You need a WhatsApp Business Account (WABA) connected through Meta. During setup, Macropage Connect guides you through connecting your existing WABA or creating a new one. You will need a Facebook account and a Facebook Business Portfolio to complete this.",
    tags: ["whatsapp", "waba", "requirements"],
  },
  {
    category: "general",
    order: 3,
    question: "Is there a free trial?",
    answer:
      "Yes. Every new account gets a 14-day free trial with full Growth plan access. No credit card required to start. You can create templates, send campaigns, invite team members, and use all features during the trial.",
    tags: ["trial", "free", "start"],
  },
  {
    category: "general",
    order: 4,
    question: "Can I use my existing WhatsApp number?",
    answer:
      "Yes, if it is registered as a WhatsApp Business number. Note that once a number is connected to the WhatsApp Business API, it cannot be used simultaneously on the regular WhatsApp or WhatsApp Business app on a phone.",
    tags: ["number", "existing", "phone"],
  },
  {
    category: "general",
    order: 5,
    question: "How many team members can I add?",
    answer:
      "It depends on your plan. Starter allows 3 members, Growth allows 10, Business allows 25, and Enterprise has no limit. You can invite members from Settings → Team.",
    tags: ["team", "members", "limit"],
  },
  {
    category: "general",
    order: 6,
    question: "Is Macropage Connect available on mobile?",
    answer:
      "Macropage Connect is a web-based portal accessible from any browser including mobile browsers. A dedicated mobile app is on our roadmap.",
    tags: ["mobile", "app", "browser"],
  },

  // ── whatsapp ──────────────────────────────────────────────────────────────
  {
    category: "whatsapp",
    order: 1,
    question: "Why is my WhatsApp token expired?",
    answer:
      "WhatsApp access tokens expire every 60 days. When this happens, go to Settings → WhatsApp and click Reconnect. Complete the Facebook login flow to get a fresh token. This is done automatically in the background on a regular basis, but if it fails you will see a \"token expired\" banner.",
    tags: ["token", "expired", "reconnect"],
  },
  {
    category: "whatsapp",
    order: 2,
    question: "What is the 24-hour messaging window?",
    answer:
      "WhatsApp only allows free-form messages within 24 hours of the last message from a customer. After that window closes, you must use an approved template to re-open the conversation. The window resets every time the customer messages you.",
    tags: ["24 hours", "window", "free form", "template"],
  },
  {
    category: "whatsapp",
    order: 3,
    question: "Why are my messages not being delivered?",
    answer:
      "Common reasons: (1) WhatsApp token is expired — check Settings → WhatsApp. (2) The customer has blocked your number. (3) Your quality rating is RED. (4) You have reached your daily messaging limit for your tier. (5) The customer does not have WhatsApp.",
    tags: ["not delivered", "failed", "message", "error"],
  },
  {
    category: "whatsapp",
    order: 4,
    question: "What is quality rating and messaging tier?",
    answer:
      "Meta assigns your WhatsApp number a quality rating (GREEN, YELLOW, RED) based on how customers respond to your messages. Too many blocks or spam reports lower your rating. Your messaging tier (1K, 10K, 100K, Unlimited) controls how many unique customers you can message per day.",
    tags: ["quality", "rating", "tier", "limit"],
  },
  {
    category: "whatsapp",
    order: 5,
    question: "Why are inbound messages not showing in my inbox?",
    answer:
      "This usually means the webhook is not configured or the token is expired. First check Settings → WhatsApp to confirm your token is active. Then verify the webhook is set up in your Meta developer console under WhatsApp → Configuration.",
    tags: ["inbound", "receive", "webhook", "inbox"],
  },
  {
    category: "whatsapp",
    order: 6,
    question: "Can I see if a customer is online or their last seen?",
    answer:
      "No. The WhatsApp Business API does not provide customer online status, last seen, or typing indicators. This is a Meta privacy restriction. The portal shows \"last message received\" which is the last time the customer sent you a message.",
    tags: ["online", "last seen", "status", "typing"],
  },
  {
    category: "whatsapp",
    order: 7,
    question: "Can I send images, documents and audio?",
    answer:
      "Yes. You can send images, documents, audio, and video in the inbox chat within the 24-hour customer service window. For outbound campaigns, you can include media in template headers (image or document).",
    tags: ["image", "document", "audio", "media", "file"],
  },

  // ── campaigns ─────────────────────────────────────────────────────────────
  {
    category: "campaigns",
    order: 1,
    question: "Why can I not launch my campaign?",
    answer:
      "Campaign launching requires Owner, Admin, or Manager role. Agents can create campaign drafts but cannot launch them. Also check that you have selected an approved template and your audience has at least one contact.",
    tags: ["launch", "campaign", "permission", "role"],
  },
  {
    category: "campaigns",
    order: 2,
    question: "Can I schedule a campaign for later?",
    answer:
      "Yes. In Step 3 of the campaign wizard, select \"Schedule for later\" and pick a date and time. The campaign will automatically launch at the scheduled time. You can edit or cancel a scheduled campaign before it launches.",
    tags: ["schedule", "later", "campaign", "time"],
  },
  {
    category: "campaigns",
    order: 3,
    question: "Why did some messages in my campaign fail?",
    answer:
      "Common reasons: the contact does not have WhatsApp, the number is invalid, the customer has blocked your number, or your template was paused by Meta after the campaign started. Check the campaign detail page for per-contact error details.",
    tags: ["failed", "campaign", "error", "delivery"],
  },
  {
    category: "campaigns",
    order: 4,
    question: "How is campaign cost calculated?",
    answer:
      "Cost is estimated before launch based on Meta's India conversation rates: Marketing ₹0.83, Utility ₹0.15, Authentication ₹0.13 per conversation. The estimate is shown in Step 4 of the campaign wizard. Actual charges come from Meta directly to your WhatsApp Business account.",
    tags: ["cost", "price", "calculate", "estimate"],
  },
  {
    category: "campaigns",
    order: 5,
    question: "Can I pause a running campaign?",
    answer:
      "Yes. Go to Campaigns, find the running campaign, and click Pause. Messages that are already queued may still be sent. You can resume the campaign from the same page.",
    tags: ["pause", "stop", "campaign", "resume"],
  },
  {
    category: "campaigns",
    order: 6,
    question: "How do I send a campaign?",
    answer:
      "Go to Campaigns → New Campaign. Select an approved template, choose your audience (all contacts or by tag), optionally schedule it, review the cost estimate, then click Launch. Only Owners, Admins, and Managers can launch campaigns.",
    tags: ["send", "campaign", "how to", "launch", "broadcast"],
  },

  // ── templates ─────────────────────────────────────────────────────────────
  {
    category: "templates",
    order: 1,
    question: "How long does template approval take?",
    answer:
      "Meta typically approves templates within a few minutes to 24 hours. However if your Meta app is in Development mode, templates will never be reviewed — they stay PENDING forever. Make sure your app is in Live mode at developers.facebook.com.",
    tags: ["approval", "time", "pending", "how long"],
  },
  {
    category: "templates",
    order: 2,
    question: "Why was my template rejected?",
    answer:
      "Common reasons: (1) Promotional content in a Utility template — use the Marketing category instead. (2) Template name contains spaces or uppercase letters. (3) No clear business purpose. (4) Variable examples not provided. (5) Content violates Meta's commerce policy. Check the rejection reason and resubmit with corrections.",
    tags: ["rejected", "template", "reason", "fix"],
  },
  {
    category: "templates",
    order: 3,
    question: "Why is my template pending?",
    answer:
      "Templates stay pending when your Meta app is in Development mode — Meta never reviews templates in dev mode. Go to developers.facebook.com, select your app, and switch it to Live mode using the toggle in the top right. After switching to Live, resubmit your template.",
    tags: ["pending", "template", "dev mode", "live mode", "stuck"],
  },
  {
    category: "templates",
    order: 4,
    question: "Can I edit an approved template?",
    answer:
      "No. Once a template is approved by Meta it cannot be edited. You must create a new template with the changes and submit it for approval. The old approved template remains available while the new one is under review.",
    tags: ["edit", "change", "approved", "template"],
  },
  {
    category: "templates",
    order: 5,
    question: "What are template variables and how do I use them?",
    answer:
      "Variables are placeholders like {{1}}, {{2}} that get replaced with real values when sending. For example: \"Hello {{1}}, your order {{2}} is confirmed!\" When sending via campaign, these are mapped to contact fields like name, order ID etc. Always provide example values when submitting templates with variables.",
    tags: ["variables", "placeholder", "dynamic", "template"],
  },
  {
    category: "templates",
    order: 6,
    question: "Who can create and submit templates?",
    answer:
      "Owners, Admins, and Managers can create, edit, and submit templates to Meta. Agents can view templates but cannot create or submit them.",
    tags: ["permission", "role", "create", "template"],
  },

  // ── automation ────────────────────────────────────────────────────────────
  {
    category: "automation",
    order: 1,
    question: "What is the difference between Rules and Quick Replies?",
    answer:
      "Rules are fully automated — they watch for keywords in incoming messages and send replies automatically without any human involvement. Quick Replies are saved text snippets that agents manually insert into the chat input using / (slash command). Rules work 24/7 automatically; Quick Replies require an agent to be active.",
    tags: ["rules", "quick replies", "difference", "automation"],
  },
  {
    category: "automation",
    order: 2,
    question: "How many automation rules can I create?",
    answer:
      "Starter plan allows up to 5 custom rules. Growth, Business, and Enterprise plans allow unlimited custom rules. Built-in rules (greeting, away, outside hours) do not count toward your limit.",
    tags: ["rules", "limit", "how many", "plan"],
  },
  {
    category: "automation",
    order: 3,
    question: "Will automation rules fire even when an agent is chatting?",
    answer:
      "No. Once a human agent replies to a conversation, automation pauses for that specific conversation. This prevents the bot and agent from sending conflicting messages. The agent can manually re-enable the bot from within the conversation if needed.",
    tags: ["automation", "agent", "pause", "conflict"],
  },
  {
    category: "automation",
    order: 4,
    question: "What automation features does my plan include?",
    answer:
      "Starter: up to 5 custom rules only. Growth: unlimited rules + Conversation Flows. Business and Enterprise: all features including AI Bot. During your 14-day trial you get full Growth access (unlimited rules + flows).",
    tags: ["automation", "plan", "features", "flows", "ai"],
  },

  // ── billing ───────────────────────────────────────────────────────────────
  {
    category: "billing",
    order: 1,
    question: "How much does Macropage Connect cost?",
    answer:
      "Plans start at ₹999/month for Starter (3 members, 5,000 contacts). Growth is ₹2,499/month (10 members, 25,000 contacts). Business is ₹5,999/month (25 members, 1,00,000 contacts). Save 10% on quarterly or 20% on yearly billing. All new accounts get a 14-day free trial.",
    tags: ["price", "cost", "plan", "how much"],
  },
  {
    category: "billing",
    order: 2,
    question: "What payment methods are accepted?",
    answer:
      "All major credit cards, debit cards, UPI (GPay, PhonePe, Paytm), and net banking via Razorpay. All payments are in Indian Rupees (₹).",
    tags: ["payment", "upi", "card", "razorpay"],
  },
  {
    category: "billing",
    order: 3,
    question: "Can I cancel my subscription anytime?",
    answer:
      "Yes. Go to Settings → Billing → Cancel Subscription. You keep access until the end of your current billing period. We do not offer refunds for unused time.",
    tags: ["cancel", "subscription", "refund"],
  },
  {
    category: "billing",
    order: 4,
    question: "Can I upgrade or downgrade my plan?",
    answer:
      "Yes. Go to Settings → Billing or click Upgrade in the top navigation. Upgrades take effect immediately. Only the account Owner can change billing plans.",
    tags: ["upgrade", "downgrade", "change plan"],
  },
  {
    category: "billing",
    order: 5,
    question: "Does Macropage Connect charge for WhatsApp messages?",
    answer:
      "No. Macropage Connect does not charge per message. WhatsApp conversation charges are billed directly by Meta to your WhatsApp Business account separately. We only charge for the platform subscription.",
    tags: ["message cost", "meta charge", "per message"],
  },

  // ── account ───────────────────────────────────────────────────────────────
  {
    category: "account",
    order: 1,
    question: "How do I reset my password?",
    answer:
      "Click \"Forgot password\" on the login page. Enter your email address and we will send a reset link. The link expires in 1 hour.",
    tags: ["password", "reset", "forgot", "login"],
  },
  {
    category: "account",
    order: 2,
    question: "How do I change my email address?",
    answer:
      "Go to Settings → Profile → Edit Profile. Update your email address and save. A verification email will be sent to your new address.",
    tags: ["email", "change", "update", "profile"],
  },
  {
    category: "account",
    order: 3,
    question: "How do I delete my account?",
    answer:
      "Go to Settings → Profile → Danger Zone → Delete Account. This permanently deletes all your data. This action cannot be undone. Only the account Owner can delete the account.",
    tags: ["delete", "account", "permanent"],
  },
  {
    category: "account",
    order: 4,
    question: "Can multiple people use the same account?",
    answer:
      "Yes. That is the purpose of team management. Invite your colleagues from Settings → Team. Each person gets their own login with their own role and permissions. Do not share login credentials — use proper team invitations instead.",
    tags: ["multiple users", "share", "team", "login"],
  },

  // ── inbox ─────────────────────────────────────────────────────────────────
  {
    category: "inbox",
    order: 1,
    question: "Can multiple agents reply to the same conversation?",
    answer:
      "All agents with access can see the conversation, but it should be assigned to one agent at a time to avoid duplicate replies. Admins and Managers see all conversations. Agents only see conversations assigned to them.",
    tags: ["multiple agents", "assign", "duplicate"],
  },
  {
    category: "inbox",
    order: 2,
    question: "What are internal notes?",
    answer:
      "Internal notes are messages visible only to your team — customers cannot see them. Use notes to share context, handover instructions, or reminders with other agents. Switch to the Note tab in the chat input to add a note.",
    tags: ["notes", "internal", "private", "team"],
  },
  {
    category: "inbox",
    order: 3,
    question: "How do I start a conversation with a new customer?",
    answer:
      "Go to Contacts, find or add the customer, and click Message. This creates a new conversation in the inbox. Since it is a new conversation (no prior 24h window), you must use an approved template to send the first message.",
    tags: ["new conversation", "start", "contact", "first message"],
  },
  {
    category: "inbox",
    order: 4,
    question: "How do I invite team members?",
    answer:
      "Go to Settings → Team → Invite Member. Enter the email address, select a role (Agent, Manager, or Admin), and click Send Invite. They receive an email with a setup link that expires in 7 days.",
    tags: ["invite", "team", "member", "add"],
  },
  {
    category: "inbox",
    order: 5,
    question: "What does the bot toggle in a conversation do?",
    answer:
      "The bot toggle controls whether automation rules and flows are active for that specific conversation. When ON, the bot can auto-reply. When OFF, only human agents can reply. The bot automatically turns OFF when an agent manually replies to prevent conflicts.",
    tags: ["bot", "toggle", "automation", "conversation"],
  },
];
