import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";

export type AttendanceNotificationStudent = {
    uid: string;
    name: string;
    parentId: string;
};

export type AttendanceNotificationItem = {
    studentUid: string;
    status: string;
};

export type AttendanceNotificationJobDocument = {
    uid: string;
    type: "attendance";
    notificationKey: string;
    attendanceUid: string;
    organizationId: string;
    schoolId: string;
    classId: string;
    parentId: string;
    studentUid: string;
    studentName: string;
    status: string;
    date: string;
    title: string;
    body: string;
    data: Record<string, string>;
    deliveryStatus: "queued" | "processing" | "sent" | "failed";
    attempts: number;
    createdAt: string;
    updatedAt: string;
    processedAt?: string;
    errorMessage?: string;
};

const NOTIFICATION_JOBS_COLLECTION = "notification_jobs";

function normalizeString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeAttendanceStatus(value: string) {
    return normalizeString(value).toLowerCase();
}

function formatAttendanceStatus(value: string) {
    const status = normalizeAttendanceStatus(value);

    if (!status) {
        return "Updated";
    }

    return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}

export function buildAttendanceNotificationMessage(
    studentName: string,
    status: string,
    date: string,
) {
    const safeStudentName = normalizeString(studentName) || "Your child";
    const safeStatus = formatAttendanceStatus(status);

    return {
        title: "Attendance Update",
        body: `${safeStudentName} was marked ${safeStatus} on ${date}.`,
    };
}

export async function enqueueAttendanceNotifications(params: {
    database: Db;
    attendanceUid: string;
    organizationId: string;
    schoolId: string;
    classId: string;
    date: string;
    previousAttendanceItems?: AttendanceNotificationItem[];
    nextAttendanceItems: AttendanceNotificationItem[];
    students: AttendanceNotificationStudent[];
}) {
    const {
        attendanceUid,
        classId,
        database,
        date,
        nextAttendanceItems,
        organizationId,
        previousAttendanceItems = [],
        schoolId,
        students,
    } = params;

    const studentsByUid = new Map(
        students.map((student) => [normalizeString(student.uid), student]),
    );
    const previousStatuses = new Map(
        previousAttendanceItems.map((item) => [
            normalizeString(item.studentUid),
            normalizeAttendanceStatus(item.status),
        ]),
    );
    const jobs: AttendanceNotificationJobDocument[] = [];
    const now = new Date().toISOString();

    nextAttendanceItems.forEach((item) => {
        const studentUid = normalizeString(item.studentUid);
        const nextStatus = normalizeAttendanceStatus(item.status);
        const previousStatus = previousStatuses.get(studentUid) ?? "";
        const student = studentsByUid.get(studentUid);
        const parentId = normalizeString(student?.parentId);

        if (!studentUid || !nextStatus || !student || !parentId) {
            return;
        }

        if (previousStatus === nextStatus) {
            return;
        }

        const message = buildAttendanceNotificationMessage(
            student.name,
            nextStatus,
            date,
        );
        const notificationKey = [attendanceUid, date, studentUid, nextStatus].join(":");

        jobs.push({
            uid: randomUUID(),
            type: "attendance",
            notificationKey,
            attendanceUid,
            organizationId,
            schoolId,
            classId,
            parentId,
            studentUid,
            studentName: normalizeString(student.name),
            status: nextStatus,
            date,
            title: message.title,
            body: message.body,
            data: {
                attendanceUid,
                classId,
                date,
                organizationId,
                schoolId,
                status: nextStatus,
                studentName: normalizeString(student.name),
                studentUid,
                type: "attendance",
            },
            deliveryStatus: "queued",
            attempts: 0,
            createdAt: now,
            updatedAt: now,
        });
    });

    if (jobs.length === 0) {
        return { queuedCount: 0 };
    }

    await database
        .collection<AttendanceNotificationJobDocument>(NOTIFICATION_JOBS_COLLECTION)
        .insertMany(jobs, { ordered: false });

    return { queuedCount: jobs.length };
}
