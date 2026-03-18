import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const SCRYPT_KEY_LENGTH = 64;

function parseExpiresIn(value: string | undefined): number {
  if (!value) return 60 * 60 * 24 * 7; // default 7 days

  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) return 60 * 60 * 24 * 7;

  const num = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "s": return num;
    case "m": return num * 60;
    case "h": return num * 60 * 60;
    case "d": return num * 60 * 60 * 24;
    default: return 60 * 60 * 24 * 7;
  }
}

const ACCESS_TOKEN_TTL_SECONDS = parseExpiresIn(process.env.JWT_EXPIRES_IN);

function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  if (process.env.NODE_ENV !== "production") {
    return "development-jwt-secret";
  }

  throw new Error("Missing JWT_SECRET in environment.");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString("hex");

  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, savedHash] = storedHash.split(":");

  if (!salt || !savedHash) {
    return false;
  }

  const derivedHash = scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  const savedHashBuffer = Buffer.from(savedHash, "hex");

  if (savedHashBuffer.length !== derivedHash.length) {
    return false;
  }

  return timingSafeEqual(savedHashBuffer, derivedHash);
}

export function createAccessToken(payload: {
  email: string;
  uid: string;
  schoolId?: string;
}) {
  const expiresAt = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS;
  const normalizedSchoolId = payload.schoolId?.trim() || "";
  const tokenPayload: {
    email: string;
    exp: number;
    uid: string;
    schoolId?: string;
  } = {
    email: payload.email,
    exp: expiresAt,
    uid: payload.uid,
  };

  if (normalizedSchoolId) {
    tokenPayload.schoolId = normalizedSchoolId;
  }

  const encodedPayload = Buffer.from(
    JSON.stringify(tokenPayload),
  ).toString("base64url");

  const signature = createHmac("sha256", getJwtSecret())
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

export { ACCESS_TOKEN_TTL_SECONDS };
