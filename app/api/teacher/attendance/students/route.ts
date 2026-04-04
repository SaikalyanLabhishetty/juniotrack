import { randomUUID } from "node:crypto";
import type { ObjectId } from "mongodb";
import { type NextRequest, NextResponse } from "next/server";
import { buildSchoolScopeQuery, resolveSchoolId } from "@/lib/organization-school";
import { enqueueAttendanceNotifications } from "@/lib/notifications/attendance";
import { getDatabase } from "@/lib/mongodb";
import { verifyAccessToken } from "@/lib/verify-access-token";

type TeacherDocument = {
    uid: string;
    role: "teacher";
    organizationId: string;
    schoolId: string;
    classIds: string[];
};

type ClassDocument = {
    uid: string;
    className: string;
    section: string;
    teacherId: string;
    organizationId: string;
    schoolId: string;
    academicYear: string;
    createdAt: string;
};

type StudentDocument = {
    uid: string;
    name: string;
    classId: string;
    enrollmentNumber: string;
    organizationId: string;
    dob: string;
    parentId: string;
    schoolId?: string;
};

type AttendanceDocument = {
    _id?: ObjectId;
    uid?: string;
    date?: string | Date;
    classId: string;
    teacherId: string;
    organizationId: string;
    schoolId?: string;
    studentAttendance?: unknown[];
    createdAt?: string;
};

type StudentAttendanceItem = {
    studentUid: string;
    status: string;
};

type StudentAttendanceResponseItem = {
    uid: string;
    name: string;
    dob: string;
    enrollmentNumber: string;
    classId: string;
    organizationId: string;
    status: string;
};

type SaveAttendancePayload = {
    classId?: string;
    teacherId?: string;
    date?: string;
    schoolId?: string;
    createdAt?: string;
    studentAttendance?: unknown;
};

const USERS_COLLECTION = "users";
const CLASSES_COLLECTION = "classes";
const STUDENTS_COLLECTION = "students";
const ATTENDANCE_COLLECTION = "attendance";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
}

function buildDateRange(date: string) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    return {
        $gte: start,
        $lt: end,
    };
}

function normalizeStudentAttendanceItem(value: unknown): StudentAttendanceItem | null {
    if (!value || typeof value !== "object") {
        return null;
    }

    const item = value as Record<string, unknown>;
    const studentUid =
        normalizeString(item.studentUid) ||
        normalizeString(item.studentId) ||
        normalizeString(item.uid);
    const status = normalizeString(item.status) || normalizeString(item.attendance);

    if (!studentUid || !status) {
        return null;
    }

    return { studentUid, status };
}

function pickAttendanceStudents(attendance: AttendanceDocument | null): StudentAttendanceItem[] {
    if (!attendance || !Array.isArray(attendance.studentAttendance)) {
        return [];
    }

    return attendance.studentAttendance
        .map((candidate) => normalizeStudentAttendanceItem(candidate))
        .filter((candidate): candidate is StudentAttendanceItem => candidate !== null);
}

function buildStudentAttendanceResponse(
    students: StudentDocument[],
    attendanceItems: StudentAttendanceItem[],
): StudentAttendanceResponseItem[] {
    const statusByStudentUid = new Map(
        attendanceItems.map((item) => [item.studentUid, item.status]),
    );

    return students.map((student) => ({
        uid: student.uid,
        name: student.name,
        dob: student.dob,
        enrollmentNumber: student.enrollmentNumber,
        classId: student.classId,
        organizationId: student.organizationId,
        status: statusByStudentUid.get(student.uid) ?? "unmarked",
    }));
}

function buildClassSummary(classRecord: Pick<ClassDocument, "uid" | "className" | "section">) {
    return {
        classId: classRecord.uid,
        className: classRecord.className,
        section: classRecord.section,
    };
}

function normalizeAttendanceDate(value: string | Date | undefined, fallback: string) {
    if (value instanceof Date) {
        return value.toISOString();
    }

    if (typeof value === "string" && value.trim()) {
        return value;
    }

    return fallback;
}

function isValidIsoDateTime(value: string) {
    return !Number.isNaN(Date.parse(value));
}

function buildAttendanceLookupQuery(
    organizationId: string,
    classId: string,
    teacherId: string,
    schoolId: string,
    date: string,
) {
    return {
        $and: [
            {
                organizationId,
                classId,
                teacherId,
            },
            buildSchoolScopeQuery(schoolId),
            {
                $or: [{ date }, { date: buildDateRange(date) }],
            },
        ],
    };
}

export async function GET(request: NextRequest) {
    try {
        const tokenPayload = await verifyAccessToken(request);

        if (!tokenPayload) {
            return NextResponse.json(
                { message: "Unauthorized. Please login again." },
                { status: 401 },
            );
        }

        const teacherUid = normalizeString(tokenPayload.userUid);
        const classId = normalizeString(request.nextUrl.searchParams.get("classId"));
        const teacherId = normalizeString(request.nextUrl.searchParams.get("teacherId"));
        const date = normalizeString(request.nextUrl.searchParams.get("date"));

        if (tokenPayload.role !== "teacher" || !teacherUid) {
            return NextResponse.json(
                { message: "Teacher access required. Please login again." },
                { status: 403 },
            );
        }

        const fieldErrors: Record<string, string> = {};

        if (!classId) {
            fieldErrors.classId = "classId is required.";
        }

        if (!teacherId) {
            fieldErrors.teacherId = "teacherId is required.";
        }

        if (!date) {
            fieldErrors.date = "date is required.";
        } else if (!DATE_PATTERN.test(date)) {
            fieldErrors.date = "date must be in YYYY-MM-DD format.";
        }

        if (Object.keys(fieldErrors).length > 0) {
            return NextResponse.json(
                { message: "Validation failed.", fieldErrors },
                { status: 400 },
            );
        }

        if (teacherId !== teacherUid) {
            return NextResponse.json(
                {
                    message: "You can only access your own attendance records.",
                    fieldErrors: {
                        teacherId: "teacherId must match the logged-in teacher.",
                    },
                },
                { status: 403 },
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

        const usersCollection = database.collection<TeacherDocument>(USERS_COLLECTION);
        const classesCollection = database.collection<ClassDocument>(CLASSES_COLLECTION);
        const attendanceCollection =
            database.collection<AttendanceDocument>(ATTENDANCE_COLLECTION);
        const studentsCollection = database.collection<StudentDocument>(
            STUDENTS_COLLECTION,
        );

        const teacher = await usersCollection.findOne(
            {
                uid: teacherId,
                role: "teacher",
                organizationId: tokenPayload.uid,
                ...buildSchoolScopeQuery(schoolId),
            },
            {
                projection: {
                    uid: 1,
                    classIds: 1,
                },
            },
        );

        if (!teacher) {
            return NextResponse.json(
                { message: "Teacher not found for this organization." },
                { status: 404 },
            );
        }

        const classRecord = await classesCollection.findOne(
            {
                uid: classId,
                organizationId: tokenPayload.uid,
                ...buildSchoolScopeQuery(schoolId),
            },
            {
                projection: {
                    uid: 1,
                    className: 1,
                    section: 1,
                    teacherId: 1,
                },
            },
        );

        if (!classRecord) {
            return NextResponse.json(
                {
                    message: "Class not found for this organization.",
                    fieldErrors: {
                        classId: "No matching class found.",
                    },
                },
                { status: 404 },
            );
        }

        const teacherClassIds = new Set(normalizeStringArray(teacher.classIds));
        const isAssignedByTeacherClassIds = teacherClassIds.has(classId);
        const isAssignedByClassTeacherId = normalizeString(classRecord.teacherId) === teacherId;

        if (!isAssignedByTeacherClassIds && !isAssignedByClassTeacherId) {
            return NextResponse.json(
                { message: "You do not have access to this class." },
                { status: 403 },
            );
        }

        const attendance = await attendanceCollection.findOne(
            buildAttendanceLookupQuery(
                tokenPayload.uid,
                classId,
                teacherId,
                schoolId,
                date,
            ),
            {
                projection: {
                    _id: 0,
                    uid: 1,
                    date: 1,
                    classId: 1,
                    teacherId: 1,
                    studentAttendance: 1,
                    createdAt: 1,
                },
                sort: {
                    createdAt: -1,
                },
            },
        );

        const students = await studentsCollection
            .find(
                {
                    organizationId: tokenPayload.uid,
                    classId,
                    ...buildSchoolScopeQuery(schoolId),
                },
                {
                    projection: {
                        _id: 0,
                        uid: 1,
                        name: 1,
                        classId: 1,
                        enrollmentNumber: 1,
                        organizationId: 1,
                        dob: 1,
                        parentId: 1,
                    },
                },
            )
            .sort({ enrollmentNumber: 1 })
            .toArray();

        const classSummary = buildClassSummary(classRecord);
        const attendanceItems = pickAttendanceStudents(attendance);
        const studentAttendance = buildStudentAttendanceResponse(
            students,
            attendanceItems,
        );

        if (attendance) {
            return NextResponse.json({
                source: "attendance",
                class: classSummary,
                date,
                attendance: {
                    uid: attendance.uid ?? "",
                    date: normalizeAttendanceDate(attendance.date, date),
                    classId: attendance.classId,
                    teacherId: attendance.teacherId,
                    schoolId: attendance.schoolId ?? schoolId,
                    createdAt: attendance.createdAt ?? "",
                },
                studentAttendance,
            });
        }

        return NextResponse.json({
            source: "students",
            class: classSummary,
            date,
            attendance: null,
            studentAttendance,
        });
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Unable to fetch students for attendance.";

        return NextResponse.json({ message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const tokenPayload = await verifyAccessToken(request);

        if (!tokenPayload) {
            return NextResponse.json(
                { message: "Unauthorized. Please login again." },
                { status: 401 },
            );
        }

        const teacherUid = normalizeString(tokenPayload.userUid);

        if (tokenPayload.role !== "teacher" || !teacherUid) {
            return NextResponse.json(
                { message: "Teacher access required. Please login again." },
                { status: 403 },
            );
        }

        let payload: SaveAttendancePayload;

        try {
            payload = (await request.json()) as SaveAttendancePayload;
        } catch {
            return NextResponse.json(
                { message: "Invalid JSON payload." },
                { status: 400 },
            );
        }

        const classId = normalizeString(payload.classId);
        const teacherId = normalizeString(payload.teacherId);
        const date = normalizeString(payload.date);
        const requestedSchoolId = normalizeString(payload.schoolId);
        const requestedCreatedAt = normalizeString(payload.createdAt);
        const rawStudentAttendance = payload.studentAttendance;

        const fieldErrors: Record<string, string> = {};

        if (!classId) {
            fieldErrors.classId = "classId is required.";
        }

        if (!teacherId) {
            fieldErrors.teacherId = "teacherId is required.";
        }

        if (!date) {
            fieldErrors.date = "date is required.";
        } else if (!DATE_PATTERN.test(date)) {
            fieldErrors.date = "date must be in YYYY-MM-DD format.";
        }

        if (requestedCreatedAt && !isValidIsoDateTime(requestedCreatedAt)) {
            fieldErrors.createdAt = "createdAt must be a valid date-time string.";
        }

        if (!Array.isArray(rawStudentAttendance) || rawStudentAttendance.length === 0) {
            fieldErrors.studentAttendance =
                "studentAttendance must be a non-empty array.";
        }

        if (Object.keys(fieldErrors).length > 0) {
            return NextResponse.json(
                { message: "Validation failed.", fieldErrors },
                { status: 400 },
            );
        }

        if (teacherId !== teacherUid) {
            return NextResponse.json(
                {
                    message: "You can only submit your own attendance records.",
                    fieldErrors: {
                        teacherId: "teacherId must match the logged-in teacher.",
                    },
                },
                { status: 403 },
            );
        }

        const studentAttendanceInput = Array.isArray(rawStudentAttendance)
            ? rawStudentAttendance
            : [];

        const normalizedAttendanceItems = studentAttendanceInput
            .map((candidate: unknown) => normalizeStudentAttendanceItem(candidate))
            .filter(
                (candidate: StudentAttendanceItem | null): candidate is StudentAttendanceItem =>
                    candidate !== null,
            );

        if (normalizedAttendanceItems.length !== studentAttendanceInput.length) {
            return NextResponse.json(
                {
                    message: "Validation failed.",
                    fieldErrors: {
                        studentAttendance:
                            "Each attendance item must include studentUid and status.",
                    },
                },
                { status: 400 },
            );
        }

        const duplicateStudentIds = new Set<string>();
        const seenStudentIds = new Set<string>();

        normalizedAttendanceItems.forEach((item: StudentAttendanceItem) => {
            if (seenStudentIds.has(item.studentUid)) {
                duplicateStudentIds.add(item.studentUid);
                return;
            }

            seenStudentIds.add(item.studentUid);
        });

        if (duplicateStudentIds.size > 0) {
            return NextResponse.json(
                {
                    message: "Validation failed.",
                    fieldErrors: {
                        studentAttendance:
                            "studentAttendance contains duplicate student entries.",
                    },
                    duplicateStudentIds: [...duplicateStudentIds],
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

        if (requestedSchoolId && requestedSchoolId !== schoolId) {
            return NextResponse.json(
                {
                    message: "Validation failed.",
                    fieldErrors: {
                        schoolId: "schoolId must match the logged-in teacher school.",
                    },
                },
                { status: 400 },
            );
        }

        const usersCollection = database.collection<TeacherDocument>(USERS_COLLECTION);
        const classesCollection = database.collection<ClassDocument>(CLASSES_COLLECTION);
        const attendanceCollection =
            database.collection<AttendanceDocument>(ATTENDANCE_COLLECTION);
        const studentsCollection = database.collection<StudentDocument>(
            STUDENTS_COLLECTION,
        );

        const teacher = await usersCollection.findOne(
            {
                uid: teacherId,
                role: "teacher",
                organizationId: tokenPayload.uid,
                ...buildSchoolScopeQuery(schoolId),
            },
            {
                projection: {
                    uid: 1,
                    classIds: 1,
                },
            },
        );

        if (!teacher) {
            return NextResponse.json(
                { message: "Teacher not found for this organization." },
                { status: 404 },
            );
        }

        const classRecord = await classesCollection.findOne(
            {
                uid: classId,
                organizationId: tokenPayload.uid,
                ...buildSchoolScopeQuery(schoolId),
            },
            {
                projection: {
                    uid: 1,
                    className: 1,
                    section: 1,
                    teacherId: 1,
                },
            },
        );

        if (!classRecord) {
            return NextResponse.json(
                {
                    message: "Class not found for this organization.",
                    fieldErrors: {
                        classId: "No matching class found.",
                    },
                },
                { status: 404 },
            );
        }

        const teacherClassIds = new Set(normalizeStringArray(teacher.classIds));
        const isAssignedByTeacherClassIds = teacherClassIds.has(classId);
        const isAssignedByClassTeacherId = normalizeString(classRecord.teacherId) === teacherId;

        if (!isAssignedByTeacherClassIds && !isAssignedByClassTeacherId) {
            return NextResponse.json(
                { message: "You do not have access to this class." },
                { status: 403 },
            );
        }

        const students = await studentsCollection
            .find(
                {
                    organizationId: tokenPayload.uid,
                    classId,
                    ...buildSchoolScopeQuery(schoolId),
                },
                {
                    projection: {
                        _id: 0,
                        uid: 1,
                        name: 1,
                        classId: 1,
                        enrollmentNumber: 1,
                        organizationId: 1,
                        dob: 1,
                        parentId: 1,
                    },
                },
            )
            .sort({ enrollmentNumber: 1 })
            .toArray();

        if (students.length === 0) {
            return NextResponse.json(
                {
                    message: "No students found for this class.",
                    fieldErrors: {
                        classId: "Attendance cannot be saved for an empty class.",
                    },
                },
                { status: 404 },
            );
        }

        const validStudentIds = new Set(students.map((student) => student.uid));
        const invalidStudentIds = normalizedAttendanceItems
            .map((item: StudentAttendanceItem) => item.studentUid)
            .filter((studentUid: string) => !validStudentIds.has(studentUid));

        if (invalidStudentIds.length > 0) {
            return NextResponse.json(
                {
                    message: "Validation failed.",
                    fieldErrors: {
                        studentAttendance:
                            "studentAttendance contains students outside the selected class.",
                    },
                    invalidStudentIds,
                },
                { status: 400 },
            );
        }

        const existingAttendance = await attendanceCollection.findOne(
            buildAttendanceLookupQuery(
                tokenPayload.uid,
                classId,
                teacherId,
                schoolId,
                date,
            ),
            {
                projection: {
                    _id: 1,
                    uid: 1,
                    createdAt: 1,
                    studentAttendance: 1,
                },
                sort: {
                    createdAt: -1,
                },
            },
        );

        const now = new Date().toISOString();
        const existingCreatedAt = normalizeString(existingAttendance?.createdAt);
        const attendanceDocument: AttendanceDocument = {
            uid: existingAttendance?.uid ?? randomUUID(),
            date,
            classId,
            teacherId,
            organizationId: tokenPayload.uid,
            schoolId,
            studentAttendance: normalizedAttendanceItems,
            createdAt: existingCreatedAt || requestedCreatedAt || now,
        };

        if (existingAttendance?._id) {
            await attendanceCollection.updateOne(
                { _id: existingAttendance._id },
                { $set: attendanceDocument },
            );
        } else {
            await attendanceCollection.insertOne(attendanceDocument);
        }

        try {
            await enqueueAttendanceNotifications({
                database,
                attendanceUid: attendanceDocument.uid ?? "",
                organizationId: tokenPayload.uid,
                schoolId,
                classId,
                date,
                previousAttendanceItems: pickAttendanceStudents(existingAttendance),
                nextAttendanceItems: normalizedAttendanceItems,
                students: students.map((student) => ({
                    uid: student.uid,
                    name: student.name,
                    parentId: student.parentId,
                })),
            });
        } catch (notificationError) {
            console.error("Failed to queue attendance notifications", notificationError);
        }

        return NextResponse.json(
            {
                message: existingAttendance
                    ? "Attendance updated successfully."
                    : "Attendance saved successfully.",
                class: buildClassSummary(classRecord),
                date,
                attendance: {
                    uid: attendanceDocument.uid ?? "",
                    date: normalizeAttendanceDate(attendanceDocument.date, date),
                    classId: attendanceDocument.classId,
                    teacherId: attendanceDocument.teacherId,
                    schoolId: attendanceDocument.schoolId ?? schoolId,
                    createdAt: attendanceDocument.createdAt ?? now,
                },
                studentAttendance: buildStudentAttendanceResponse(
                    students,
                    normalizedAttendanceItems,
                ),
            },
            { status: existingAttendance ? 200 : 201 },
        );
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to save attendance.";

        return NextResponse.json({ message }, { status: 500 });
    }
}
