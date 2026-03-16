"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAuthorizationHeader } from "@/lib/client-auth";

type StudentRow = {
    _id: string;
    uid: string;
    name: string;
    dob: string;
    enrollmentNumber: string;
    classId: string;
    parentName: string;
    parentPhone: string;
    parentEmail: string;
    address: string;
    createdAt: string;
};

type ClassOption = {
    uid: string;
    className: string;
    section: string;
    academicYear: string;
};

const thClassName =
    "px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.06em] text-[#5e6d8c]";
const tdClassName = "px-4 py-3 text-sm text-[#243552]";

export function StudentsTable() {
    const [students, setStudents] = useState<StudentRow[]>([]);
    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchStudents = useCallback(async () => {
        try {
            setIsLoading(true);
            setError("");

            const [studentsResponse, classesResponse] = await Promise.all([
                fetch("/api/organization/students", {
                    headers: {
                        ...getAuthorizationHeader(),
                    },
                }),
                fetch("/api/organization/classes", {
                    headers: {
                        ...getAuthorizationHeader(),
                    },
                }),
            ]);

            if (!studentsResponse.ok) {
                const data = (await studentsResponse.json()) as { message?: string };
                setError(data.message || "Failed to load students.");
                return;
            }

            if (!classesResponse.ok) {
                const data = (await classesResponse.json()) as { message?: string };
                setError(data.message || "Failed to load classes.");
                return;
            }

            const studentsData = (await studentsResponse.json()) as {
                students: StudentRow[];
            };
            const classesData = (await classesResponse.json()) as {
                classes: ClassOption[];
            };

            setStudents(studentsData.students);
            setClasses(classesData.classes);
        } catch {
            setError("Network error while fetching students.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    const classLabelMap = useMemo(() => {
        return new Map(
            classes.map((classItem) => [
                classItem.uid,
                `${classItem.className}-${classItem.section} (${classItem.academicYear})`,
            ]),
        );
    }, [classes]);

    useEffect(() => {
        fetchStudents();
    }, [fetchStudents]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1a61ff] border-t-transparent" />
                <span className="ml-3 text-sm text-[#5e6d8c]">Loading students...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-[1rem] border border-[#f3c3c3] bg-[#fff5f5] px-4 py-3 text-sm text-[#a23232]">
                {error}
            </div>
        );
    }

    if (students.length === 0) {
        return (
            <div className="py-16 text-center">
                <p className="text-sm font-medium text-[#5e6d8c]">
                    No students found in your organization.
                </p>
                <p className="mt-1 text-xs text-[#8a96ad]">
                    Add your first student using the form above.
                </p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-[1rem] border border-[rgba(18,36,76,0.08)]">
            <table className="w-full min-w-[1100px] border-collapse">
                <thead>
                    <tr className="border-b border-[rgba(18,36,76,0.06)] bg-[#f8fbff]">
                        <th className={thClassName}>#</th>
                        <th className={thClassName}>Name</th>
                        <th className={thClassName}>Class</th>
                        <th className={thClassName}>Enrollment #</th>
                        <th className={thClassName}>DOB</th>
                        <th className={thClassName}>Parent</th>
                        <th className={thClassName}>Phone</th>
                        <th className={thClassName}>Email</th>
                        <th className={thClassName}>Address</th>
                        <th className={thClassName}>Created</th>
                    </tr>
                </thead>
                <tbody>
                    {students.map((student, index) => (
                        <tr
                            key={student._id}
                            className="border-b border-[rgba(18,36,76,0.04)] transition-colors last:border-b-0 hover:bg-[rgba(26,97,255,0.02)]"
                        >
                            <td className={`${tdClassName} font-medium text-[#8a96ad]`}>
                                {index + 1}
                            </td>
                            <td className={`${tdClassName} font-medium`}>{student.name}</td>
                            <td className={tdClassName}>
                                {classLabelMap.get(student.classId) || student.classId}
                            </td>
                            <td className={tdClassName}>{student.enrollmentNumber}</td>
                            <td className={tdClassName}>
                                {student.dob
                                    ? new Date(student.dob).toLocaleDateString("en-IN", {
                                          day: "2-digit",
                                          month: "short",
                                          year: "numeric",
                                      })
                                    : "-"}
                            </td>
                            <td className={tdClassName}>{student.parentName}</td>
                            <td className={tdClassName}>{student.parentPhone}</td>
                            <td className={tdClassName}>{student.parentEmail}</td>
                            <td className={tdClassName}>{student.address}</td>
                            <td className={`${tdClassName} text-[#8a96ad]`}>
                                {new Date(student.createdAt).toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                })}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
