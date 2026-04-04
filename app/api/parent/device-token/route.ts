import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { buildSchoolScopeQuery, resolveSchoolId } from "@/lib/organization-school";
import { getDatabase } from "@/lib/mongodb";
import { verifyAccessToken } from "@/lib/verify-access-token";

type DeviceTokenDocument = {
    uid: string;
    userUid: string;
    role: "parent";
    organizationId: string;
    schoolId: string;
    token: string;
    platform: "android" | "ios";
    appName: "parent-mobile";
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    lastUsedAt: string;
};

type DeviceTokenPayload = {
    token?: string;
    platform?: string;
};

const DEVICE_TOKENS_COLLECTION = "device_tokens";

function normalizeString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizePlatform(value: unknown): "android" | "ios" | "" {
    const platform = normalizeString(value).toLowerCase();

    if (platform === "android" || platform === "ios") {
        return platform;
    }

    return "";
}

export async function POST(request: Request) {
    try {
        const tokenPayload = await verifyAccessToken(request);

        if (!tokenPayload) {
            return NextResponse.json(
                { message: "Unauthorized. Please login again." },
                { status: 401 },
            );
        }

        if (tokenPayload.role !== "parent" || !normalizeString(tokenPayload.userUid)) {
            return NextResponse.json(
                { message: "Parent access required." },
                { status: 403 },
            );
        }

        let payload: DeviceTokenPayload;

        try {
            payload = (await request.json()) as DeviceTokenPayload;
        } catch {
            return NextResponse.json(
                { message: "Invalid JSON payload." },
                { status: 400 },
            );
        }

        const token = normalizeString(payload.token);
        const platform = normalizePlatform(payload.platform);
        const fieldErrors: Record<string, string> = {};

        if (!token) {
            fieldErrors.token = "token is required.";
        }

        if (!platform) {
            fieldErrors.platform = "platform must be android or ios.";
        }

        if (Object.keys(fieldErrors).length > 0) {
            return NextResponse.json(
                { message: "Validation failed.", fieldErrors },
                { status: 400 },
            );
        }

        const normalizedPlatform = platform as "android" | "ios";

        const database = await getDatabase();
        const schoolId = await resolveSchoolId(
            database,
            tokenPayload.uid,
            tokenPayload.schoolId,
        );

        if (!schoolId) {
            return NextResponse.json(
                { message: "No school found for this organization." },
                { status: 404 },
            );
        }

        const collection = database.collection<DeviceTokenDocument>(
            DEVICE_TOKENS_COLLECTION,
        );
        const now = new Date().toISOString();
        const parentUid = normalizeString(tokenPayload.userUid);

        const existingToken = await collection.findOne({ token });

        if (existingToken) {
            await collection.updateOne(
                { token },
                {
                    $set: {
                        appName: "parent-mobile",
                        isActive: true,
                        lastUsedAt: now,
                        organizationId: tokenPayload.uid,
                        platform: normalizedPlatform,
                        role: "parent",
                        schoolId,
                        updatedAt: now,
                        userUid: parentUid,
                    },
                },
            );

            return NextResponse.json({ message: "Device token updated successfully." });
        }

        const document: DeviceTokenDocument = {
            uid: randomUUID(),
            userUid: parentUid,
            role: "parent",
            organizationId: tokenPayload.uid,
            schoolId,
            token,
            platform: normalizedPlatform,
            appName: "parent-mobile",
            isActive: true,
            createdAt: now,
            updatedAt: now,
            lastUsedAt: now,
        };

        await collection.insertOne(document);

        return NextResponse.json(
            { message: "Device token registered successfully." },
            { status: 201 },
        );
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to register device token.";

        return NextResponse.json({ message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const tokenPayload = await verifyAccessToken(request);

        if (!tokenPayload) {
            return NextResponse.json(
                { message: "Unauthorized. Please login again." },
                { status: 401 },
            );
        }

        if (tokenPayload.role !== "parent" || !normalizeString(tokenPayload.userUid)) {
            return NextResponse.json(
                { message: "Parent access required." },
                { status: 403 },
            );
        }

        const token = normalizeString(new URL(request.url).searchParams.get("token"));

        if (!token) {
            return NextResponse.json(
                {
                    message: "Validation failed.",
                    fieldErrors: { token: "token is required." },
                },
                { status: 400 },
            );
        }

        const database = await getDatabase();
        const schoolId = await resolveSchoolId(
            database,
            tokenPayload.uid,
            tokenPayload.schoolId,
        );

        if (!schoolId) {
            return NextResponse.json(
                { message: "No school found for this organization." },
                { status: 404 },
            );
        }

        const result = await database
            .collection<DeviceTokenDocument>(DEVICE_TOKENS_COLLECTION)
            .updateOne(
                {
                    token,
                    userUid: normalizeString(tokenPayload.userUid),
                    organizationId: tokenPayload.uid,
                    ...buildSchoolScopeQuery(schoolId),
                },
                {
                    $set: {
                        isActive: false,
                        updatedAt: new Date().toISOString(),
                    },
                },
            );

        if (!result.matchedCount) {
            return NextResponse.json(
                { message: "Device token not found." },
                { status: 404 },
            );
        }

        return NextResponse.json({ message: "Device token removed successfully." });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to remove device token.";

        return NextResponse.json({ message }, { status: 500 });
    }
}
