"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2, X } from "lucide-react";
import { getAuthorizationHeader } from "@/lib/client-auth";

type ClassRow = {
    _id: string;
    uid: string;
    className: string;
    section: string;
    teacherId?: string;
    academicYear: string;
    createdAt: string;
};

const thClassName =
    "px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.06em] text-[#5e6d8c]";
const tdClassName = "px-4 py-3 text-sm text-[#243552]";

type ClassesTableProps = {
    emptySubtitle?: string;
};

const PAGE_SIZE = 50;

export function ClassesTable({
    emptySubtitle = "Add your first class using the form above.",
}: ClassesTableProps) {
    const [classes, setClasses] = useState<ClassRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [page, setPage] = useState(1);
    const [selectedClass, setSelectedClass] = useState<ClassRow | null>(null);
    const [modalMode, setModalMode] = useState<"edit" | null>(null);
    const [editForm, setEditForm] = useState({
        className: "",
        section: "",
        teacherId: "",
        academicYear: "",
    });
    const [isSaving, setIsSaving] = useState(false);

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
            setPage(1);
        } catch {
            setError("Network error while fetching classes.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchClasses();
    }, [fetchClasses]);

    const openEditModal = (classItem: ClassRow) => {
        setSelectedClass(classItem);
        setEditForm({
            className: classItem.className,
            section: classItem.section,
            teacherId: classItem.teacherId ?? "",
            academicYear: classItem.academicYear,
        });
        setModalMode("edit");
    };

    const closeModal = () => {
        setSelectedClass(null);
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
        const confirmed = window.confirm("Delete this class?");

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch("/api/organization/classes", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    ...getAuthorizationHeader(),
                },
                body: JSON.stringify({ uid }),
            });

            const data = (await response.json()) as { message?: string };

            if (!response.ok) {
                setError(data.message || "Unable to delete class.");
                return;
            }

            await fetchClasses();
        } catch {
            setError("Network error while deleting class.");
        }
    };

    const handleUpdate = async () => {
        if (!selectedClass) {
            return;
        }

        try {
            setIsSaving(true);
            setError("");

            const response = await fetch("/api/organization/classes", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    ...getAuthorizationHeader(),
                },
                body: JSON.stringify({
                    uid: selectedClass.uid,
                    className: editForm.className,
                    section: editForm.section,
                    teacherId: editForm.teacherId,
                    academicYear: editForm.academicYear,
                }),
            });

            const data = (await response.json()) as { message?: string };

            if (!response.ok) {
                setError(data.message || "Unable to update class.");
                return;
            }

            closeModal();
            await fetchClasses();
        } catch {
            setError("Network error while updating class.");
        } finally {
            setIsSaving(false);
        }
    };

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
            <div className="rounded-2xl border border-[#f3c3c3] bg-[#fff5f5] px-4 py-3 text-sm text-[#a23232]">
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
                <p className="mt-1 text-xs text-[#8a96ad]">{emptySubtitle}</p>
            </div>
        );
    }

    const totalPages = Math.max(1, Math.ceil(classes.length / PAGE_SIZE));
    const startIndex = (page - 1) * PAGE_SIZE;
    const pageItems = classes.slice(startIndex, startIndex + PAGE_SIZE);

    return (
        <div className="flex flex-col gap-4">
            <div className="overflow-x-auto rounded-2xl border border-[rgba(18,36,76,0.08)]">
                <table className="w-full min-w-170 border-collapse">
                    <thead>
                        <tr className="border-b border-[rgba(18,36,76,0.06)] bg-[#f8fbff]">
                            <th className={thClassName}>#</th>
                            <th className={thClassName}>Class</th>
                            <th className={thClassName}>Section</th>
                            <th className={thClassName}>Academic Year</th>
                            <th className={thClassName}>Created</th>
                            <th className={thClassName}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pageItems.map((classItem, index) => (
                            <tr
                                key={classItem._id}
                                className="border-b border-[rgba(18,36,76,0.04)] transition-colors last:border-b-0 hover:bg-[rgba(26,97,255,0.02)]"
                            >
                                <td className={`${tdClassName} font-medium text-[#8a96ad]`}>
                                    {startIndex + index + 1}
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
                                <td className={tdClassName}>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => openEditModal(classItem)}
                                            className="rounded-full border border-[rgba(18,36,76,0.12)] p-2 text-[#4a5a7a] transition hover:text-[#1a61ff]"
                                            aria-label="Edit class"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void handleDelete(classItem.uid)}
                                            className="rounded-full border border-[rgba(18,36,76,0.12)] p-2 text-[#4a5a7a] transition hover:text-[#c23131]"
                                            aria-label="Delete class"
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
                        Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, classes.length)} of {classes.length}
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

            {modalMode === "edit" && selectedClass
                ? createPortal(
                    <div
                        className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 p-4"
                        onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
                    >
                        <div className="w-full max-w-xl rounded-2xl border border-[rgba(18,36,76,0.08)] bg-white shadow-[0_24px_56px_rgba(16,32,68,0.3)] flex flex-col max-h-[90vh]">
                            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[rgba(18,36,76,0.06)] shrink-0">
                                <h3 className="text-base font-semibold text-[#0f1f3a]">
                                    Edit Class
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
                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-[#1a61ff]">
                                    Class Name
                                    <input
                                        value={editForm.className}
                                        onChange={(event) =>
                                            setEditForm((current) => ({
                                                ...current,
                                                className: event.target.value,
                                            }))
                                        }
                                        className="mt-1.5 w-full rounded-xl border border-[rgba(18,36,76,0.14)] px-3 py-2 text-sm text-[#243552]"
                                        placeholder="Class Name"
                                    />
                                </label>
                                <label className="block text-sm font-medium text-[#1a61ff]">
                                    Section
                                    <input
                                        value={editForm.section}
                                        onChange={(event) =>
                                            setEditForm((current) => ({
                                                ...current,
                                                section: event.target.value,
                                            }))
                                        }
                                        className="mt-1.5 w-full rounded-xl border border-[rgba(18,36,76,0.14)] px-3 py-2 text-sm text-[#243552]"
                                        placeholder="Section"
                                    />
                                </label>
                                <label className="block text-sm font-medium text-[#1a61ff]">
                                    Academic Year
                                    <input
                                        value={editForm.academicYear}
                                        onChange={(event) =>
                                            setEditForm((current) => ({
                                                ...current,
                                                academicYear: event.target.value,
                                            }))
                                        }
                                        className="mt-1.5 w-full rounded-xl border border-[rgba(18,36,76,0.14)] px-3 py-2 text-sm text-[#243552]"
                                        placeholder="Academic Year"
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
