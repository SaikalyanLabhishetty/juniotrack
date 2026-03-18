import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { buildSchoolScopeQuery, resolveSchoolId } from "@/lib/organization-school";
import { verifyAccessToken } from "@/lib/verify-access-token";

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

type CreateClassPayload = {
    className?: string;
    section?: string;
    teacherId?: string;
    academicYear?: string;
};

const CLASSES_COLLECTION = "classes";
const sectionPattern = /^[A-Z]+$/;

function normalizeString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeAcademicYear(value: unknown) {
    return normalizeString(value);
}

function isValidAcademicYear(value: string) {
    const match = value.match(/^(\d{4})-(\d{4})$/);

    if (!match) {
        return false;
    }

    return Number(match[2]) === Number(match[1]) + 1;
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

        const academicYearFilter = normalizeAcademicYear(
            request.nextUrl.searchParams.get("academicYear"),
        );

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

        const collection = database.collection<ClassDocument>(CLASSES_COLLECTION);

        const filter: Record<string, unknown> = {
            organizationId: tokenPayload.uid,
            ...buildSchoolScopeQuery(schoolId),
        };

        if (academicYearFilter) {
            filter.academicYear = academicYearFilter;
        }

        const classes = await collection
            .find(filter, {
                projection: {
                    _id: 1,
                    uid: 1,
                    className: 1,
                    section: 1,
                    teacherId: 1,
                    organizationId: 1,
                    schoolId: 1,
                    academicYear: 1,
                    createdAt: 1,
                },
            })
            .sort({ createdAt: -1 })
            .toArray();

        return NextResponse.json({ classes });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to fetch classes.";

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

        const payload = (await request.json()) as CreateClassPayload;

        const className = normalizeString(payload.className).toUpperCase();
        const section = normalizeString(payload.section).toUpperCase();
        const teacherId = normalizeString(payload.teacherId);
        const academicYear = normalizeAcademicYear(payload.academicYear);

        const fieldErrors: Record<string, string> = {};

        if (!className) {
            fieldErrors.className = "Class name is required.";
        }

        if (!sectionPattern.test(section)) {
            fieldErrors.section = "Section must contain only alphabets (A-Z).";
        }

        if (!isValidAcademicYear(academicYear)) {
            fieldErrors.academicYear = "Academic year must be in YYYY-YYYY format (e.g. 2025-2026).";
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

        const classesCollection = database.collection<ClassDocument>(CLASSES_COLLECTION);

        const existingClass = await classesCollection.findOne({
            className,
            section,
            academicYear,
            organizationId: tokenPayload.uid,
            ...buildSchoolScopeQuery(schoolId),
        });

        if (existingClass) {
            return NextResponse.json(
                {
                    message: "Class already exists for this academic year.",
                    fieldErrors: {
                        className: "This class and section already exists for the selected academic year.",
                    },
                },
                { status: 409 },
            );
        }

        const classRecord: ClassDocument = {
            uid: randomUUID(),
            className,
            section,
            teacherId,
            organizationId: tokenPayload.uid,
            schoolId,
            academicYear,
            createdAt: new Date().toISOString().slice(0, 10),
        };

        const result = await classesCollection.insertOne(classRecord);

        return NextResponse.json(
            {
                message: "Class created successfully.",
                class: {
                    _id: result.insertedId.toHexString(),
                    ...classRecord,
                },
            },
            { status: 201 },
        );
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to create class.";

        return NextResponse.json({ message }, { status: 500 });
    }
}
