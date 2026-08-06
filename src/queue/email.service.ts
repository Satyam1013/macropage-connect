import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private readonly logoUrl =
    "https://app.macropageconnect.com/assets/macropage-connect-black-Cnra6Tg0.svg";

  // Logo SVG's native viewBox is 616x180 — keep that aspect ratio at
  // whatever height each template needs.
  private logoImg(height: number, style = ""): string {
    const width = Math.round(height * (616 / 180));
    return `<img src="${this.logoUrl}" alt="Macropage Connect" width="${width}" height="${height}" style="display:inline-block;height:${height}px;width:${width}px;border:0;${style}" />`;
  }

  constructor(private readonly config: ConfigService) {}

  async sendRaw(to: string, subject: string, html: string): Promise<void> {
    const apiKey = this.config.get<string>("RESEND_API_KEY");
    if (!apiKey) {
      this.logger.warn(
        `Email skipped (RESEND_API_KEY not set) → ${to}: ${subject}`,
      );
      return;
    }
    const resend = new Resend(apiKey);
    const from =
      this.config.get<string>("EMAIL_FROM") ??
      "Macropage <noreply@macropage.in>";
    const { error } = await resend.emails.send({ from, to, subject, html });
    if (error) {
      this.logger.error(`Failed to send email to ${to}`, error);
      throw new Error(error.message);
    }
    this.logger.log(`Email sent → ${to}: ${subject}`);
  }

  async sendVerificationEmail(
    to: string,
    name: string,
    otp: string,
  ): Promise<void> {
    const digitBoxes = otp
      .split("")
      .map(
        (d) => `
        <td style="padding:0 6px;">
          <div style="width:56px;height:64px;line-height:64px;text-align:center;background:#ffffff;border-radius:10px;font-size:30px;font-weight:700;color:#111827;">${d}</div>
        </td>`,
      )
      .join("");

    const socialIcon = (label: string) => `
      <td style="padding:0 6px;">
        <span style="display:inline-block;width:32px;height:32px;line-height:32px;border-radius:50%;border:1px solid #d1fae5;color:#16a34a;font-size:13px;text-align:center;">${label}</span>
      </td>`;

    const html = `
    <div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;background:#ffffff;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:36px 40px 0;">
        <tr>
          <td>${this.logoImg(46)}</td>
          <td style="text-align:right;vertical-align:top;">
            <span style="display:inline-block;width:56px;height:56px;line-height:56px;border-radius:50%;background:#ecfdf5;font-size:26px;text-align:center;">✉️</span>
          </td>
        </tr>
      </table>

      <div style="padding:28px 40px 0;">
        <h1 style="font-size:34px;font-weight:800;margin:0 0 20px;color:#111827;">Verify your <span style="color:#16a34a;">email</span></h1>
        <p style="color:#374151;font-size:15px;margin:0 0 10px;">Hi <span style="color:#16a34a;">${name}</span>,</p>
        <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0;">Thanks for signing up with Macropage Connect.</p>
        <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:8px 0 0;">Use the OTP below to verify your email address and complete your registration.</p>
      </div>

      <div style="margin:28px 40px;background:#f3f4f6;border-radius:14px;padding:32px 16px;text-align:center;">
        <table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>${digitBoxes}</tr></table>
        <p style="font-size:14px;color:#4b5563;margin:20px 0 0;">🛡️ This OTP is valid for <span style="color:#16a34a;font-weight:700;">10 minutes</span>.</p>
      </div>

      <div style="margin:32px 40px 0;padding-top:24px;border-top:1px solid #f3f4f6;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="width:64px;vertical-align:top;">
            <span style="display:inline-block;width:52px;height:52px;line-height:52px;border-radius:50%;background:#ecfdf5;color:#16a34a;font-size:22px;text-align:center;">🔒</span>
          </td>
          <td style="vertical-align:middle;">
            <div style="font-size:16px;font-weight:700;color:#111827;margin-bottom:2px;">Secure &amp; Reliable</div>
            <div style="font-size:14px;color:#6b7280;line-height:1.6;">Macropage Connect keeps your account safe with industry-standard security.</div>
          </td>
        </tr></table>
      </div>

      <div style="margin:28px 40px;background:#ecfdf5;border-radius:14px;padding:24px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="width:72px;vertical-align:top;">
            <span style="display:inline-block;width:56px;height:56px;line-height:56px;border-radius:16px;background:#ffffff;font-size:24px;text-align:center;">💬</span>
          </td>
          <td style="vertical-align:top;">
            <p style="font-size:16px;font-weight:700;color:#111827;margin:0 0 8px;">Automate. Engage. Grow with Macropage Connect</p>
            <p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 16px;">Explore WhatsApp automation, team inbox, smart campaigns and more — all in one powerful platform.</p>
            <a href="${process.env.FRONTEND_URL}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:8px;">Explore Macropage Connect →</a>
          </td>
        </tr></table>
      </div>

      <div style="padding:24px 40px 36px;border-top:1px solid #f3f4f6;margin-top:8px;text-align:center;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="text-align:left;font-size:14px;">
            ${this.logoImg(26)}
            <span style="color:#d1d5db;"> &nbsp;|&nbsp; </span>
            <span style="color:#9ca3af;">This is an automated message, please don't reply.</span>
          </td>
        </tr></table>
        <table cellpadding="0" cellspacing="0" style="margin:20px auto 0;"><tr>
          ${socialIcon("in")}
          ${socialIcon("𝕏")}
          ${socialIcon("🌐")}
        </tr></table>
      </div>
    </div>`;

    await this.sendRaw(to, "Verify your email — Macropage Connect", html);
  }

  async sendPasswordResetEmail(
    to: string,
    name: string,
    token: string,
  ): Promise<void> {
    const link = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    await this.sendRaw(
      to,
      "Reset your Macropage Connect password",
      `<p>Hi ${name},</p><p>Click <a href="${link}">here</a> to reset your password. Link expires in 1 hour.</p>`,
    );
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    const feature = (icon: string, title: string, desc: string) => `
      <td style="padding:4px;text-align:center;width:20%;vertical-align:top;">
        <div style="width:56px;height:56px;line-height:56px;border-radius:50%;background:#ecfdf5;color:#16a34a;font-size:22px;margin:0 auto 12px;">${icon}</div>
        <div style="font-size:13px;font-weight:700;color:#111827;">${title}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:4px;line-height:1.4;">${desc}</div>
      </td>`;

    const step = (n: number, icon: string, title: string, desc: string) => `
      <td style="width:25%;padding:6px;vertical-align:top;">
        <div style="background:#f9fafb;border-radius:12px;padding:16px 14px;min-height:110px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:26px;vertical-align:top;">
              <span style="display:inline-block;width:24px;height:24px;line-height:24px;border-radius:50%;background:#16a34a;color:#fff;font-size:12px;font-weight:700;text-align:center;">${n}</span>
            </td>
            <td style="vertical-align:top;">
              <div style="font-size:13px;font-weight:700;color:#111827;line-height:1.3;">${title}</div>
            </td>
          </tr></table>
          <div style="font-size:16px;margin:10px 0 6px;">${icon}</div>
          <div style="font-size:11px;color:#6b7280;line-height:1.5;">${desc}</div>
        </div>
      </td>`;

    const socialIcon = (label: string) => `
      <td style="padding:0 6px;">
        <span style="display:inline-block;width:32px;height:32px;line-height:32px;border-radius:50%;border:1px solid #d1fae5;color:#16a34a;font-size:13px;text-align:center;">${label}</span>
      </td>`;

    const html = `
    <div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;background:#ffffff;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:36px 40px 0;">
        <tr>
          <td>${this.logoImg(46)}</td>
          <td style="text-align:right;vertical-align:top;font-size:12px;color:#9ca3af;padding-top:8px;">One Inbox. Endless Possibilities.</td>
        </tr>
      </table>

      <div style="padding:32px 40px 0;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:12px;font-weight:700;letter-spacing:1px;color:#16a34a;white-space:nowrap;">WELCOME ABOARD</td>
          <td style="border-top:1px solid #d1fae5;font-size:1px;line-height:1px;">&nbsp;</td>
        </tr></table>
        <h1 style="font-size:40px;font-weight:800;line-height:1.2;margin:16px 0 0;color:#111827;">Hello there,<br/><span style="color:#16a34a;">Welcome to Macropage Connect!</span></h1>
        <p style="color:#6b7280;font-size:16px;line-height:1.7;margin:16px 0 0;">We're thrilled to have you on board! 🎉 Your journey toward smarter customer conversations starts here.</p>
      </div>

      <div style="padding:28px 40px 0;">
        <p style="color:#111827;font-size:16px;font-weight:700;margin:0 0 12px;">Hi ${name},</p>
        <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0;">Welcome to Macropage Connect — your all-in-one WhatsApp Business messaging and marketing platform.</p>
        <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:12px 0 0;">You're now part of a growing community of businesses that trust us to automate, engage, and grow with WhatsApp. We're excited to help you build stronger customer relationships and achieve your business goals.</p>
      </div>

      <div style="margin:32px 40px;padding:16px 0;border-top:1px solid #f3f4f6;border-bottom:1px solid #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          ${feature("📢", "Bulk Campaigns", "Reach 1000s in seconds")}
          ${feature("📥", "Unified Team Inbox", "One inbox, one team")}
          ${feature("✨", "Smart Automation", "Save time, work smarter")}
          ${feature("📊", "Analytics & Reports", "Track. Measure. Grow.")}
          ${feature("🔗", "Powerful Integrations", "Connect with your favourite tools")}
        </tr></table>
      </div>

      <div style="margin:32px 40px 0;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13px;font-weight:700;letter-spacing:1px;color:#16a34a;white-space:nowrap;">YOUR NEXT STEPS</td>
          <td style="border-top:1px solid #d1fae5;font-size:1px;line-height:1px;">&nbsp;</td>
        </tr></table>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;"><tr>
          ${step(1, "👤", "Complete Your Profile", "Add your business details.")}
          ${step(2, "📱", "Connect Your WhatsApp Number", "Set up your WhatsApp Business API.")}
          ${step(3, "🧭", "Explore the Dashboard", "Get familiar with campaigns, templates and automation.")}
          ${step(4, "🚀", "Start Your First Campaign", "Engage your customers today!")}
        </tr></table>
      </div>

      <div style="margin:32px 40px;text-align:center;">
        <a href="${process.env.FRONTEND_URL}/dashboard" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:16px 36px;border-radius:10px;">Go to Your Dashboard →</a>
      </div>

      <div style="margin:0 40px 32px;background:#ecfdf5;border-radius:14px;padding:20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;">
            <div style="font-size:15px;font-weight:700;color:#065f46;">🎧 We're Here to Help!</div>
            <div style="color:#059669;font-size:13px;margin-top:4px;">Have questions? Our support team is always ready to assist you.</div>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <a href="mailto:support@macropageconnect.com" style="display:inline-block;border:1px solid #16a34a;color:#16a34a;text-decoration:none;font-size:13px;font-weight:600;padding:10px 18px;border-radius:8px;white-space:nowrap;">✉ Contact Support</a>
          </td>
        </tr></table>
      </div>

      <div style="padding:24px 40px 0;text-align:center;">
        <p style="font-size:14px;color:#4b5563;line-height:1.6;">Let's build better conversations, together. 💚<br/>— The Macropage Connect Team</p>
      </div>

      <div style="padding:20px 40px 36px;border-top:1px solid #f3f4f6;margin-top:16px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;">
            <div>${this.logoImg(28)}</div>
            <div style="font-size:10px;color:#9ca3af;letter-spacing:1px;margin-top:2px;">AUTOMATE · ENGAGE · GROW</div>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <table cellpadding="0" cellspacing="0" style="margin-left:auto;"><tr>
              ${socialIcon("in")}
              ${socialIcon("𝕏")}
              ${socialIcon("🌐")}
            </tr></table>
          </td>
        </tr></table>
        <p style="font-size:11px;color:#c1c7d0;text-align:center;margin-top:20px;">This is an automated email. Please do not reply.</p>
      </div>
    </div>`;

    await this.sendRaw(to, "Welcome to Macropage Connect! 🎉", html);
  }

  async sendNotificationEmail(
    to: string,
    title: string,
    body: string,
  ): Promise<void> {
    await this.sendRaw(to, title, `<p>${body}</p>`);
  }

  async sendInviteEmail(
    to: string,
    token: string,
    companyName: string,
    message?: string,
  ): Promise<void> {
    const link = `${process.env.FRONTEND_URL}/accept-invite?token=${token}`;
    const messageHtml = message
      ? `<p style="font-style:italic;color:#555;">"${message}"</p>`
      : "";
    await this.sendRaw(
      to,
      `You've been invited to ${companyName} on Macropage Connect`,
      `<p>You've been invited to join <strong>${companyName}</strong> on Macropage Connect.</p>${messageHtml}<p><a href="${link}">Accept Invitation</a></p>`,
    );
  }

  // ── Campaign lifecycle emails ─────────────────────────────────────────────
  // Table-based, inline-styled markup (no external images/CSS) so the
  // branded layout renders consistently across email clients.

  private statCard(
    icon: string,
    value: number,
    label: string,
    bg: string,
    widthPct: number,
    percent?: string,
  ): string {
    return `<td style="padding:6px;text-align:center;width:${widthPct}%;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;">
        <tr><td style="padding:18px 6px;text-align:center;">
          <div style="width:44px;height:44px;line-height:44px;border-radius:50%;background:${bg};color:#fff;font-size:18px;margin:0 auto 10px;">${icon}</div>
          <div style="font-size:20px;font-weight:700;color:#111827;">${value.toLocaleString("en-IN")}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:3px;line-height:1.3;">${label}</div>
          ${percent ? `<div style="font-size:11px;color:${bg};font-weight:600;margin-top:2px;">${percent}</div>` : ""}
        </td></tr>
      </table>
    </td>`;
  }

  private renderCampaignEmailShell(opts: {
    badgeIcon: string;
    badgeText: string;
    headingLines: { text: string; color?: string }[];
    greetingName: string;
    intro: string;
    infoIcon: string;
    infoLabel: string;
    infoTitle: string;
    infoRows: { icon: string; label: string; value: string }[];
    stats: {
      icon: string;
      value: number;
      label: string;
      bg: string;
      percent?: string;
    }[];
    ctaIcon: string;
    ctaTitle: string;
    ctaSubtitle: string;
    ctaButtonText: string;
    ctaHref: string;
  }): string {
    const infoRowsHtml = opts.infoRows
      .map(
        (r) => `
      <td style="padding:16px 12px;width:${Math.floor(100 / opts.infoRows.length)}%;vertical-align:top;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="width:36px;vertical-align:top;">
            <span style="display:inline-block;width:30px;height:30px;line-height:30px;border-radius:50%;background:#ecfdf5;color:#16a34a;font-size:14px;text-align:center;">${r.icon}</span>
          </td>
          <td style="vertical-align:top;">
            <div style="font-size:12px;font-weight:700;color:#111827;">${r.label}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:2px;">${r.value}</div>
          </td>
        </tr></table>
      </td>`,
      )
      .join("");

    const statWidth = Math.floor(100 / opts.stats.length);
    const statsHtml = opts.stats
      .map((s) =>
        this.statCard(s.icon, s.value, s.label, s.bg, statWidth, s.percent),
      )
      .join("");

    const headingHtml = opts.headingLines
      .map(
        (l) =>
          `<span style="${l.color ? `color:${l.color};` : ""}">${l.text}</span>`,
      )
      .join("<br/>");

    const socialIcon = (label: string) => `
      <td style="padding:0 6px;">
        <span style="display:inline-block;width:32px;height:32px;line-height:32px;border-radius:50%;border:1px solid #d1fae5;color:#16a34a;font-size:13px;text-align:center;">${label}</span>
      </td>`;

    return `
    <div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;background:#ffffff;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:36px 40px 0;">
        <tr>
          <td>${this.logoImg(46)}</td>
          <td style="text-align:right;vertical-align:top;font-size:12px;color:#9ca3af;padding-top:10px;">One Inbox. Endless Possibilities.</td>
        </tr>
      </table>

      <div style="padding:28px 40px 0;">
        <span style="display:inline-block;background:#ecfdf5;border:1px solid #d1fae5;color:#059669;font-size:12px;font-weight:700;letter-spacing:0.3px;padding:8px 16px;border-radius:20px;">${opts.badgeIcon} ${opts.badgeText}</span>
        <h1 style="font-size:32px;font-weight:800;line-height:1.25;margin:16px 0 0;color:#111827;">${headingHtml}</h1>
        <p style="color:#111827;font-size:15px;font-weight:700;margin:20px 0 8px;">Hi ${opts.greetingName},</p>
        <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:0;">${opts.intro}</p>
      </div>

      <div style="margin:28px 40px;background:#f9fafb;border-radius:14px;padding:20px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="width:56px;vertical-align:top;">
            <span style="display:inline-block;width:48px;height:48px;line-height:48px;border-radius:50%;background:#d1fae5;color:#16a34a;font-size:20px;text-align:center;">${opts.infoIcon}</span>
          </td>
          <td style="vertical-align:middle;">
            <div style="font-size:12px;color:#6b7280;">${opts.infoLabel}</div>
            <div style="font-size:16px;font-weight:700;color:#111827;margin-top:2px;">${opts.infoTitle}</div>
          </td>
        </tr></table>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border-top:1px solid #e5e7eb;"><tr>${infoRowsHtml}</tr></table>
      </div>

      <div style="margin:32px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align:center;">
          <span style="font-size:15px;font-weight:700;color:#111827;">Campaign Summary</span><br/>
          <span style="display:inline-block;width:56px;border-top:2px solid #16a34a;margin-top:8px;">&nbsp;</span>
        </td></tr></table>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;"><tr>${statsHtml}</tr></table>
      </div>

      <div style="margin:0 40px 32px;background:#ecfdf5;border-radius:14px;padding:20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="width:56px;vertical-align:middle;">
            <span style="display:inline-block;width:44px;height:44px;line-height:44px;border-radius:12px;background:#ffffff;font-size:18px;text-align:center;">${opts.ctaIcon}</span>
          </td>
          <td style="vertical-align:middle;">
            <div style="font-size:14px;font-weight:700;color:#065f46;">${opts.ctaTitle}</div>
            <div style="color:#059669;font-size:13px;margin-top:2px;">${opts.ctaSubtitle}</div>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <a href="${opts.ctaHref}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:12px 20px;border-radius:8px;white-space:nowrap;">${opts.ctaButtonText} →</a>
          </td>
        </tr></table>
      </div>

      <div style="padding:20px 40px;border-top:1px solid #f3f4f6;">
        <table width="100%"><tr>
          <td style="font-size:13px;color:#4b5563;">🎧 Need help? Our support team is here for you.</td>
          <td style="text-align:right;font-size:13px;"><a href="mailto:support@macropageconnect.com" style="color:#16a34a;">support@macropageconnect.com</a></td>
        </tr></table>
      </div>

      <div style="padding:20px 40px 36px;border-top:1px solid #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;">
            ${this.logoImg(28)}
            <div style="font-size:11px;color:#9ca3af;margin-top:6px;">Empower conversations.<br/>Drive growth.</div>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <table cellpadding="0" cellspacing="0" style="margin-left:auto;"><tr>
              ${socialIcon("in")}
              ${socialIcon("𝕏")}
              ${socialIcon("🌐")}
            </tr></table>
          </td>
        </tr></table>
      </div>
    </div>`;
  }

  async sendCampaignScheduledEmail(
    to: string,
    data: {
      ownerName: string;
      campaignName: string;
      scheduledFor: Date;
      audienceType: string;
      totalContacts: number;
    },
  ): Promise<void> {
    const when = data.scheduledFor.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    const html = this.renderCampaignEmailShell({
      badgeIcon: "📨",
      badgeText: "CAMPAIGN SCHEDULED",
      headingLines: [
        { text: "Your WhatsApp" },
        { text: "campaign has been" },
        { text: "scheduled!", color: "#16a34a" },
      ],
      greetingName: data.ownerName,
      intro:
        "Great news! Your WhatsApp campaign has been successfully scheduled and will be sent at the time you selected. Here are the campaign details and current status.",
      infoIcon: "✉️",
      infoLabel: "Campaign Name",
      infoTitle: data.campaignName,
      infoRows: [
        { icon: "📅", label: "Scheduled For", value: when },
        {
          icon: "👥",
          label: "Audience",
          value: `${data.audienceType} · ${data.totalContacts.toLocaleString("en-IN")}`,
        },
        { icon: "📨", label: "Campaign Type", value: "WhatsApp Campaign" },
      ],
      stats: [
        {
          icon: "✈",
          value: data.totalContacts,
          label: "Total Recipients",
          bg: "#111827",
        },
        {
          icon: "✓",
          value: data.totalContacts,
          label: "Scheduled",
          bg: "#16a34a",
        },
        { icon: "✉", value: 0, label: "Sent", bg: "#2563eb" },
        { icon: "!", value: 0, label: "Failed", bg: "#dc2626" },
        {
          icon: "–",
          value: data.totalContacts,
          label: "Pending",
          bg: "#6b7280",
        },
      ],
      ctaIcon: "📊",
      ctaTitle: "Track detailed performance",
      ctaSubtitle: "Monitor delivery, reads and replies in real-time.",
      ctaButtonText: "View Campaign Insights",
      ctaHref: `${process.env.FRONTEND_URL}/campaigns`,
    });

    await this.sendRaw(
      to,
      `Your campaign "${data.campaignName}" has been scheduled 📨`,
      html,
    );
  }

  async sendCampaignSummaryEmail(
    to: string,
    data: {
      ownerName: string;
      campaignName: string;
      sentAt: Date;
      templateName: string;
      audienceType: string;
      totalContacts: number;
      delivered: number;
      read: number;
      replied: number;
      failed: number;
      pending: number;
    },
  ): Promise<void> {
    const when = data.sentAt.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    const pct = (n: number) =>
      data.totalContacts > 0
        ? `${((n / data.totalContacts) * 100).toFixed(1)}%`
        : "0.0%";

    const html = this.renderCampaignEmailShell({
      badgeIcon: "✅",
      badgeText: "WHATSAPP CAMPAIGN SUCCESSFUL",
      headingLines: [
        { text: "Your WhatsApp" },
        { text: "campaign was sent" },
        { text: "successfully!", color: "#16a34a" },
      ],
      greetingName: data.ownerName,
      intro:
        "Great news! Your WhatsApp campaign has been sent successfully and has reached your audience. Here's a quick summary of how it performed.",
      infoIcon: "✉️",
      infoLabel: "Campaign Name",
      infoTitle: data.campaignName,
      infoRows: [
        { icon: "📅", label: "Sent On", value: when },
        {
          icon: "👥",
          label: "Audience",
          value: `${data.audienceType} · ${data.totalContacts.toLocaleString("en-IN")}`,
        },
        { icon: "📄", label: "Message Template", value: data.templateName },
        { icon: "📨", label: "Campaign Type", value: "WhatsApp Campaign" },
      ],
      stats: [
        {
          icon: "✈",
          value: data.totalContacts,
          label: "Total Recipients",
          bg: "#111827",
        },
        {
          icon: "✓",
          value: data.delivered,
          label: "Delivered",
          bg: "#16a34a",
          percent: pct(data.delivered),
        },
        {
          icon: "✓✓",
          value: data.read,
          label: "Read",
          bg: "#2563eb",
          percent: pct(data.read),
        },
        {
          icon: "↩",
          value: data.replied,
          label: "Replied",
          bg: "#2563eb",
          percent: pct(data.replied),
        },
        {
          icon: "!",
          value: data.failed,
          label: "Failed",
          bg: "#dc2626",
          percent: pct(data.failed),
        },
        {
          icon: "–",
          value: data.pending,
          label: "Pending",
          bg: "#6b7280",
          percent: pct(data.pending),
        },
      ],
      ctaIcon: "📊",
      ctaTitle: "Great job! Your campaign is performing well.",
      ctaSubtitle: "Keep engaging your audience and drive even better results.",
      ctaButtonText: "View Campaign Insights",
      ctaHref: `${process.env.FRONTEND_URL}/campaigns`,
    });

    await this.sendRaw(
      to,
      `Your campaign "${data.campaignName}" was sent successfully ✅`,
      html,
    );
  }

  // ── Team lifecycle emails ─────────────────────────────────────────────────

  async sendTeamMemberJoinedEmail(
    to: string,
    data: {
      employeeName: string;
      jobTitle: string;
      department: string;
      location: string;
      joinDate: Date;
      email: string;
    },
  ): Promise<void> {
    const joinDate = data.joinDate.toLocaleDateString("en-IN", {
      dateStyle: "medium",
    });

    const infoField = (icon: string, label: string, value: string) => `
      <td style="padding:14px 12px;width:25%;vertical-align:top;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="width:26px;vertical-align:top;font-size:15px;">${icon}</td>
          <td style="vertical-align:top;">
            <div style="font-size:12px;font-weight:700;color:#111827;">${label}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:2px;">${value}</div>
          </td>
        </tr></table>
      </td>`;

    const feature = (icon: string, title: string, desc: string) => `
      <td style="padding:6px;text-align:center;width:25%;vertical-align:top;">
        <div style="width:52px;height:52px;line-height:52px;border-radius:50%;background:#ecfdf5;color:#16a34a;font-size:22px;margin:0 auto 12px;">${icon}</div>
        <div style="font-size:14px;font-weight:700;color:#111827;">${title}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px;line-height:1.4;">${desc}</div>
      </td>`;

    const socialIcon = (label: string) => `
      <td style="padding:0 6px;">
        <span style="display:inline-block;width:32px;height:32px;line-height:32px;border-radius:50%;border:1px solid #d1fae5;color:#16a34a;font-size:13px;text-align:center;">${label}</span>
      </td>`;

    const html = `
    <div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;background:#ffffff;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:36px 40px 0;">
        <tr>
          <td>${this.logoImg(46)}</td>
          <td style="text-align:right;vertical-align:top;">
            <span style="display:inline-block;width:48px;height:48px;line-height:48px;border-radius:50%;background:#ecfdf5;color:#16a34a;font-size:20px;text-align:center;">👥</span>
          </td>
        </tr>
      </table>

      <div style="padding:28px 40px 0;">
        <div style="font-size:12px;font-weight:700;letter-spacing:1px;color:#16a34a;">NEW TEAM MEMBER JOINED</div>
        <h1 style="font-size:32px;font-weight:800;line-height:1.25;margin:14px 0 0;color:#111827;">Great news!<br/>A new team member<br/><span style="color:#16a34a;">has joined your team.</span></h1>
        <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:16px 0 0;">A new team member has been added to your Macropage Connect workspace and they are ready to contribute.</p>
        <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:8px 0 0;">Let's build amazing customer experiences together! 🎉</p>
      </div>

      <div style="margin:28px 40px;background:#f9fafb;border-radius:14px;padding:20px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="width:56px;vertical-align:top;">
            <span style="display:inline-block;width:48px;height:48px;line-height:48px;border-radius:50%;background:#d1fae5;text-align:center;font-size:22px;">🙂</span>
          </td>
          <td style="vertical-align:middle;">
            <div style="font-size:17px;font-weight:700;color:#16a34a;">${data.employeeName}</div>
            <div style="font-size:13px;color:#6b7280;margin-top:2px;">${data.jobTitle}</div>
          </td>
        </tr></table>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;border-top:1px solid #e5e7eb;"><tr>
          ${infoField("🏢", "Department", data.department)}
          ${infoField("📍", "Location", data.location)}
          ${infoField("📅", "Date Joined", joinDate)}
          ${infoField("✉️", "Email", data.email)}
        </tr></table>
      </div>

      <div style="margin:32px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align:center;">
          <span style="font-size:15px;font-weight:700;color:#111827;">They can now</span><br/>
          <span style="display:inline-block;width:48px;border-top:2px solid #16a34a;margin-top:8px;">&nbsp;</span>
        </td></tr></table>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;"><tr>
          ${feature("💬", "Collaborate", "Work together in the shared team inbox.")}
          ${feature("📤", "Engage", "Create and manage campaigns.")}
          ${feature("⚙️", "Automate", "Use automation to save time and effort.")}
          ${feature("📊", "Analyze", "Track performance and gain valuable insights.")}
        </tr></table>
      </div>

      <div style="margin:0 40px 32px;background:#ecfdf5;border-radius:14px;padding:20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="width:56px;vertical-align:middle;">
            <span style="display:inline-block;width:44px;height:44px;line-height:44px;border-radius:12px;background:#ffffff;font-size:20px;text-align:center;">🎁</span>
          </td>
          <td style="vertical-align:middle;">
            <div style="font-size:14px;font-weight:700;color:#065f46;">Stronger team, better conversations.</div>
            <div style="color:#059669;font-size:13px;margin-top:2px;">We're excited to see what you'll achieve together!</div>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <a href="${process.env.FRONTEND_URL}/team" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:12px 20px;border-radius:8px;white-space:nowrap;">Go to Dashboard →</a>
          </td>
        </tr></table>
      </div>

      <div style="padding:20px 40px;border-top:1px solid #f3f4f6;">
        <table width="100%"><tr>
          <td style="font-size:13px;color:#4b5563;">🎧 Need help? Our support team is here for you.</td>
          <td style="text-align:right;font-size:13px;"><a href="mailto:support@macropageconnect.com" style="color:#16a34a;">support@macropageconnect.com</a></td>
        </tr></table>
      </div>

      <div style="padding:20px 40px 36px;border-top:1px solid #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;">
            ${this.logoImg(28)}
            <div style="font-size:11px;color:#9ca3af;margin-top:6px;">One inbox. Endless possibilities.</div>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <table cellpadding="0" cellspacing="0" style="margin-left:auto;"><tr>
              ${socialIcon("in")}
              ${socialIcon("𝕏")}
              ${socialIcon("🌐")}
            </tr></table>
          </td>
        </tr></table>
      </div>
    </div>`;

    await this.sendRaw(
      to,
      `${data.employeeName} joined your Macropage Connect team 🎉`,
      html,
    );
  }
}
