export const csvEscape = (value: string) =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

export const csvUnescape = (value: string) =>
  value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1).replace(/""/g, '"')
    : value;

export const USERS_FILE = `${import.meta.dir}/users.csv`;

export async function loadUsers(): Promise<Map<string, string>> {
  const users = new Map<string, string>();
  let raw: string;
  try {
    raw = await Bun.file(USERS_FILE).text();
  } catch {
    return users;
  }
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const comma = line.indexOf(",");
    if (comma === -1) continue;
    users.set(csvUnescape(line.slice(0, comma)), line.slice(comma + 1));
  }
  return users;
}

export async function appendUser(username: string, hash: string) {
  const existing = await Bun.file(USERS_FILE).text().catch(() => "");
  const prefix = existing.length > 0 && !existing.endsWith("\n") ? existing + "\n" : existing;
  await Bun.write(USERS_FILE, `${prefix}${csvEscape(username)},${hash}\n`);
}
