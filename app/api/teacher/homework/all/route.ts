import { type NextRequest, NextResponse } from "next/server";
import { buildSchoolScopeQuery, resolveSchoolId } from "@/lib/organization-school";
import { getDatabase } from "@/lib/mongodb";
import { verifyAccessToken } from "@/lib/verify-access-token";

type TeacherDocument = {
    uid: string;
    role: "teacher";
    organizationId: string;
};

type HomeworkDocument = {
    uid: string;
    teacherId: string;
    classId: string;
    title: string;
    subject: string;
    assignedDate: string;
    dueDate: string;
    createAt: string;
    organizationId: string;
    schoolId: string;
};

const USERS_COLLECTION = "users";
const HOMEWORK_COLLECTION = "homework";
const PAGE_SIZE = 25;

function normalizeString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function parsePage(value: string) {
    if (!value) {
        return 1;
    }

    if (!/^\d+$/.test(value)) {
        return null;
    }

    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function escapeRegExp(input: string) {
    return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

        if (tokenPayload.role !== "teacher" || !teacherUid) {
            return NextResponse.json(
                { message: "Teacher access required. Please login again." },
                { status: 403 },
            );
        }

        const teacherIdParam = normalizeString(
            request.nextUrl.searchParams.get("teacherId"),
        );
        const subject = normalizeString(request.nextUrl.searchParams.get("subject"));
        const pageRaw = normalizeString(request.nextUrl.searchParams.get("page"));
        const page = parsePage(pageRaw);

        if (teacherIdParam && teacherIdParam !== teacherUid) {
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

        if (!page) {
            return NextResponse.json(
                {
                    message: "Validation failed.",
                    fieldErrors: {
                        page: "page must be a positive integer.",
                    },
                },
                { status: 400 },
            );
        }

        const teacherId = teacherIdParam || teacherUid;

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
                },
            },
        );

        if (!teacher) {
            return NextResponse.json(
                { message: "Teacher not found for this organization." },
                { status: 404 },
            );
        }

        const query: Record<string, unknown> = {
            organizationId: tokenPayload.uid,
            teacherId,
            ...buildSchoolScopeQuery(schoolId),
        };

        if (subject) {
            query.subject = { $regex: new RegExp(`^${escapeRegExp(subject)}$`, "i") };
        }

        const skip = (page - 1) * PAGE_SIZE;

        const [totalRecords, homeworks] = await Promise.all([
            homeworkCollection.countDocuments(query),
            homeworkCollection
                .find(query, {
                    projection: {
                        _id: 0,
                        teacherId: 1,
                        classId: 1,
                        uid: 1,
                        title: 1,
                        subject: 1,
                        assignedDate: 1,
                        dueDate: 1,
                    },
                })
                .sort({ assignedDate: -1, createAt: -1 })
                .skip(skip)
                .limit(PAGE_SIZE)
                .toArray(),
        ]);

        const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));

        return NextResponse.json({
            page,
            pageSize: PAGE_SIZE,
            totalRecords,
            totalPages,
            subject: subject || null,
            homeworks,
        });
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Unable to fetch homework list.";

        return NextResponse.json({ message }, { status: 500 });
    }
}
