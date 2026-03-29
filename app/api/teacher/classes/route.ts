import { NextResponse } from "next/server";
import { buildSchoolScopeQuery, resolveSchoolId } from "@/lib/organization-school";
import { getDatabase } from "@/lib/mongodb";
import { verifyAccessToken } from "@/lib/verify-access-token";

type TeacherDocument = {
    uid: string;
    name: string;
    role: "teacher";
    organizationId: string;
    schoolId: string;
    classIds: string[];
    classTeacherClassId?: string;
    isClassTeacher?: boolean;
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

const USERS_COLLECTION = "users";
const CLASSES_COLLECTION = "classes";

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

export async function GET(request: Request) {
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
                    name: 1,
                    classIds: 1,
                    classTeacherClassId: 1,
                    isClassTeacher: 1,
                },
            },
        );

        if (!teacher) {
            return NextResponse.json(
                { message: "Teacher not found for this organization." },
                { status: 404 },
            );
        }

        const uniqueClassIds = [...new Set(normalizeStringArray(teacher.classIds))];
        const classTeacherClassId = normalizeString(teacher.classTeacherClassId);
        const classTeacherAssignment =
            teacher.isClassTeacher && classTeacherClassId
                ? { classTeacherClassId }
                : {};

        if (uniqueClassIds.length === 0) {
            return NextResponse.json({
                teacher: {
                    uid: teacher.uid,
                    name: teacher.name,
                },
                classes: [],
                ...classTeacherAssignment,
            });
        }

        const classes = await classesCollection
            .find(
                {
                    uid: { $in: uniqueClassIds },
                    organizationId: tokenPayload.uid,
                    ...buildSchoolScopeQuery(schoolId),
                },
                {
                    projection: {
                        _id: 1,
                        uid: 1,
                        className: 1,
                        section: 1,
                        academicYear: 1,
                        teacherId: 1,
                        schoolId: 1,
                        createdAt: 1,
                    },
                },
            )
            .toArray();

        const classMap = new Map(classes.map((classItem) => [classItem.uid, classItem]));
        const orderedClasses = uniqueClassIds.flatMap((classId) => {
            const classItem = classMap.get(classId);
            return classItem ? [classItem] : [];
        });

        return NextResponse.json({
            teacher: {
                uid: teacher.uid,
                name: teacher.name,
            },
            classes: orderedClasses,
            ...classTeacherAssignment,
        });
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Unable to fetch teacher classes.";

        return NextResponse.json({ message }, { status: 500 });
    }
}
