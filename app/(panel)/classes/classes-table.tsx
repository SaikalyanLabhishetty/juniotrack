"use client";

import { useCallback, useEffect, useState } from "react";
import { getAuthorizationHeader } from "@/lib/client-auth";

type ClassRow = {
    _id: string;
    uid: string;
    className: string;
    section: string;
    academicYear: string;
    createdAt: string;
};

const thClassName =
    "px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.06em] text-[#5e6d8c]";
const tdClassName = "px-4 py-3 text-sm text-[#243552]";

export function ClassesTable() {
    const [classes, setClasses] = useState<ClassRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchClasses = useCallback(async () => {
        try {
            setIsLoading(true);
            setError("");

            const response = await fetch("/api/organization/classes", {
                headers: {
                    ...getAuthorizationHeader(),
                },
            });

            if (!response.ok) {
                const data = (await response.json()) as { message?: string };
                setError(data.message || "Failed to load classes.");
                return;
            }

            const data = (await response.json()) as { classes: ClassRow[] };
            setClasses(data.classes);
        } catch {
            setError("Network error while fetching classes.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchClasses();
    }, [fetchClasses]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1a61ff] border-t-transparent" />
                <span className="ml-3 text-sm text-[#5e6d8c]">Loading classes...</span>
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

    if (classes.length === 0) {
        return (
            <div className="py-16 text-center">
                <p className="text-sm font-medium text-[#5e6d8c]">
                    No classes found in your organization.
                </p>
                <p className="mt-1 text-xs text-[#8a96ad]">
                    Add your first class using the form above.
                </p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-[1rem] border border-[rgba(18,36,76,0.08)]">
            <table className="w-full min-w-[680px] border-collapse">
                <thead>
                    <tr className="border-b border-[rgba(18,36,76,0.06)] bg-[#f8fbff]">
                        <th className={thClassName}>#</th>
                        <th className={thClassName}>Class</th>
                        <th className={thClassName}>Section</th>
                        <th className={thClassName}>Academic Year</th>
                        <th className={thClassName}>Created</th>
                    </tr>
                </thead>
                <tbody>
                    {classes.map((classItem, index) => (
                        <tr
                            key={classItem._id}
                            className="border-b border-[rgba(18,36,76,0.04)] transition-colors last:border-b-0 hover:bg-[rgba(26,97,255,0.02)]"
                        >
                            <td className={`${tdClassName} font-medium text-[#8a96ad]`}>
                                {index + 1}
                            </td>
                            <td className={`${tdClassName} font-medium`}>
                                {classItem.className}
                            </td>
                            <td className={tdClassName}>{classItem.section}</td>
                            <td className={tdClassName}>{classItem.academicYear}</td>
                            <td className={`${tdClassName} text-[#8a96ad]`}>
                                {new Date(classItem.createdAt).toLocaleDateString("en-IN", {
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
