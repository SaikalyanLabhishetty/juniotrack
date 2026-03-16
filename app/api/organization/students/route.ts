import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { hashPassword } from "@/lib/organization-auth";
import { verifyAccessToken } from "@/lib/verify-access-token";

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

type StudentResponse = StudentDocument & {
    parentName: string;
    parentPhone: string;
    parentEmail: string;
};

type ClassDocument = {
    uid: string;
    organizationId: string;
};

type ParentDocument = {
    uid: string;
    name: string;
    phone: string;
    email: string;
    passwordHash?: string;
    role: "parent";
    organizationId: string;
    status: "active";
    createdAt: string;
    updatedAt: string;
};

type CreateStudentPayload = {
    name?: string;
    dob?: string;
    enrollmentNumber?: string;
    classId?: string;
    parentName?: string;
    parentPhone?: string;
    parentEmail?: string;
    address?: string;
};

const STUDENTS_COLLECTION = "students";
const CLASSES_COLLECTION = "classes";
const USERS_COLLECTION = "users";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\d{10}$/;

function normalizeString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
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

export async function POST(request: Request) {
    try {
        const tokenPayload = await verifyAccessToken(request);

        if (!tokenPayload) {
            return NextResponse.json(
                { message: "Unauthorized. Please login again." },
                { status: 401 },
            );
        }

        const payload = (await request.json()) as CreateStudentPayload;

        const name = normalizeString(payload.name);
        const dob = normalizeString(payload.dob);
        const enrollmentNumber = normalizeString(payload.enrollmentNumber);
        const classId = normalizeString(payload.classId);
        const parentName = normalizeString(payload.parentName);
        const parentPhone = normalizeString(payload.parentPhone);
        const parentEmail = normalizeString(payload.parentEmail).toLowerCase();
        const address = normalizeString(payload.address);

        const fieldErrors: Record<string, string> = {};

        if (!name) {
            fieldErrors.name = "Student name is required.";
        }

        if (!dob) {
            fieldErrors.dob = "Date of birth is required.";
        }

        if (!enrollmentNumber) {
            fieldErrors.enrollmentNumber = "Enrollment number is required.";
        }

        if (!classId) {
            fieldErrors.classId = "Class is required.";
        }

        if (!parentName) {
            fieldErrors.parentName = "Parent name is required.";
        }

        if (!phonePattern.test(parentPhone)) {
            fieldErrors.parentPhone = "Phone number must be exactly 10 digits.";
        }

        if (!emailPattern.test(parentEmail)) {
            fieldErrors.parentEmail = "Enter a valid email address.";
        }

        if (!address) {
            fieldErrors.address = "Address is required.";
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

        const classRecord = await classesCollection.findOne({
            uid: classId,
            organizationId: tokenPayload.uid,
        });

        if (!classRecord) {
            return NextResponse.json(
                {
                    message: "Class not found.",
                    fieldErrors: { classId: "Select a valid class." },
                },
                { status: 400 },
            );
        }

        const existingEnrollment = await studentsCollection.findOne({
            classId,
            enrollmentNumber,
            organizationId: tokenPayload.uid,
        });

        if (existingEnrollment) {
            return NextResponse.json(
                {
                    message: "Enrollment number already exists in this class.",
                    fieldErrors: {
                        enrollmentNumber:
                            "This enrollment number is already assigned in the selected class.",
                    },
                },
                { status: 409 },
            );
        }

        const now = new Date().toISOString();
        const existingParent = await usersCollection.findOne({
            organizationId: tokenPayload.uid,
            role: "parent",
            email: parentEmail,
        });

        let parentId = existingParent?.uid ?? "";

        if (!parentId) {
            const newParent: ParentDocument = {
                uid: randomUUID(),
                name: parentName,
                phone: parentPhone,
                email: parentEmail,
                passwordHash: hashPassword(formatDobPassword(dob)),
                role: "parent",
                organizationId: tokenPayload.uid,
                status: "active",
                createdAt: now,
                updatedAt: now,
            };

            await usersCollection.insertOne(newParent);
            parentId = newParent.uid;
        } else if (existingParent) {
            const parentUpdates: Partial<ParentDocument> = {};

            if (existingParent.name !== parentName) {
                parentUpdates.name = parentName;
            }

            if (existingParent.phone !== parentPhone) {
                parentUpdates.phone = parentPhone;
            }

            if (!existingParent.passwordHash) {
                parentUpdates.passwordHash = hashPassword(formatDobPassword(dob));
            }

            if (Object.keys(parentUpdates).length > 0) {
                parentUpdates.updatedAt = now;

                await usersCollection.updateOne(
                    { uid: existingParent.uid },
                    {
                        $set: parentUpdates,
                    },
                );
            }
        }

        const studentRecord: StudentDocument = {
            uid: randomUUID(),
            name,
            dob,
            enrollmentNumber,
            classId,
            parentId,
            organizationId: tokenPayload.uid,
            address,
            photoUrl: "",
            createdAt: now,
        };

        const result = await studentsCollection.insertOne(studentRecord);

        return NextResponse.json(
            {
                message: "Student added successfully.",
                student: {
                    _id: result.insertedId.toHexString(),
                    ...studentRecord,
                    parentName,
                    parentPhone,
                    parentEmail,
                },
            },
            { status: 201 },
        );
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to add student.";

        return NextResponse.json({ message }, { status: 500 });
    }
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

        const database = await getDatabase();
        const studentsCollection = database.collection<StudentDocument>(
            STUDENTS_COLLECTION,
        );
        const usersCollection = database.collection<ParentDocument>(USERS_COLLECTION);

        const students = await studentsCollection
            .find(
                { organizationId: tokenPayload.uid },
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
            .sort({ createdAt: -1 })
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

        return NextResponse.json({ students: studentsWithParents });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to fetch students.";

        return NextResponse.json({ message }, { status: 500 });
    }
}
