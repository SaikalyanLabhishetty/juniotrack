import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

function normalizePrivateKey(value: string) {
    return value.replace(/\\n/g, "\n");
}

function getFirebaseAdminApp() {
    if (getApps().length > 0) {
        return getApps()[0];
    }

    const projectId = process.env.FIREBASE_PROJECT_ID?.trim() || "";
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim() || "";
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim() || "";

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error(
            "Missing Firebase Admin environment variables. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.",
        );
    }

    return initializeApp({
        credential: cert({
            projectId,
            clientEmail,
            privateKey: normalizePrivateKey(privateKey),
        }),
    });
}

export function getFirebaseMessaging() {
    return getMessaging(getFirebaseAdminApp());
}
