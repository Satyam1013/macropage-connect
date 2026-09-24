import axios from "axios";

const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

// EMAIL_FROM is stored as `Name <address>` (or a bare address); Brevo wants
// the name and address as separate fields.
function parseSender(from: string): { name?: string; email: string } {
  const match = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (!match) return { email: from.trim() };
  const name = match[1].replace(/^"|"$/g, "");
  const email = match[2].trim();
  return name ? { name, email } : { email };
}

export async function sendViaBrevo(
  apiKey: string,
  mail: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text?: string;
  },
): Promise<string | undefined> {
  try {
    const resp = await axios.post<{ messageId?: string }>(
      BREVO_SEND_URL,
      {
        sender: parseSender(mail.from),
        to: [{ email: mail.to }],
        subject: mail.subject,
        htmlContent: mail.html,
        ...(mail.text && { textContent: mail.text }),
      },
      {
        headers: {
          "api-key": apiKey,
          accept: "application/json",
          "content-type": "application/json",
        },
      },
    );
    return resp.data.messageId;
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? ((err.response?.data as { message?: string } | undefined)?.message ??
        err.message)
      : err instanceof Error
        ? err.message
        : String(err);
    throw new Error(`Brevo send failed: ${detail}`);
  }
}
