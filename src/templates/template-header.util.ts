const MEDIA_HEADER_FORMATS = ["IMAGE", "VIDEO", "DOCUMENT"];

type HeaderLike = {
  format?: unknown;
  type?: unknown;
  mediaUrl?: unknown;
  link?: unknown;
  url?: unknown;
  example?: { header_handle?: unknown };
};

const asUrl = (value: unknown): string | undefined =>
  typeof value === "string" && /^https?:\/\//.test(value) ? value : undefined;

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
 * The link comes from the request, else the media saved on the template,
 * else the sample URL Meta returns on sync (a last resort: those can expire).
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

  const samples = tpl?.example?.header_handle;
  const sample = Array.isArray(samples) ? asUrl(samples[0]) : undefined;
  return { format, link: directLink(req) ?? directLink(tpl) ?? sample };
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
