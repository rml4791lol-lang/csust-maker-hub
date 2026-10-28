import { constants, chmodSync, existsSync, lstatSync, mkdirSync, openSync, closeSync, readFileSync, writeFileSync, linkSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { execFileSync } from "node:child_process";

type LocalAccount = { version: 1; username: string; salt: string; passwordHash: string; sessionSecret: string };
export function usesEnvironmentAccount() { return Boolean(process.env.ADMIN_USER || process.env.ADMIN_PASSWORD); }
export function localAccountPath() {
  // Runtime-only credentials: do not trace the configured data directory into bundles.
  const directory = resolve(/* turbopackIgnore: true */ process.env.AI_ASSOCIATION_DATA_DIR || join(process.cwd(), "data"));
  return join(/* turbopackIgnore: true */ directory, "admin-auth", "account.json");
}
export function localAccountExists() { return existsSync(localAccountPath()); }
export function readLocalAccount(): LocalAccount | null {
  if (usesEnvironmentAccount()) return null;
  try {
    const file = localAccountPath();
    if (!lstatSync(file).isFile() || lstatSync(file).isSymbolicLink()) return null;
    const account = JSON.parse(readFileSync(/* turbopackIgnore: true */ file, "utf8")) as LocalAccount;
    return account.version === 1 && typeof account.username === "string" && account.username.length > 0
      && /^[a-f0-9]{32}$/.test(account.salt) && /^[a-f0-9]{128}$/.test(account.passwordHash)
      && /^[a-f0-9]{64}$/.test(account.sessionSecret) ? account : null;
  } catch { return null; }
}
function hashPassword(password: string, salt: string) {
  return new Promise<Buffer>((resolveHash, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, hash) => error ? reject(error) : resolveHash(hash));
  });
}
export async function verifyLocalAccount(account: LocalAccount, username: string, password: string) {
  const hash = await hashPassword(password, account.salt);
  return timingSafeEqual(hash, Buffer.from(account.passwordHash, "hex")) && username === account.username;
}
export function validateNewAccount(username: unknown, password: unknown): string | null {
  if (typeof username !== "string" || !/^[A-Za-z0-9_.@-]{3,64}$/.test(username)) return "账号请使用 3–64 位字母、数字或 _ . @ -";
  if (typeof password !== "string" || password.length < 12 || password.length > 256) return "密码请使用 12–256 个字符";
  return null;
}
function restrictDirectory(directory: string) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (lstatSync(directory).isSymbolicLink()) throw new Error("Authentication directory must not be a symlink");
  if (process.platform === "win32") {
    const identity = execFileSync("whoami.exe", [], { encoding: "utf8", windowsHide: true }).trim();
    execFileSync("icacls.exe", [directory, "/inheritance:r", "/grant:r", `${identity}:(OI)(CI)F`], { stdio: "pipe", windowsHide: true });
  } else chmodSync(directory, 0o700);
}
/** Only the explicitly enabled loopback setup helper calls this function. */
export async function createLocalAccount(username: string, password: string) {
  if (process.env.AI_ASSOCIATION_ALLOW_LOCAL_SETUP !== "1" || usesEnvironmentAccount() || localAccountExists()) throw new Error("Account setup unavailable");
  const invalid = validateNewAccount(username, password);
  if (invalid) throw new Error(invalid);
  const salt = randomBytes(16).toString("hex");
  const account: LocalAccount = { version: 1, username, salt, passwordHash: (await hashPassword(password, salt)).toString("hex"), sessionSecret: randomBytes(32).toString("hex") };
  const target = localAccountPath();
  restrictDirectory(dirname(target));
  const temporary = `${target}.${randomBytes(12).toString("hex")}.tmp`;
  const fd = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
  try { writeFileSync(fd, JSON.stringify(account), "utf8"); } finally { closeSync(fd); }
  try {
    // Hard-link publishes a complete file atomically and never overwrites an existing account.
    linkSync(temporary, target);
  } finally { unlinkSync(temporary); }
}
