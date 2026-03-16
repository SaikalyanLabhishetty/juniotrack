import { type NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { verifyAccessToken } from "@/lib/verify-access-token";

type ClassDocument = {
    uid: string;
    className: string;
    section: string;
    teacherId: string;
    organizationId: string;
    academicYear: string;
    createdAt: string;
};

type StudentDocument = {
    uid: string;
    name: string;
    dob: string;
    enrollmentNumber: string;
    classId: string;
    parentId: string;
    organizationId: string;
    address: string;
    photoUrl: string;
    createdAt: string;
};

type ParentDocument = {
    uid: string;
    name: string;
    phone: string;
    email: string;
    role: "parent";
    organizationId: string;
};

type StudentResponse = StudentDocument & {
    parentName: string;
    parentPhone: string;
    parentEmail: string;
};

const CLASSES_COLLECTION = "classes";
const STUDENTS_COLLECTION = "students";
const USERS_COLLECTION = "users";

function normalizeString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
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

        const className = normalizeString(
            request.nextUrl.searchParams.get("className"),
        ).toUpperCase();
        const section = normalizeString(
            request.nextUrl.searchParams.get("section"),
        ).toUpperCase();
        const academicYear = normalizeString(
            request.nextUrl.searchParams.get("academicYear"),
        );

        const fieldErrors: Record<string, string> = {};

        if (!className) {
            fieldErrors.className = "className is required.";
        }

        if (!section || !/^[A-Z]+$/.test(section)) {
            fieldErrors.section = "section is required and must contain only alphabets (A-Z).";
        }

        if (academicYear && !/^(\d{4})-(\d{4})$/.test(academicYear)) {
            fieldErrors.academicYear = "academicYear must be in YYYY-YYYY format (e.g. 2025-2026).";
        }

        if (Object.keys(fieldErrors).length > 0) {
            return NextResponse.json(
                { message: "Validation failed.", fieldErrors },
                { status: 400 },
            );
        }

        const database = await getDatabase();
        const classesCollection = database.collection<ClassDocument>(CLASSES_COLLECTION);
        const studentsCollection = database.collection<StudentDocument>(
            STUDENTS_COLLECTION,
        );
        const usersCollection = database.collection<ParentDocument>(USERS_COLLECTION);

        let classRecord: ClassDocument | null = null;

        if (academicYear) {
            classRecord = await classesCollection.findOne({
                organizationId: tokenPayload.uid,
                className,
                section,
                academicYear,
            });
        } else {
            classRecord = await classesCollection.findOne(
                {
                    organizationId: tokenPayload.uid,
                    className,
                    section,
                },
                {
                    sort: {
                        createdAt: -1,
                    },
                },
            );
        }

        if (!classRecord) {
            return NextResponse.json(
                {
                    message: "Class not found for this organization.",
                    fieldErrors: {
                        className: "No matching class found.",
                        section: "No matching class found.",
                    },
                },
                { status: 404 },
            );
        }

        const students = await studentsCollection
            .find(
                {
                    organizationId: tokenPayload.uid,
                    classId: classRecord.uid,
                },
                {
                    projection: {
                        _id: 1,
                        uid: 1,
                        name: 1,
                        dob: 1,
                        enrollmentNumber: 1,
                        classId: 1,
                        parentId: 1,
                        organizationId: 1,
                        address: 1,
                        photoUrl: 1,
                        createdAt: 1,
                    },
                },
            )
            .sort({ enrollmentNumber: 1 })
            .toArray();

        const parentIds = [...new Set(students.map((student) => student.parentId).filter(Boolean))];
        const parents = parentIds.length
            ? await usersCollection
                  .find(
                      {
                          organizationId: tokenPayload.uid,
                          role: "parent",
                          uid: { $in: parentIds },
                      },
                      {
                          projection: {
                              uid: 1,
                              name: 1,
                              phone: 1,
                              email: 1,
                          },
                      },
                  )
                  .toArray()
            : [];

        const parentMap = new Map(parents.map((parent) => [parent.uid, parent]));
        const studentsWithParents: StudentResponse[] = students.map((student) => {
            const parent = parentMap.get(student.parentId);

            return {
                ...student,
                parentName: parent?.name ?? "",
                parentPhone: parent?.phone ?? "",
                parentEmail: parent?.email ?? "",
            };
        });

        return NextResponse.json({
            class: {
                uid: classRecord.uid,
                className: classRecord.className,
                section: classRecord.section,
                teacherId: classRecord.teacherId,
                organizationId: classRecord.organizationId,
                academicYear: classRecord.academicYear,
                createdAt: classRecord.createdAt,
            },
            students: studentsWithParents,
        });
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Unable to fetch students by class.";

        return NextResponse.json({ message }, { status: 500 });
    }
}
