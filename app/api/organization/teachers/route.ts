import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/organization-auth";
import { getDatabase } from "@/lib/mongodb";
import { verifyAccessToken } from "@/lib/verify-access-token";

type TeacherDocument = {
    uid: string;
    name: string;
    phone: string;
    email: string;
    passwordHash: string;
    role: "teacher";
    organizationId: string;
    status: "active";
    createdAt: string;
    updatedAt: string;
    dob: string;
    classIds: string[];
    classTeacherClassId: string;
    subjects: string[];
    isClassTeacher: boolean;
};

type CreateTeacherPayload = {
    name?: string;
    phone?: string;
    dob?: string;
    classIds?: string[];
    classTeacherClassId?: string;
    subjects?: string[];
    isClassTeacher?: boolean;
};

const COLLECTION_NAME = "users";
const phonePattern = /^\d{10}$/;

function normalizeString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
}

function formatDobPassword(value: string) {
    const trimmed = value.trim();
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        return `${isoMatch[3]}${isoMatch[2]}${isoMatch[1]}`;
    }

    const digits = trimmed.replace(/\D/g, "");
    if (digits.length === 8) {
        return digits;
    }

    return digits;
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

        const database = await getDatabase();
        const collection = database.collection<TeacherDocument>(COLLECTION_NAME);

        const teachers = await collection
            .find(
                {
                    organizationId: tokenPayload.uid,
                    role: "teacher",
                },
                {
                    projection: {
                        _id: 1,
                        uid: 1,
                        name: 1,
                        phone: 1,
                        dob: 1,
                        classIds: 1,
                        classTeacherClassId: 1,
                        subjects: 1,
                        isClassTeacher: 1,
                        createdAt: 1,
                        status: 1,
                    },
                },
            )
            .sort({ createdAt: -1 })
            .toArray();

        return NextResponse.json({ teachers });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to fetch teachers.";

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

        const payload = (await request.json()) as CreateTeacherPayload;
        const name = normalizeString(payload.name);
        const phone = normalizeString(payload.phone);
        const dob = normalizeString(payload.dob);
        const classIds = normalizeArray(payload.classIds);
        const classTeacherClassId = normalizeString(payload.classTeacherClassId);
        const subjects = normalizeArray(payload.subjects);
        const isClassTeacher = Boolean(payload.isClassTeacher);

        const fieldErrors: Record<string, string> = {};

        if (!name) {
            fieldErrors.name = "Teacher name is required.";
        }

        if (!phonePattern.test(phone)) {
            fieldErrors.phone = "Phone number must be exactly 10 digits.";
        }

        if (!dob) {
            fieldErrors.dob = "Date of birth is required.";
        }

        if (classIds.length === 0) {
            fieldErrors.classIds = "Select at least one class.";
        }

        if (isClassTeacher && !classTeacherClassId) {
            fieldErrors.classTeacherClassId = "Select the class teacher assignment.";
        } else if (isClassTeacher && !classIds.includes(classTeacherClassId)) {
            fieldErrors.classTeacherClassId =
                "Class teacher assignment must be one of the selected classes.";
        }

        if (Object.keys(fieldErrors).length > 0) {
            return NextResponse.json(
                { message: "Validation failed.", fieldErrors },
                { status: 400 },
            );
        }

        const database = await getDatabase();
        const collection = database.collection<TeacherDocument>(COLLECTION_NAME);

        const now = new Date().toISOString();
        const teacher: TeacherDocument = {
            uid: randomUUID(),
            name,
            phone,
            email: "",
            passwordHash: hashPassword(formatDobPassword(dob)),
            role: "teacher",
            organizationId: tokenPayload.uid,
            status: "active",
            createdAt: now,
            updatedAt: now,
            dob,
            classIds,
            classTeacherClassId: isClassTeacher ? classTeacherClassId : "",
            subjects,
            isClassTeacher,
        };

        const result = await collection.insertOne(teacher);

        return NextResponse.json(
            {
                message: "Teacher added successfully.",
                teacher: {
                    _id: result.insertedId.toHexString(),
                    uid: teacher.uid,
                    name: teacher.name,
                    phone: teacher.phone,
                    dob: teacher.dob,
                    classIds: teacher.classIds,
                    classTeacherClassId: teacher.classTeacherClassId,
                    subjects: teacher.subjects,
                    isClassTeacher: teacher.isClassTeacher,
                    status: teacher.status,
                    createdAt: teacher.createdAt,
                },
            },
            { status: 201 },
        );
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to add teacher.";

        return NextResponse.json({ message }, { status: 500 });
    }
}
