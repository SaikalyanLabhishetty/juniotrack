export const ACCESS_TOKEN_STORAGE_KEY = "access_token";
export const ADD_SCHOOL_ROUTE_INTENT_KEY = "add_school_route_intent";

export type AccessTokenPayload = {
    email: string;
    uid: string;
    schoolId?: string;
    exp: number;
};

export function getStoredAccessToken() {
    if (typeof window === "undefined") {
        return "";
    }

    return localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)?.trim() || "";
}

function decodeBase64Url(value: string) {
    if (typeof window === "undefined") {
        return "";
    }

    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded =
        normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

    return window.atob(padded);
}

export function decodeAccessTokenPayload(
    token: string,
): AccessTokenPayload | null {
    const normalizedToken = token.trim();

    if (!normalizedToken) {
        return null;
    }

    const dotIndex = normalizedToken.indexOf(".");

    if (dotIndex === -1) {
        return null;
    }

    const encodedPayload = normalizedToken.slice(0, dotIndex);

    try {
        const payload = JSON.parse(
            decodeBase64Url(encodedPayload),
        ) as AccessTokenPayload;

        if (!payload?.uid || !payload?.email || !payload?.exp) {
            return null;
        }

        if (payload.schoolId && typeof payload.schoolId !== "string") {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
}

export function getStoredAccessTokenPayload() {
    return decodeAccessTokenPayload(getStoredAccessToken());
}

export function getAuthorizationHeader() {
    const token = getStoredAccessToken();

    if (!token) {
        return {} as Record<string, string>;
    }

    return {
        Authorization: `Bearer ${token}`,
    };
}
