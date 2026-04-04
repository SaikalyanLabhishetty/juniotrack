import type { Filter, ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getFirebaseMessaging } from "@/lib/firebase-admin";
import {
    type AttendanceNotificationJobDocument,
} from "@/lib/notifications/attendance";
import { buildSchoolScopeQuery } from "@/lib/organization-school";
import { getDatabase } from "@/lib/mongodb";

type DeviceTokenDocument = {
    _id?: ObjectId;
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

type NotificationJobDocument = AttendanceNotificationJobDocument & {
    _id?: ObjectId;
};

const DEVICE_TOKENS_COLLECTION = "device_tokens";
const NOTIFICATION_JOBS_COLLECTION = "notification_jobs";
const MAX_BATCH_SIZE = 100;
const MAX_ATTEMPTS = 5;

function normalizeString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function getCronSecret() {
    return (
        process.env.NOTIFICATION_CRON_SECRET?.trim() ||
        process.env.CRON_SECRET?.trim() ||
        ""
    );
}

function isAuthorized(request: Request) {
    const secret = getCronSecret();

    if (!secret) {
        throw new Error(
            "Missing NOTIFICATION_CRON_SECRET or CRON_SECRET in environment.",
        );
    }

    const authorization = request.headers.get("authorization") || "";
    const bearerToken = authorization.startsWith("Bearer ")
        ? authorization.slice(7).trim()
        : "";
    const headerSecret = normalizeString(request.headers.get("x-cron-secret"));

    return bearerToken === secret || headerSecret === secret;
}

function shouldDeactivateToken(code: string) {
    return (
        code === "messaging/invalid-registration-token" ||
        code === "messaging/registration-token-not-registered"
    );
}

function getNextFailureStatus(attempts: number) {
    return attempts + 1 >= MAX_ATTEMPTS ? "failed" : "queued";
}

export async function GET(request: Request) {
    try {
        if (!isAuthorized(request)) {
            return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
        }

        const database = await getDatabase();
        const jobsCollection = database.collection<NotificationJobDocument>(
            NOTIFICATION_JOBS_COLLECTION,
        );
        const deviceTokensCollection = database.collection<DeviceTokenDocument>(
            DEVICE_TOKENS_COLLECTION,
        );
        const queuedJobs = await jobsCollection
            .find(
                {
                    deliveryStatus: "queued",
                    attempts: { $lt: MAX_ATTEMPTS },
                },
                {
                    sort: { createdAt: 1 },
                    limit: MAX_BATCH_SIZE,
                },
            )
            .toArray();

        if (queuedJobs.length === 0) {
            return NextResponse.json({
                message: "No queued notifications found.",
                processedCount: 0,
                sentCount: 0,
                failedCount: 0,
            });
        }

        const jobIds = queuedJobs
            .map((job) => job._id)
            .filter((jobId): jobId is ObjectId => Boolean(jobId));
        const processingAt = new Date().toISOString();

        if (jobIds.length > 0) {
            await jobsCollection.updateMany(
                { _id: { $in: jobIds } },
                {
                    $set: {
                        deliveryStatus: "processing",
                        updatedAt: processingAt,
                    },
                },
            );
        }

        const parentIds = [...new Set(queuedJobs.map((job) => job.parentId))];
        const tokens = await deviceTokensCollection
            .find({
                userUid: { $in: parentIds },
                role: "parent",
                isActive: true,
            })
            .toArray();
        const tokensByParent = new Map<string, DeviceTokenDocument[]>();

        tokens.forEach((tokenDocument) => {
            const key = normalizeString(tokenDocument.userUid);
            const existing = tokensByParent.get(key) ?? [];
            const alreadyExists = existing.some(
                (entry) => normalizeString(entry.token) === normalizeString(tokenDocument.token),
            );

            if (alreadyExists) {
                return;
            }

            existing.push(tokenDocument);
            tokensByParent.set(key, existing);
        });

        const messaging = getFirebaseMessaging();
        let sentCount = 0;
        let failedCount = 0;

        for (const job of queuedJobs) {
            const parentTokens = (tokensByParent.get(normalizeString(job.parentId)) ?? [])
                .filter(
                    (tokenDocument) =>
                        normalizeString(tokenDocument.organizationId) ===
                            normalizeString(job.organizationId) &&
                        (
                            !normalizeString(job.schoolId) ||
                            normalizeString(tokenDocument.schoolId) ===
                                normalizeString(job.schoolId)
                        ),
                )
                .map((tokenDocument) => normalizeString(tokenDocument.token))
                .filter(Boolean);

            if (parentTokens.length === 0) {
                const nextStatus = getNextFailureStatus(job.attempts);

                failedCount += 1;

                await jobsCollection.updateOne(
                    { _id: job._id },
                    {
                        $set: {
                            deliveryStatus: nextStatus,
                            errorMessage: "No active device tokens found for parent.",
                            processedAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                        },
                        $inc: {
                            attempts: 1,
                        },
                    },
                );

                continue;
            }

            try {
                const response = await messaging.sendEachForMulticast({
                    tokens: parentTokens,
                    notification: {
                        title: job.title,
                        body: job.body,
                    },
                    data: job.data,
                    android: {
                        priority: "high",
                    },
                    apns: {
                        headers: {
                            "apns-priority": "10",
                        },
                        payload: {
                            aps: {
                                sound: "default",
                            },
                        },
                    },
                });

                const invalidTokens: string[] = [];

                response.responses.forEach(
                    (
                        result: { error?: { code?: string; message?: string } },
                        index: number,
                    ) => {
                    const errorCode = normalizeString(result.error?.code);

                    if (errorCode && shouldDeactivateToken(errorCode)) {
                        invalidTokens.push(parentTokens[index]);
                    }
                    },
                );

                if (invalidTokens.length > 0) {
                    const tokenFilter: Filter<DeviceTokenDocument> = {
                        token: { $in: invalidTokens },
                        ...buildSchoolScopeQuery(normalizeString(job.schoolId)),
                    };

                    await deviceTokensCollection.updateMany(tokenFilter, {
                        $set: {
                            isActive: false,
                            updatedAt: new Date().toISOString(),
                        },
                    });
                }

                const wasSent = response.successCount > 0;
                const nextStatus = wasSent
                    ? "sent"
                    : getNextFailureStatus(job.attempts);

                await jobsCollection.updateOne(
                    { _id: job._id },
                    {
                        $set: {
                            deliveryStatus: nextStatus,
                            errorMessage: wasSent
                                ? ""
                                : response.responses
                                      .map(
                                          (result: {
                                              error?: {
                                                  code?: string;
                                                  message?: string;
                                              };
                                          }) =>
                                          normalizeString(result.error?.message),
                                      )
                                       .filter(Boolean)
                                       .join("; ") || "Notification delivery failed.",
                            processedAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                        },
                        $inc: {
                            attempts: 1,
                        },
                    },
                );

                if (wasSent) {
                    sentCount += 1;
                } else {
                    failedCount += 1;
                }
            } catch (error) {
                const nextStatus = getNextFailureStatus(job.attempts);

                failedCount += 1;

                await jobsCollection.updateOne(
                    { _id: job._id },
                    {
                        $set: {
                            deliveryStatus: nextStatus,
                            errorMessage:
                                error instanceof Error
                                    ? error.message
                                    : "Notification delivery failed.",
                            processedAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                        },
                        $inc: {
                            attempts: 1,
                        },
                    },
                );
            }
        }

        return NextResponse.json({
            message: "Notification batch processed.",
            processedCount: queuedJobs.length,
            sentCount,
            failedCount,
        });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to process notifications.";

        return NextResponse.json({ message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    return GET(request);
}
