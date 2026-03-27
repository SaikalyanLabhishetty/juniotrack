"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2, X } from "lucide-react";
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

type StudentsTableProps = {
    emptySubtitle?: string;
};

const PAGE_SIZE = 50;

export function StudentsTable({
    emptySubtitle = "Add your first student using the form above.",
}: StudentsTableProps) {
    const [students, setStudents] = useState<StudentRow[]>([]);
    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [page, setPage] = useState(1);
    const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
    const [modalMode, setModalMode] = useState<"edit" | null>(null);
    const [editForm, setEditForm] = useState({
        name: "",
        dob: "",
        enrollmentNumber: "",
        classId: "",
        parentName: "",
        parentPhone: "",
        parentEmail: "",
        address: "",
    });
    const [isSaving, setIsSaving] = useState(false);

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
            setPage(1);
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

    const openEditModal = (student: StudentRow) => {
        setSelectedStudent(student);
        setEditForm({
            name: student.name,
            dob: student.dob,
            enrollmentNumber: student.enrollmentNumber,
            classId: student.classId,
            parentName: student.parentName,
            parentPhone: student.parentPhone,
            parentEmail: student.parentEmail,
            address: student.address,
        });
        setModalMode("edit");
    };

    const closeModal = () => {
        setSelectedStudent(null);
        setModalMode(null);
    };

    useEffect(() => {
        if (modalMode) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [modalMode]);

    const handleDelete = async (uid: string) => {
        const confirmed = window.confirm("Delete this student?");

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch("/api/organization/students", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    ...getAuthorizationHeader(),
                },
                body: JSON.stringify({ uid }),
            });

            const data = (await response.json()) as { message?: string };

            if (!response.ok) {
                setError(data.message || "Unable to delete student.");
                return;
            }

            await fetchStudents();
        } catch {
            setError("Network error while deleting student.");
        }
    };

    const handleUpdate = async () => {
        if (!selectedStudent) {
            return;
        }

        try {
            setIsSaving(true);

            const response = await fetch("/api/organization/students", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    ...getAuthorizationHeader(),
                },
                body: JSON.stringify({
                    uid: selectedStudent.uid,
                    name: editForm.name,
                    dob: editForm.dob,
                    enrollmentNumber: editForm.enrollmentNumber,
                    classId: editForm.classId,
                    parentName: editForm.parentName,
                    parentPhone: editForm.parentPhone,
                    parentEmail: editForm.parentEmail,
                    address: editForm.address,
                }),
            });

            const data = (await response.json()) as { message?: string };

            if (!response.ok) {
                setError(data.message || "Unable to update student.");
                return;
            }

            closeModal();
            await fetchStudents();
        } catch {
            setError("Network error while updating student.");
        } finally {
            setIsSaving(false);
        }
    };

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
            <div className="rounded-2xl border border-[#f3c3c3] bg-[#fff5f5] px-4 py-3 text-sm text-[#a23232]">
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
                <p className="mt-1 text-xs text-[#8a96ad]">{emptySubtitle}</p>
            </div>
        );
    }

    const totalPages = Math.max(1, Math.ceil(students.length / PAGE_SIZE));
    const startIndex = (page - 1) * PAGE_SIZE;
    const pageItems = students.slice(startIndex, startIndex + PAGE_SIZE);

    return (
        <div className="flex flex-col gap-4">
            <div className="overflow-x-auto rounded-2xl border border-[rgba(18,36,76,0.08)]">
                <table className="w-full min-w-275 border-collapse">
                    <thead>
                        <tr className="border-b border-[rgba(18,36,76,0.06)] bg-[#f8fbff]">
                            <th className={thClassName}>#</th>
                            <th className={thClassName}>Name</th>
                            <th className={thClassName}>Class</th>
                            <th className={thClassName}>Enrollment</th>
                            <th className={thClassName}>Parent</th>
                            <th className={thClassName}>Phone</th>
                            <th className={thClassName}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pageItems.map((student, index) => (
                            <tr
                                key={student._id}
                                className="border-b border-[rgba(18,36,76,0.04)] transition-colors last:border-b-0 hover:bg-[rgba(26,97,255,0.02)]"
                            >
                                <td className={`${tdClassName} font-medium text-[#8a96ad]`}>
                                    {startIndex + index + 1}
                                </td>
                                <td className={`${tdClassName} font-medium`}>{student.name}</td>
                                <td className={tdClassName}>
                                    {classLabelMap.get(student.classId) || student.classId}
                                </td>
                                <td className={tdClassName}>{student.enrollmentNumber}</td>
                                <td className={tdClassName}>{student.parentName}</td>
                                <td className={tdClassName}>{student.parentPhone}</td>
                                <td className={tdClassName}>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => openEditModal(student)}
                                            className="rounded-full border border-[rgba(18,36,76,0.12)] p-2 text-[#4a5a7a] transition hover:text-[#1a61ff]"
                                            aria-label="Edit student"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void handleDelete(student.uid)}
                                            className="rounded-full border border-[rgba(18,36,76,0.12)] p-2 text-[#4a5a7a] transition hover:text-[#c23131]"
                                            aria-label="Delete student"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-1">
                    <p className="text-xs text-[#5e6d8c]">
                        Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, students.length)} of {students.length}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={page === 1}
                            onClick={() => setPage((p) => p - 1)}
                            className="rounded-full border border-[rgba(18,36,76,0.12)] bg-white px-4 py-1.5 text-xs font-semibold text-[#48566f] transition hover:text-[#1a61ff] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Prev
                        </button>
                        <span className="text-xs font-medium text-[#5e6d8c]">
                            {page} / {totalPages}
                        </span>
                        <button
                            type="button"
                            disabled={page === totalPages}
                            onClick={() => setPage((p) => p + 1)}
                            className="rounded-full border border-[rgba(18,36,76,0.12)] bg-white px-4 py-1.5 text-xs font-semibold text-[#48566f] transition hover:text-[#1a61ff] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {modalMode === "edit" && selectedStudent
                ? createPortal(
                    <div
                        className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 p-4"
                        onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
                    >
                        <div className="w-full max-w-2xl rounded-2xl border border-[rgba(18,36,76,0.08)] bg-white shadow-[0_24px_56px_rgba(16,32,68,0.3)] flex flex-col max-h-[90vh]">
                            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[rgba(18,36,76,0.06)] shrink-0">
                                <h3 className="text-base font-semibold text-[#0f1f3a]">
                                    Edit Student
                                </h3>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="rounded-full p-1.5 text-[#5e6d8c] transition hover:bg-[rgba(18,36,76,0.08)]"
                                    aria-label="Close"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="overflow-y-auto p-6">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block text-sm font-medium text-[#1a61ff]">
                                    Student Name
                                    <input
                                        value={editForm.name}
                                        onChange={(event) =>
                                            setEditForm((current) => ({ ...current, name: event.target.value }))
                                        }
                                        className="mt-1.5 w-full rounded-xl border border-[rgba(18,36,76,0.14)] px-3 py-2 text-sm text-[#243552]"
                                        placeholder="Name"
                                    />
                                </label>
                                <label className="block text-sm font-medium text-[#1a61ff]">
                                    Date Of Birth
                                    <input
                                        value={editForm.dob}
                                        onChange={(event) =>
                                            setEditForm((current) => ({ ...current, dob: event.target.value }))
                                        }
                                        className="mt-1.5 w-full rounded-xl border border-[rgba(18,36,76,0.14)] px-3 py-2 text-sm text-[#243552]"
                                        placeholder="DOB"
                                    />
                                </label>
                                <label className="block text-sm font-medium text-[#1a61ff]">
                                    Class
                                    <select
                                        value={editForm.classId}
                                        onChange={(event) =>
                                            setEditForm((current) => ({ ...current, classId: event.target.value }))
                                        }
                                        className="mt-1.5 w-full rounded-xl border border-[rgba(18,36,76,0.14)] px-3 py-2 text-sm text-[#243552]"
                                    >
                                        <option value="">Select class</option>
                                        {classes.map((classItem) => (
                                            <option key={classItem.uid} value={classItem.uid}>
                                                {classItem.className}-{classItem.section} ({classItem.academicYear})
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block text-sm font-medium text-[#1a61ff]">
                                    Enrollment Number
                                    <input
                                        value={editForm.enrollmentNumber}
                                        onChange={(event) =>
                                            setEditForm((current) => ({
                                                ...current,
                                                enrollmentNumber: event.target.value,
                                            }))
                                        }
                                        className="mt-1.5 w-full rounded-xl border border-[rgba(18,36,76,0.14)] px-3 py-2 text-sm text-[#243552]"
                                        placeholder="Enrollment Number"
                                    />
                                </label>
                                <label className="block text-sm font-medium text-[#1a61ff]">
                                    Parent Name
                                    <input
                                        value={editForm.parentName}
                                        onChange={(event) =>
                                            setEditForm((current) => ({
                                                ...current,
                                                parentName: event.target.value,
                                            }))
                                        }
                                        className="mt-1.5 w-full rounded-xl border border-[rgba(18,36,76,0.14)] px-3 py-2 text-sm text-[#243552]"
                                        placeholder="Parent Name"
                                    />
                                </label>
                                <label className="block text-sm font-medium text-[#1a61ff]">
                                    Parent Phone
                                    <input
                                        value={editForm.parentPhone}
                                        onChange={(event) =>
                                            setEditForm((current) => ({
                                                ...current,
                                                parentPhone: event.target.value,
                                            }))
                                        }
                                        className="mt-1.5 w-full rounded-xl border border-[rgba(18,36,76,0.14)] px-3 py-2 text-sm text-[#243552]"
                                        placeholder="Parent Phone"
                                    />
                                </label>
                                <label className="block text-sm font-medium text-[#1a61ff]">
                                    Parent Email
                                    <input
                                        value={editForm.parentEmail}
                                        onChange={(event) =>
                                            setEditForm((current) => ({
                                                ...current,
                                                parentEmail: event.target.value,
                                            }))
                                        }
                                        className="mt-1.5 w-full rounded-xl border border-[rgba(18,36,76,0.14)] px-3 py-2 text-sm text-[#243552]"
                                        placeholder="Parent Email"
                                    />
                                </label>
                                <label className="block text-sm font-medium text-[#1a61ff]">
                                    Address
                                    <input
                                        value={editForm.address}
                                        onChange={(event) =>
                                            setEditForm((current) => ({
                                                ...current,
                                                address: event.target.value,
                                            }))
                                        }
                                        className="mt-1.5 w-full rounded-xl border border-[rgba(18,36,76,0.14)] px-3 py-2 text-sm text-[#243552]"
                                        placeholder="Address"
                                    />
                                </label>
                            </div>

                            </div>
                            <div className="flex justify-end gap-2 border-t border-[rgba(18,36,76,0.06)] px-6 py-4 shrink-0">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="rounded-full border border-[rgba(18,36,76,0.14)] px-4 py-2 text-xs font-semibold text-[#48566f] hover:bg-[rgba(18,36,76,0.04)] transition"
                                >
                                    Close
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleUpdate()}
                                    disabled={isSaving}
                                    className="rounded-full bg-[#1a61ff] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 hover:bg-[#1550dd] transition"
                                >
                                    {isSaving ? "Saving..." : "Update"}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body,
                )
                : null}
        </div>
    );
}
