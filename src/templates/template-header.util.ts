const MEDIA_HEADER_FORMATS = ["IMAGE", "VIDEO", "DOCUMENT"];

type HeaderLike = {
  format?: unknown;
  type?: unknown;
  mediaUrl?: unknown;
  link?: unknown;
  url?: unknown;
};

// Meta's own CDNs serve the template's review sample through signed,
// expiring URLs — Meta itself later refuses to fetch them (403).
const META_SAMPLE_HOST = /(^|\.)(whatsapp\.net|fbcdn\.net|fbsbx\.com)$/i;

function asUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^https?:\/\//.test(value)) return;
  try {
    if (META_SAMPLE_HOST.test(new URL(value).hostname)) return;
  } catch {
    return;
  }
  return value;
}

const directLink = (h?: HeaderLike) =>
  asUrl(h?.mediaUrl) ?? asUrl(h?.link) ?? asUrl(h?.url);

function mediaFormat(value: unknown): string | undefined {
  const format = typeof value === "string" ? value.toUpperCase() : undefined;
  return format && MEDIA_HEADER_FORMATS.includes(format) ? format : undefined;
}

/**
 * Works out a media-header template's format and link for one send. WhatsApp
 * fixes the format at registration but wants the media supplied per message;
 * leaving it out is what causes #132012 "Parameter format does not match".
 *
 * The link comes from the request, else the media saved on the template.
 * Meta's own review sample — whether read from the template or echoed back
 * by a client that shows it as the preview — (example.header_handle, a signed
 * scontent.whatsapp.net URL) is deliberately NOT used: it expires, and Meta
 * then refuses to fetch it (#131053 "Downloading media from weblink failed
 * with http code 403") — after the API has already accepted the send. With
 * no link the caller rejects up front instead.
 * `type` may hold the component's type ("HEADER") rather than a format, so
 * only a real media format counts.
 */
export function resolveHeaderMedia(
  input: Record<string, unknown> | undefined,
  stored: Record<string, unknown> | undefined,
): { format?: string; link?: string } {
  const req = input as HeaderLike | undefined;
  const tpl = stored as HeaderLike | undefined;
  const format =
    mediaFormat(req?.format) ??
    mediaFormat(req?.type) ??
    mediaFormat(tpl?.format);
  if (!format) return {};

  return { format, link: directLink(req) ?? directLink(tpl) };
}

/** The Cloud API `header` component, or null when there's nothing to send. */
export function headerComponent(media: {
  format?: string;
  link?: string;
}): Record<string, unknown> | null {
  if (!media.format || !media.link) return null;
  const key = media.format.toLowerCase();
  return {
    type: "header",
    parameters: [{ type: key, [key]: { link: media.link } }],
  };
}

/**
 * Meta's copy of a header has no `mediaUrl`, so a sync must carry ours over
 * or later sends lose the link.
 */
export function mergeSyncedHeader(
  synced: Record<string, unknown>,
  existing: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const link = directLink(existing);
  return link ? { ...synced, mediaUrl: link } : synced;
}

/** Sort key for a variable named "1" or "{{1}}". */
export function templateVarIndex(key: string): number {
  return Number(key.replace(/\D/g, ""));
}
