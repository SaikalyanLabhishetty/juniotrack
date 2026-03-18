import { createHmac } from "node:crypto";

type AccessTokenPayload = {
    email: string;
    uid: string;
    schoolId?: string;
    exp: number;
};

function getJwtSecret() {
    if (process.env.JWT_SECRET) {
        return process.env.JWT_SECRET;
    }

    if (process.env.NODE_ENV !== "production") {
        return "development-jwt-secret";
    }

    throw new Error("Missing JWT_SECRET in environment.");
}

function getTokenFromAuthorizationHeader(authorizationHeader: string | null) {
    if (!authorizationHeader) {
        return "";
    }

    const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2);

    if (scheme?.toLowerCase() !== "bearer") {
        return "";
    }

    return token?.trim() || "";
}

function validateAccessToken(token: string): AccessTokenPayload | null {
    if (!token) {
        return null;
    }

    const dotIndex = token.indexOf(".");

    if (dotIndex === -1) {
        return null;
    }

    const encodedPayload = token.slice(0, dotIndex);
    const signature = token.slice(dotIndex + 1);

    const expectedSignature = createHmac("sha256", getJwtSecret())
        .update(encodedPayload)
        .digest("base64url");

    if (signature !== expectedSignature) {
        return null;
    }

    try {
        const payload = JSON.parse(
            Buffer.from(encodedPayload, "base64url").toString("utf8"),
        ) as AccessTokenPayload;

        if (payload.schoolId && typeof payload.schoolId !== "string") {
            return null;
        }

        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
}

export async function verifyAccessToken(
    request?: Pick<Request, "headers">,
): Promise<AccessTokenPayload | null> {
    const authorizationHeader = request?.headers.get("authorization") || null;
    const tokenFromHeader = getTokenFromAuthorizationHeader(authorizationHeader);

    return validateAccessToken(tokenFromHeader);
}
