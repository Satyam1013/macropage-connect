// Endpoints declare permissions as "resource:action" (e.g. "messages:send"),
// while API keys can be saved with the dashboard's wording (e.g. "send_messages"
// or "full_access"). Compare on the set of words so both spellings match, and
// let full_access satisfy everything.
const words = (permission: string): string =>
  permission
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .sort()
    .join(" ");

const FULL_ACCESS = words("full_access");

export function hasApiPermission(granted: string[], required: string): boolean {
  const needed = words(required);
  return granted.some((p) => {
    const have = words(p);
    return have === needed || have === FULL_ACCESS;
  });
}
