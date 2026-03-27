import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { buildSchoolScopeQuery, resolveSchoolId } from "@/lib/organization-school";
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
    schoolId: string;
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
    schoolId: string;
};

type ParentDocument = {
    uid: string;
    name: string;
    phone: string;
    email: string;
    passwordHash?: string;
    role: "parent";
    organizationId: string;
    schoolId: string;
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

type UpdateStudentPayload = {
    uid?: string;
    name?: string;
    dob?: string;
    enrollmentNumber?: string;
    classId?: string;
    parentName?: string;
    parentPhone?: string;
    parentEmail?: string;
    address?: string;
};

type DeleteStudentPayload = {
    uid?: string;
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

    const dmyMatch = trimmed.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, "0");
        const month = dmyMatch[2].padStart(2, "0");
        return `${day}${month}${dmyMatch[3]}`;
    }

    const digits = trimmed.replace(/\D/g, "");
    if (digits.length === 8) {
        if (/^(19|20)\d{6}$/.test(digits)) {
            return `${digits.slice(6, 8)}${digits.slice(4, 6)}${digits.slice(0, 4)}`;
        }

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
        const studentsCollection = database.collection<StudentDocument>(
            STUDENTS_COLLECTION,
        );
        const usersCollection = database.collection<ParentDocument>(USERS_COLLECTION);

        const classRecord = await classesCollection.findOne({
            uid: classId,
            organizationId: tokenPayload.uid,
            ...buildSchoolScopeQuery(schoolId),
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
            ...buildSchoolScopeQuery(schoolId),
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
            ...buildSchoolScopeQuery(schoolId),
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
                schoolId,
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

            if (existingParent.schoolId !== schoolId) {
                parentUpdates.schoolId = schoolId;
            }

            if (Object.keys(parentUpdates).length > 0) {
                parentUpdates.updatedAt = now;

                await usersCollection.updateOne(
                    { uid: existingParent.uid, organizationId: tokenPayload.uid },
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
            schoolId,
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

        const studentsCollection = database.collection<StudentDocument>(
            STUDENTS_COLLECTION,
        );
        const usersCollection = database.collection<ParentDocument>(USERS_COLLECTION);

        const students = await studentsCollection
            .find(
                {
                    organizationId: tokenPayload.uid,
                    ...buildSchoolScopeQuery(schoolId),
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
                        schoolId: 1,
                        address: 1,
                        photoUrl: 1,
                        createdAt: 1,
                    },
                },
            )
            .sort({ createdAt: -1 })
            .toArray();

        const parentIds = [
            ...new Set(students.map((student) => student.parentId).filter(Boolean)),
        ];
        const parents = parentIds.length
            ? await usersCollection
                  .find(
                      {
                          organizationId: tokenPayload.uid,
                          role: "parent",
                          uid: { $in: parentIds },
                          ...buildSchoolScopeQuery(schoolId),
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

export async function PUT(request: Request) {
    try {
        const tokenPayload = await verifyAccessToken(request);

        if (!tokenPayload) {
            return NextResponse.json(
                { message: "Unauthorized. Please login again." },
                { status: 401 },
            );
        }

        const payload = (await request.json()) as UpdateStudentPayload;

        const uid = normalizeString(payload.uid);
        const name = normalizeString(payload.name);
        const dob = normalizeString(payload.dob);
        const enrollmentNumber = normalizeString(payload.enrollmentNumber);
        const classId = normalizeString(payload.classId);
        const parentName = normalizeString(payload.parentName);
        const parentPhone = normalizeString(payload.parentPhone);
        const parentEmail = normalizeString(payload.parentEmail).toLowerCase();
        const address = normalizeString(payload.address);

        const fieldErrors: Record<string, string> = {};

        if (!uid) {
            fieldErrors.uid = "uid is required.";
        }

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
        const studentsCollection = database.collection<StudentDocument>(
            STUDENTS_COLLECTION,
        );
        const usersCollection = database.collection<ParentDocument>(USERS_COLLECTION);

        const existingStudent = await studentsCollection.findOne({
            uid,
            organizationId: tokenPayload.uid,
            ...buildSchoolScopeQuery(schoolId),
        });

        if (!existingStudent) {
            return NextResponse.json(
                { message: "Student not found." },
                { status: 404 },
            );
        }

        const classRecord = await classesCollection.findOne({
            uid: classId,
            organizationId: tokenPayload.uid,
            ...buildSchoolScopeQuery(schoolId),
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
            uid: { $ne: uid },
            classId,
            enrollmentNumber,
            organizationId: tokenPayload.uid,
            ...buildSchoolScopeQuery(schoolId),
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
        const parentLookup = await usersCollection.findOne({
            organizationId: tokenPayload.uid,
            role: "parent",
            email: parentEmail,
            ...buildSchoolScopeQuery(schoolId),
        });

        let parentId = parentLookup?.uid ?? "";

        if (!parentId) {
            const newParent: ParentDocument = {
                uid: randomUUID(),
                name: parentName,
                phone: parentPhone,
                email: parentEmail,
                passwordHash: hashPassword(formatDobPassword(dob)),
                role: "parent",
                organizationId: tokenPayload.uid,
                schoolId,
                status: "active",
                createdAt: now,
                updatedAt: now,
            };

            await usersCollection.insertOne(newParent);
            parentId = newParent.uid;
        } else {
            await usersCollection.updateOne(
                { uid: parentId, organizationId: tokenPayload.uid },
                {
                    $set: {
                        name: parentName,
                        phone: parentPhone,
                        schoolId,
                        updatedAt: now,
                    },
                    $setOnInsert: {
                        email: parentEmail,
                    },
                },
            );
        }

        await studentsCollection.updateOne(
            {
                uid,
                organizationId: tokenPayload.uid,
                ...buildSchoolScopeQuery(schoolId),
            },
            {
                $set: {
                    name,
                    dob,
                    enrollmentNumber,
                    classId,
                    parentId,
                    schoolId,
                    address,
                },
            },
        );

        return NextResponse.json({ message: "Student updated successfully." });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to update student.";

        return NextResponse.json({ message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const tokenPayload = await verifyAccessToken(request);

        if (!tokenPayload) {
            return NextResponse.json(
                { message: "Unauthorized. Please login again." },
                { status: 401 },
            );
        }

        const payload = (await request.json()) as DeleteStudentPayload;
        const uid = normalizeString(payload.uid);

        if (!uid) {
            return NextResponse.json(
                {
                    message: "Validation failed.",
                    fieldErrors: { uid: "uid is required." },
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

        const studentsCollection = database.collection<StudentDocument>(
            STUDENTS_COLLECTION,
        );

        const result = await studentsCollection.deleteOne({
            uid,
            organizationId: tokenPayload.uid,
            ...buildSchoolScopeQuery(schoolId),
        });

        if (result.deletedCount === 0) {
            return NextResponse.json(
                { message: "Student not found." },
                { status: 404 },
            );
        }

        return NextResponse.json({ message: "Student deleted successfully." });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to delete student.";

        return NextResponse.json({ message }, { status: 500 });
    }
}
