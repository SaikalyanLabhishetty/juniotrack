"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAuthorizationHeader } from "@/lib/client-auth";

type TeacherRow = {
    _id: string;
    uid: string;
    name: string;
    phone: string;
    dob: string;
    classIds: string[];
    subjects: string[];
    isClassTeacher: boolean;
    status: string;
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

export function TeachersTable() {
    const [teachers, setTeachers] = useState<TeacherRow[]>([]);
    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchTeachers = useCallback(async () => {
        try {
            setIsLoading(true);
            setError("");

            const [teachersResponse, classesResponse] = await Promise.all([
                fetch("/api/organization/teachers", {
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

            if (!teachersResponse.ok) {
                const data = (await teachersResponse.json()) as { message?: string };
                setError(data.message || "Failed to load teachers.");
                return;
            }

            if (!classesResponse.ok) {
                const data = (await classesResponse.json()) as { message?: string };
                setError(data.message || "Failed to load classes.");
                return;
            }

            const teachersData = (await teachersResponse.json()) as {
                teachers: TeacherRow[];
            };
            const classesData = (await classesResponse.json()) as {
                classes: ClassOption[];
            };

            setTeachers(teachersData.teachers);
            setClasses(classesData.classes);
        } catch {
            setError("Network error while fetching teachers.");
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
        fetchTeachers();
    }, [fetchTeachers]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1a61ff] border-t-transparent" />
                <span className="ml-3 text-sm text-[#5e6d8c]">Loading teachers...</span>
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

    if (teachers.length === 0) {
        return (
            <div className="py-16 text-center">
                <p className="text-sm font-medium text-[#5e6d8c]">
                    No teachers found in your organization.
                </p>
                <p className="mt-1 text-xs text-[#8a96ad]">
                    Add your first teacher using the form above.
                </p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-[1rem] border border-[rgba(18,36,76,0.08)]">
            <table className="w-full min-w-[980px] border-collapse">
                <thead>
                    <tr className="border-b border-[rgba(18,36,76,0.06)] bg-[#f8fbff]">
                        <th className={thClassName}>#</th>
                        <th className={thClassName}>Name</th>
                        <th className={thClassName}>Phone</th>
                        <th className={thClassName}>DOB</th>
                        <th className={thClassName}>Classes</th>
                        <th className={thClassName}>Subjects</th>
                        <th className={thClassName}>Class Teacher</th>
                        <th className={thClassName}>Created</th>
                    </tr>
                </thead>
                <tbody>
                    {teachers.map((teacher, index) => (
                        <tr
                            key={teacher._id}
                            className="border-b border-[rgba(18,36,76,0.04)] transition-colors last:border-b-0 hover:bg-[rgba(26,97,255,0.02)]"
                        >
                            <td className={`${tdClassName} font-medium text-[#8a96ad]`}>
                                {index + 1}
                            </td>
                            <td className={`${tdClassName} font-medium`}>{teacher.name}</td>
                            <td className={tdClassName}>{teacher.phone}</td>
                            <td className={tdClassName}>
                                {teacher.dob
                                    ? new Date(teacher.dob).toLocaleDateString("en-IN", {
                                          day: "2-digit",
                                          month: "short",
                                          year: "numeric",
                                      })
                                    : "-"}
                            </td>
                            <td className={tdClassName}>
                                {(Array.isArray(teacher.classIds)
                                    ? teacher.classIds
                                          .map(
                                              (classId) =>
                                                  classLabelMap.get(classId) || classId,
                                          )
                                          .join(", ")
                                    : "") || "-"}
                            </td>
                            <td className={tdClassName}>
                                {teacher.subjects?.length ? teacher.subjects.join(", ") : "-"}
                            </td>
                            <td className={tdClassName}>
                                {teacher.isClassTeacher ? "Yes" : "No"}
                            </td>
                            <td className={`${tdClassName} text-[#8a96ad]`}>
                                {new Date(teacher.createdAt).toLocaleDateString("en-IN", {
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
