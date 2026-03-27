"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2, X } from "lucide-react";
import { getAuthorizationHeader } from "@/lib/client-auth";

type TeacherRow = {
    _id: string;
    uid: string;
    name: string;
    phone: string;
    dob: string;
    classIds: string[];
    classTeacherClassId?: string;
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

type TeachersTableProps = {
    emptySubtitle?: string;
};

const PAGE_SIZE = 50;

export function TeachersTable({
    emptySubtitle = "Add your first teacher using the form above.",
}: TeachersTableProps) {
    const [teachers, setTeachers] = useState<TeacherRow[]>([]);
    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [page, setPage] = useState(1);
    const [selectedTeacher, setSelectedTeacher] = useState<TeacherRow | null>(null);
    const [modalMode, setModalMode] = useState<"edit" | null>(null);
    const [editForm, setEditForm] = useState({
        name: "",
        phone: "",
        dob: "",
        classIds: [] as string[],
        classTeacherClassId: "",
        subjects: "",
        isClassTeacher: false,
    });
    const [isSaving, setIsSaving] = useState(false);

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
            setPage(1);
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

    const openEditModal = (teacher: TeacherRow) => {
        setSelectedTeacher(teacher);
        setEditForm({
            name: teacher.name,
            phone: teacher.phone,
            dob: teacher.dob,
            classIds: teacher.classIds || [],
            classTeacherClassId: teacher.classTeacherClassId ?? "",
            subjects: (teacher.subjects || []).join(","),
            isClassTeacher: Boolean(teacher.isClassTeacher),
        });
        setModalMode("edit");
    };

    const closeModal = () => {
        setSelectedTeacher(null);
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
        const confirmed = window.confirm("Delete this teacher?");

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch("/api/organization/teachers", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    ...getAuthorizationHeader(),
                },
                body: JSON.stringify({ uid }),
            });

            const data = (await response.json()) as { message?: string };

            if (!response.ok) {
                setError(data.message || "Unable to delete teacher.");
                return;
            }

            await fetchTeachers();
        } catch {
            setError("Network error while deleting teacher.");
        }
    };

    const handleUpdate = async () => {
        if (!selectedTeacher) {
            return;
        }

        try {
            setIsSaving(true);

            const subjects = editForm.subjects
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean);

            const response = await fetch("/api/organization/teachers", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    ...getAuthorizationHeader(),
                },
                body: JSON.stringify({
                    uid: selectedTeacher.uid,
                    name: editForm.name,
                    phone: editForm.phone,
                    dob: editForm.dob,
                    classIds: editForm.classIds,
                    classTeacherClassId: editForm.classTeacherClassId,
                    subjects,
                    isClassTeacher: editForm.isClassTeacher,
                }),
            });

            const data = (await response.json()) as { message?: string };

            if (!response.ok) {
                setError(data.message || "Unable to update teacher.");
                return;
            }

            closeModal();
            await fetchTeachers();
        } catch {
            setError("Network error while updating teacher.");
        } finally {
            setIsSaving(false);
        }
    };

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
            <div className="rounded-2xl border border-[#f3c3c3] bg-[#fff5f5] px-4 py-3 text-sm text-[#a23232]">
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
                <p className="mt-1 text-xs text-[#8a96ad]">{emptySubtitle}</p>
            </div>
        );
    }

    const totalPages = Math.max(1, Math.ceil(teachers.length / PAGE_SIZE));
    const startIndex = (page - 1) * PAGE_SIZE;
    const pageItems = teachers.slice(startIndex, startIndex + PAGE_SIZE);

    return (
        <div className="flex flex-col gap-4">
            <div className="overflow-x-auto rounded-2xl border border-[rgba(18,36,76,0.08)]">
                <table className="w-full min-w-245 border-collapse">
                    <thead>
                        <tr className="border-b border-[rgba(18,36,76,0.06)] bg-[#f8fbff]">
                            <th className={thClassName}>#</th>
                            <th className={thClassName}>Name</th>
                            <th className={thClassName}>Phone</th>
                            <th className={thClassName}>Classes</th>
                            <th className={thClassName}>Subjects</th>
                            <th className={thClassName}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pageItems.map((teacher, index) => (
                            <tr
                                key={teacher._id}
                                className="border-b border-[rgba(18,36,76,0.04)] transition-colors last:border-b-0 hover:bg-[rgba(26,97,255,0.02)]"
                            >
                                <td className={`${tdClassName} font-medium text-[#8a96ad]`}>
                                    {startIndex + index + 1}
                                </td>
                                <td className={`${tdClassName} font-medium`}>{teacher.name}</td>
                                <td className={tdClassName}>{teacher.phone}</td>
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
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => openEditModal(teacher)}
                                            className="rounded-full border border-[rgba(18,36,76,0.12)] p-2 text-[#4a5a7a] transition hover:text-[#1a61ff]"
                                            aria-label="Edit teacher"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void handleDelete(teacher.uid)}
                                            className="rounded-full border border-[rgba(18,36,76,0.12)] p-2 text-[#4a5a7a] transition hover:text-[#c23131]"
                                            aria-label="Delete teacher"
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
                        Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, teachers.length)} of {teachers.length}
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

            {modalMode === "edit" && selectedTeacher
                ? createPortal(
                    <div
                        className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 p-4"
                        onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
                    >
                        <div className="w-full max-w-2xl rounded-2xl border border-[rgba(18,36,76,0.08)] bg-white shadow-[0_24px_56px_rgba(16,32,68,0.3)] flex flex-col max-h-[90vh]">
                            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[rgba(18,36,76,0.06)] shrink-0">
                                <h3 className="text-base font-semibold text-[#0f1f3a]">
                                    Edit Teacher
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
                                    Teacher Name
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
                                    Phone
                                    <input
                                        value={editForm.phone}
                                        onChange={(event) =>
                                            setEditForm((current) => ({ ...current, phone: event.target.value }))
                                        }
                                        className="mt-1.5 w-full rounded-xl border border-[rgba(18,36,76,0.14)] px-3 py-2 text-sm text-[#243552]"
                                        placeholder="Phone"
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
                                <div className="rounded-xl border border-[rgba(18,36,76,0.14)] p-3 sm:col-span-2">
                                    <p className="mb-2 text-xs font-semibold text-[#1a61ff]">Classes</p>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {classes.map((classItem) => {
                                            const isChecked = editForm.classIds.includes(classItem.uid);

                                            return (
                                                <label
                                                    key={classItem.uid}
                                                    className="flex items-center gap-2 text-sm text-[#243552]"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={(event) => {
                                                            const checked = event.target.checked;

                                                            setEditForm((current) => {
                                                                const nextClassIds = checked
                                                                    ? [...current.classIds, classItem.uid]
                                                                    : current.classIds.filter(
                                                                          (uid) => uid !== classItem.uid,
                                                                      );

                                                                return {
                                                                    ...current,
                                                                    classIds: nextClassIds,
                                                                    classTeacherClassId: nextClassIds.includes(
                                                                        current.classTeacherClassId,
                                                                    )
                                                                        ? current.classTeacherClassId
                                                                        : "",
                                                                };
                                                            });
                                                        }}
                                                    />
                                                    {classItem.className}-{classItem.section} ({classItem.academicYear})
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                                <label className="block text-sm font-medium text-[#1a61ff]">
                                    Subjects
                                    <input
                                        value={editForm.subjects}
                                        onChange={(event) =>
                                            setEditForm((current) => ({ ...current, subjects: event.target.value }))
                                        }
                                        className="mt-1.5 w-full rounded-xl border border-[rgba(18,36,76,0.14)] px-3 py-2 text-sm text-[#243552]"
                                        placeholder="Subjects (comma-separated)"
                                    />
                                </label>
                                <label className="block text-sm font-medium text-[#1a61ff]">
                                    Class Teacher Assignment
                                    <select
                                        value={editForm.classTeacherClassId}
                                        onChange={(event) =>
                                            setEditForm((current) => ({
                                                ...current,
                                                classTeacherClassId: event.target.value,
                                            }))
                                        }
                                        className="mt-1.5 w-full rounded-xl border border-[rgba(18,36,76,0.14)] px-3 py-2 text-sm text-[#243552]"
                                    >
                                        <option value="">Select class teacher assignment</option>
                                        {editForm.classIds.map((classId) => {
                                            const label = classLabelMap.get(classId) || classId;

                                            return (
                                                <option key={classId} value={classId}>
                                                    {label}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </label>
                                <label className="flex items-center gap-2 text-sm font-medium text-[#1a61ff]">
                                    <input
                                        type="checkbox"
                                        checked={editForm.isClassTeacher}
                                        onChange={(event) =>
                                            setEditForm((current) => ({
                                                ...current,
                                                isClassTeacher: event.target.checked,
                                            }))
                                        }
                                    />
                                    Is Class Teacher
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
