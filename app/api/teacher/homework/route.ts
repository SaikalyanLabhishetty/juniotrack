import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { buildSchoolScopeQuery, resolveSchoolId } from "@/lib/organization-school";
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
};

type StudentDocument = {
    uid: string;
    name: string;
    dob: string;
    enrollmentNumber: string;
    classId: string;
    organizationId: string;
    schoolId: string;
};

type HomeworkStudentItem = {
    studentId: string;
    status: string;
    remarks: string;
};

type HomeworkRecordStatus = "pending" | "completed";

type HomeworkDocument = {
    uid: string;
    organizationId: string;
    schoolId: string;
    classId: string;
    teacherId: string;
    title: string;
    description: string;
    subject: string;
    academicYear: string;
    assignedDate: string;
    assignedStudents: HomeworkStudentItem[];
    dueDate: string;
    recordStatus: HomeworkRecordStatus;
    createAt: string;
};

type HomeworkStudentResponseItem = {
    uid: string;
    name: string;
    dob: string;
    enrollmentNumber: string;
    classId: string;
    organizationId: string;
    status: string;
    remarks: string;
};

type CreateHomeworkPayload = {
    classId?: string;
    teacherId?: string;
    title?: string;
    description?: string;
    subject?: string;
    academicYear?: string;
    assignedDate?: string;
    assignedStudents?: unknown;
    dueDate?: string;
};

type UpdateHomeworkPayload = {
    uid?: string;
    homeworkId?: string;
    teacherId?: string;
    title?: string;
    description?: string;
    subject?: string;
    academicYear?: string;
    assignedDate?: string;
    assignedStudents?: unknown;
    dueDate?: string;
};

const USERS_COLLECTION = "users";
const CLASSES_COLLECTION = "classes";
const STUDENTS_COLLECTION = "students";
const HOMEWORK_COLLECTION = "homework";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const RECORD_STATUS_PENDING: HomeworkRecordStatus = "pending";
const RECORD_STATUS_COMPLETED: HomeworkRecordStatus = "completed";

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

function isValidAcademicYear(value: string) {
    const match = value.match(/^(\d{4})-(\d{4})$/);

    if (!match) {
        return false;
    }

    return Number(match[2]) === Number(match[1]) + 1;
}

function normalizeHomeworkStudentItem(value: unknown): HomeworkStudentItem | null {
    if (!value || typeof value !== "object") {
        return null;
    }

    const item = value as Record<string, unknown>;
    const studentId =
        normalizeString(item.studentId) ||
        normalizeString(item.studentUid) ||
        normalizeString(item.uid);
    const status = normalizeString(item.status);
    const remarks = normalizeString(item.remarks);

    if (!studentId || !status) {
        return null;
    }

    return {
        studentId,
        status,
        remarks,
    };
}

function normalizeHomeworkRecordStatus(value: unknown): HomeworkRecordStatus {
    return normalizeString(value).toLowerCase() === RECORD_STATUS_COMPLETED
        ? RECORD_STATUS_COMPLETED
        : RECORD_STATUS_PENDING;
}

function canTeacherAccessClass(
    teacherUid: string,
    teacherClassIds: string[],
    classRecord: Pick<ClassDocument, "uid" | "teacherId">,
) {
    const classIdSet = new Set(normalizeStringArray(teacherClassIds));
    const isAssignedByClassIds = classIdSet.has(classRecord.uid);
    const isAssignedByClassTeacher = normalizeString(classRecord.teacherId) === teacherUid;

    return isAssignedByClassIds || isAssignedByClassTeacher;
}

function isDateOrderValid(assignedDate: string, dueDate: string) {
    return dueDate >= assignedDate;
}

function getTodayDateString() {
    return new Date().toISOString().slice(0, 10);
}

function buildClassSummary(classRecord: Pick<ClassDocument, "uid" | "className" | "section">) {
    return {
        classId: classRecord.uid,
        className: classRecord.className,
        section: classRecord.section,
    };
}

function pickHomeworkStudents(homework: HomeworkDocument | null): HomeworkStudentItem[] {
    if (!homework || !Array.isArray(homework.assignedStudents)) {
        return [];
    }

    return homework.assignedStudents
        .map((candidate) => normalizeHomeworkStudentItem(candidate))
        .filter((candidate): candidate is HomeworkStudentItem => candidate !== null);
}

function buildHomeworkStudentResponse(
    students: StudentDocument[],
    assignedStudents: HomeworkStudentItem[],
): HomeworkStudentResponseItem[] {
    const statusAndRemarksByStudentId = new Map(
        assignedStudents.map((item) => [
            item.studentId,
            { status: item.status, remarks: item.remarks },
        ]),
    );

    return students.map((student) => {
        const mapped = statusAndRemarksByStudentId.get(student.uid);

        return {
            uid: student.uid,
            name: student.name,
            dob: student.dob,
            enrollmentNumber: student.enrollmentNumber,
            classId: student.classId,
            organizationId: student.organizationId,
            status: mapped?.status ?? "pending",
            remarks: mapped?.remarks ?? "",
        };
    });
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
                    message: "You can only access your own homework records.",
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
        const studentsCollection = database.collection<StudentDocument>(
            STUDENTS_COLLECTION,
        );
        const homeworkCollection = database.collection<HomeworkDocument>(HOMEWORK_COLLECTION);

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

        if (!canTeacherAccessClass(teacherId, teacher.classIds, classRecord)) {
            return NextResponse.json(
                { message: "You do not have access to this class." },
                { status: 403 },
            );
        }

        const homework = await homeworkCollection.findOne(
            {
                organizationId: tokenPayload.uid,
                classId,
                teacherId,
                assignedDate: date,
                ...buildSchoolScopeQuery(schoolId),
            },
            {
                projection: {
                    _id: 0,
                    uid: 1,
                    organizationId: 1,
                    schoolId: 1,
                    classId: 1,
                    teacherId: 1,
                    title: 1,
                    description: 1,
                    subject: 1,
                    academicYear: 1,
                    assignedDate: 1,
                    assignedStudents: 1,
                    dueDate: 1,
                    recordStatus: 1,
                    createAt: 1,
                },
                sort: {
                    createAt: -1,
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
                        dob: 1,
                        enrollmentNumber: 1,
                        classId: 1,
                        organizationId: 1,
                    },
                },
            )
            .sort({ enrollmentNumber: 1 })
            .toArray();

        const classSummary = buildClassSummary(classRecord);
        const assignedStudents = pickHomeworkStudents(homework);
        const homeworkStudents = buildHomeworkStudentResponse(
            students,
            assignedStudents,
        );

        if (homework) {
            const homeworkWithRecordStatus = {
                ...homework,
                recordStatus: normalizeHomeworkRecordStatus(homework.recordStatus),
            };

            return NextResponse.json({
                source: "homework",
                class: classSummary,
                date,
                homework: homeworkWithRecordStatus,
                assignedStudents: homeworkStudents,
            });
        }

        return NextResponse.json({
            source: "students",
            class: classSummary,
            date,
            homework: null,
            assignedStudents: homeworkStudents,
        });
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Unable to fetch homework.";

        return NextResponse.json({ message }, { status: 500 });
    }
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

        const teacherUid = normalizeString(tokenPayload.userUid);

        if (tokenPayload.role !== "teacher" || !teacherUid) {
            return NextResponse.json(
                { message: "Teacher access required. Please login again." },
                { status: 403 },
            );
        }

        const payload = (await request.json()) as CreateHomeworkPayload;

        const classId = normalizeString(payload.classId);
        const teacherId = normalizeString(payload.teacherId);
        const title = normalizeString(payload.title);
        const description = normalizeString(payload.description);
        const subject = normalizeString(payload.subject);
        const academicYear = normalizeString(payload.academicYear);
        const assignedDate = normalizeString(payload.assignedDate);
        const dueDate = normalizeString(payload.dueDate);

        const assignedStudentsInput = Array.isArray(payload.assignedStudents)
            ? payload.assignedStudents
            : [];

        const fieldErrors: Record<string, string> = {};

        if (!classId) {
            fieldErrors.classId = "classId is required.";
        }

        if (!teacherId) {
            fieldErrors.teacherId = "teacherId is required.";
        }

        if (!title) {
            fieldErrors.title = "title is required.";
        }

        if (!description) {
            fieldErrors.description = "description is required.";
        }

        if (!subject) {
            fieldErrors.subject = "subject is required.";
        }

        if (!academicYear) {
            fieldErrors.academicYear = "academicYear is required.";
        } else if (!isValidAcademicYear(academicYear)) {
            fieldErrors.academicYear =
                "academicYear must be in YYYY-YYYY format (e.g. 2025-2026).";
        }

        if (!assignedDate) {
            fieldErrors.assignedDate = "assignedDate is required.";
        } else if (!DATE_PATTERN.test(assignedDate)) {
            fieldErrors.assignedDate = "assignedDate must be in YYYY-MM-DD format.";
        }

        if (!dueDate) {
            fieldErrors.dueDate = "dueDate is required.";
        } else if (!DATE_PATTERN.test(dueDate)) {
            fieldErrors.dueDate = "dueDate must be in YYYY-MM-DD format.";
        }

        if (
            DATE_PATTERN.test(assignedDate) &&
            DATE_PATTERN.test(dueDate) &&
            !isDateOrderValid(assignedDate, dueDate)
        ) {
            fieldErrors.dueDate = "dueDate must be the same as or after assignedDate.";
        }

        if (!Array.isArray(payload.assignedStudents)) {
            fieldErrors.assignedStudents = "assignedStudents must be an array.";
        } else if (assignedStudentsInput.length === 0) {
            fieldErrors.assignedStudents = "assignedStudents must include at least one student.";
        }

        const normalizedAssignedStudents = assignedStudentsInput
            .map((item) => normalizeHomeworkStudentItem(item))
            .filter((item): item is HomeworkStudentItem => item !== null);

        if (Array.isArray(payload.assignedStudents)) {
            if (normalizedAssignedStudents.length !== assignedStudentsInput.length) {
                fieldErrors.assignedStudents =
                    "Each assignedStudents item must include studentId and status.";
            } else {
                const studentIds = normalizedAssignedStudents.map((item) => item.studentId);
                const hasDuplicates = new Set(studentIds).size !== studentIds.length;

                if (hasDuplicates) {
                    fieldErrors.assignedStudents = "assignedStudents contains duplicate studentId values.";
                }
            }
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
                    message: "You can only create homework with your own teacherId.",
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
        const studentsCollection = database.collection<StudentDocument>(
            STUDENTS_COLLECTION,
        );
        const homeworkCollection = database.collection<HomeworkDocument>(HOMEWORK_COLLECTION);

        const teacher = await usersCollection.findOne(
            {
                uid: teacherUid,
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
                    teacherId: 1,
                    academicYear: 1,
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

        if (!canTeacherAccessClass(teacherUid, teacher.classIds, classRecord)) {
            return NextResponse.json(
                { message: "You do not have access to this class." },
                { status: 403 },
            );
        }

        if (
            classRecord.academicYear &&
            normalizeString(classRecord.academicYear) !== academicYear
        ) {
            return NextResponse.json(
                {
                    message: "Validation failed.",
                    fieldErrors: {
                        academicYear: "academicYear must match the class academic year.",
                    },
                },
                { status: 400 },
            );
        }

        const assignedStudentIds = normalizedAssignedStudents.map(
            (item) => item.studentId,
        );

        const students = await studentsCollection
            .find(
                {
                    uid: { $in: assignedStudentIds },
                    classId,
                    organizationId: tokenPayload.uid,
                    ...buildSchoolScopeQuery(schoolId),
                },
                {
                    projection: {
                        uid: 1,
                    },
                },
            )
            .toArray();

        const validStudentIdSet = new Set(students.map((student) => student.uid));
        const invalidStudentIds = assignedStudentIds.filter(
            (studentId) => !validStudentIdSet.has(studentId),
        );

        if (invalidStudentIds.length > 0) {
            return NextResponse.json(
                {
                    message: "Validation failed.",
                    fieldErrors: {
                        assignedStudents:
                            "assignedStudents contains students outside the selected class.",
                    },
                    invalidStudentIds,
                },
                { status: 400 },
            );
        }

        const homeworkRecord: HomeworkDocument = {
            uid: randomUUID(),
            organizationId: tokenPayload.uid,
            schoolId,
            classId,
            teacherId,
            title,
            description,
            subject,
            academicYear,
            assignedDate,
            assignedStudents: normalizedAssignedStudents,
            dueDate,
            recordStatus: RECORD_STATUS_PENDING,
            createAt: new Date().toISOString(),
        };

        const result = await homeworkCollection.insertOne(homeworkRecord);

        return NextResponse.json(
            {
                message: "Homework created successfully.",
                homework: {
                    _id: result.insertedId.toHexString(),
                    ...homeworkRecord,
                },
            },
            { status: 201 },
        );
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Unable to create homework.";

        return NextResponse.json({ message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
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

        const payload = (await request.json()) as UpdateHomeworkPayload;
        const homeworkUid =
            normalizeString(payload.uid) || normalizeString(payload.homeworkId);
        const teacherId = normalizeString(payload.teacherId);

        const hasTitle = Object.prototype.hasOwnProperty.call(payload, "title");
        const hasDescription = Object.prototype.hasOwnProperty.call(
            payload,
            "description",
        );
        const hasSubject = Object.prototype.hasOwnProperty.call(payload, "subject");
        const hasAcademicYear = Object.prototype.hasOwnProperty.call(
            payload,
            "academicYear",
        );
        const hasAssignedDate = Object.prototype.hasOwnProperty.call(
            payload,
            "assignedDate",
        );
        const hasDueDate = Object.prototype.hasOwnProperty.call(payload, "dueDate");
        const hasAssignedStudents = Object.prototype.hasOwnProperty.call(
            payload,
            "assignedStudents",
        );

        const title = normalizeString(payload.title);
        const description = normalizeString(payload.description);
        const subject = normalizeString(payload.subject);
        const academicYear = normalizeString(payload.academicYear);
        const assignedDate = normalizeString(payload.assignedDate);
        const dueDate = normalizeString(payload.dueDate);
        const assignedStudentsInput =
            hasAssignedStudents && Array.isArray(payload.assignedStudents)
                ? payload.assignedStudents
                : [];

        const fieldErrors: Record<string, string> = {};

        if (!homeworkUid) {
            fieldErrors.uid = "uid is required.";
        }

        if (teacherId && teacherId !== teacherUid) {
            return NextResponse.json(
                {
                    message: "You can only update homework with your own teacherId.",
                    fieldErrors: {
                        teacherId: "teacherId must match the logged-in teacher.",
                    },
                },
                { status: 403 },
            );
        }

        if (hasTitle && !title) {
            fieldErrors.title = "title cannot be empty.";
        }

        if (hasDescription && !description) {
            fieldErrors.description = "description cannot be empty.";
        }

        if (hasSubject && !subject) {
            fieldErrors.subject = "subject cannot be empty.";
        }

        if (hasAcademicYear) {
            if (!academicYear) {
                fieldErrors.academicYear = "academicYear cannot be empty.";
            } else if (!isValidAcademicYear(academicYear)) {
                fieldErrors.academicYear =
                    "academicYear must be in YYYY-YYYY format (e.g. 2025-2026).";
            }
        }

        if (hasAssignedDate) {
            if (!assignedDate) {
                fieldErrors.assignedDate = "assignedDate cannot be empty.";
            } else if (!DATE_PATTERN.test(assignedDate)) {
                fieldErrors.assignedDate = "assignedDate must be in YYYY-MM-DD format.";
            }
        }

        if (hasDueDate) {
            if (!dueDate) {
                fieldErrors.dueDate = "dueDate cannot be empty.";
            } else if (!DATE_PATTERN.test(dueDate)) {
                fieldErrors.dueDate = "dueDate must be in YYYY-MM-DD format.";
            }
        }

        if (hasAssignedStudents) {
            if (!Array.isArray(payload.assignedStudents)) {
                fieldErrors.assignedStudents = "assignedStudents must be an array.";
            } else if (assignedStudentsInput.length === 0) {
                fieldErrors.assignedStudents =
                    "assignedStudents must include at least one student.";
            }
        }

        const normalizedAssignedStudents = assignedStudentsInput
            .map((item) => normalizeHomeworkStudentItem(item))
            .filter((item): item is HomeworkStudentItem => item !== null);

        if (hasAssignedStudents && Array.isArray(payload.assignedStudents)) {
            if (normalizedAssignedStudents.length !== assignedStudentsInput.length) {
                fieldErrors.assignedStudents =
                    "Each assignedStudents item must include studentId and status.";
            } else {
                const studentIds = normalizedAssignedStudents.map((item) => item.studentId);
                const hasDuplicates = new Set(studentIds).size !== studentIds.length;

                if (hasDuplicates) {
                    fieldErrors.assignedStudents =
                        "assignedStudents contains duplicate studentId values.";
                }
            }
        }

        if (Object.keys(fieldErrors).length > 0) {
            return NextResponse.json(
                { message: "Validation failed.", fieldErrors },
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

        const usersCollection = database.collection<TeacherDocument>(USERS_COLLECTION);
        const classesCollection = database.collection<ClassDocument>(CLASSES_COLLECTION);
        const studentsCollection = database.collection<StudentDocument>(
            STUDENTS_COLLECTION,
        );
        const homeworkCollection = database.collection<HomeworkDocument>(HOMEWORK_COLLECTION);

        const existingHomework = await homeworkCollection.findOne(
            {
                uid: homeworkUid,
                organizationId: tokenPayload.uid,
                ...buildSchoolScopeQuery(schoolId),
            },
            {
                projection: {
                    _id: 0,
                    uid: 1,
                    organizationId: 1,
                    schoolId: 1,
                    classId: 1,
                    teacherId: 1,
                    academicYear: 1,
                    assignedDate: 1,
                    dueDate: 1,
                },
            },
        );

        if (!existingHomework) {
            return NextResponse.json(
                { message: "Homework not found for this organization." },
                { status: 404 },
            );
        }

        if (normalizeString(existingHomework.teacherId) !== teacherUid) {
            return NextResponse.json(
                { message: "You can only update your own homework records." },
                { status: 403 },
            );
        }

        const today = getTodayDateString();
        const existingDueDate = normalizeString(existingHomework.dueDate);

        if (DATE_PATTERN.test(existingDueDate) && today > existingDueDate) {
            return NextResponse.json(
                {
                    message: "Homework cannot be updated after dueDate.",
                    fieldErrors: {
                        dueDate:
                            "This homework is past due and can no longer be updated.",
                    },
                },
                { status: 400 },
            );
        }

        const teacher = await usersCollection.findOne(
            {
                uid: teacherUid,
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

        const classId = normalizeString(existingHomework.classId);
        const classRecord = await classesCollection.findOne(
            {
                uid: classId,
                organizationId: tokenPayload.uid,
                ...buildSchoolScopeQuery(schoolId),
            },
            {
                projection: {
                    uid: 1,
                    teacherId: 1,
                    academicYear: 1,
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

        if (!canTeacherAccessClass(teacherUid, teacher.classIds, classRecord)) {
            return NextResponse.json(
                { message: "You do not have access to this class." },
                { status: 403 },
            );
        }

        if (
            hasAcademicYear &&
            classRecord.academicYear &&
            normalizeString(classRecord.academicYear) !== academicYear
        ) {
            return NextResponse.json(
                {
                    message: "Validation failed.",
                    fieldErrors: {
                        academicYear: "academicYear must match the class academic year.",
                    },
                },
                { status: 400 },
            );
        }

        const nextAssignedDate = hasAssignedDate
            ? assignedDate
            : normalizeString(existingHomework.assignedDate);
        const nextDueDate = hasDueDate ? dueDate : existingDueDate;

        if (
            DATE_PATTERN.test(nextAssignedDate) &&
            DATE_PATTERN.test(nextDueDate) &&
            !isDateOrderValid(nextAssignedDate, nextDueDate)
        ) {
            return NextResponse.json(
                {
                    message: "Validation failed.",
                    fieldErrors: {
                        dueDate: "dueDate must be the same as or after assignedDate.",
                    },
                },
                { status: 400 },
            );
        }

        if (hasAssignedStudents) {
            const assignedStudentIds = normalizedAssignedStudents.map(
                (item) => item.studentId,
            );

            const students = await studentsCollection
                .find(
                    {
                        uid: { $in: assignedStudentIds },
                        classId,
                        organizationId: tokenPayload.uid,
                        ...buildSchoolScopeQuery(schoolId),
                    },
                    {
                        projection: {
                            uid: 1,
                        },
                    },
                )
                .toArray();

            const validStudentIdSet = new Set(students.map((student) => student.uid));
            const invalidStudentIds = assignedStudentIds.filter(
                (studentId) => !validStudentIdSet.has(studentId),
            );

            if (invalidStudentIds.length > 0) {
                return NextResponse.json(
                    {
                        message: "Validation failed.",
                        fieldErrors: {
                            assignedStudents:
                                "assignedStudents contains students outside the selected class.",
                        },
                        invalidStudentIds,
                    },
                    { status: 400 },
                );
            }
        }

        const updatePayload: Record<string, unknown> = {
            updatedAt: new Date().toISOString(),
            recordStatus: RECORD_STATUS_COMPLETED,
        };

        if (hasTitle) {
            updatePayload.title = title;
        }

        if (hasDescription) {
            updatePayload.description = description;
        }

        if (hasSubject) {
            updatePayload.subject = subject;
        }

        if (hasAcademicYear) {
            updatePayload.academicYear = academicYear;
        }

        if (hasAssignedDate) {
            updatePayload.assignedDate = assignedDate;
        }

        if (hasDueDate) {
            updatePayload.dueDate = dueDate;
        }

        if (hasAssignedStudents) {
            updatePayload.assignedStudents = normalizedAssignedStudents;
        }

        await homeworkCollection.updateOne(
            {
                uid: homeworkUid,
                organizationId: tokenPayload.uid,
                ...buildSchoolScopeQuery(schoolId),
            },
            {
                $set: updatePayload,
            },
        );

        const updatedHomework = await homeworkCollection.findOne(
            {
                uid: homeworkUid,
                organizationId: tokenPayload.uid,
                ...buildSchoolScopeQuery(schoolId),
            },
            {
                projection: {
                    _id: 0,
                },
            },
        );

        return NextResponse.json({
            message: "Homework updated successfully.",
            homework: updatedHomework,
        });
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Unable to update homework.";

        return NextResponse.json({ message }, { status: 500 });
    }
}
