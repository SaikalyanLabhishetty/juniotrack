"use client";

import { type ChangeEvent, type FormEvent, type KeyboardEvent, useEffect, useState } from "react";
import { getAuthorizationHeader } from "@/lib/client-auth";

type ClassOption = {
    uid: string;
    className: string;
    section: string;
    academicYear: string;
};

type AddTeacherFormData = {
    name: string;
    phone: string;
    dob: string;
    classIds: string[];
    classTeacherClassId: string;
    subjects: string[];
    subjectInput: string;
    isClassTeacher: boolean;
};

type FormFieldErrors = Partial<Record<string, string>>;

type AddTeacherResponse = {
    message?: string;
    fieldErrors?: FormFieldErrors;
};

const inputClassName =
    "mt-2 w-full rounded-[1rem] border border-[rgba(18,36,76,0.12)] bg-[#f8fbff] px-4 py-3 text-sm text-[#10203f] outline-none transition placeholder:text-[#8a96ad] focus:border-[#1a61ff] focus:bg-white focus:shadow-[0_0_0_4px_rgba(26,97,255,0.12)] disabled:cursor-not-allowed disabled:bg-[#eef3fb] disabled:text-[#8a96ad]";

const errorTextClassName = "mt-2 text-xs font-medium text-[#b42318]";

const initialFormData: AddTeacherFormData = {
    name: "",
    phone: "",
    dob: "",
    classIds: [],
    classTeacherClassId: "",
    subjects: [],
    subjectInput: "",
    isClassTeacher: false,
};

function normalizeSubject(value: string) {
    return value.trim();
}

export function AddTeacherForm() {
    const [formData, setFormData] = useState<AddTeacherFormData>(initialFormData);
    const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingClasses, setIsLoadingClasses] = useState(true);
    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [classSearch, setClassSearch] = useState("");
    const [status, setStatus] = useState<{
        tone: "idle" | "error" | "success";
        message: string;
    }>({
        tone: "idle",
        message: "",
    });

    useEffect(() => {
        const fetchClasses = async () => {
            try {
                setIsLoadingClasses(true);

                const response = await fetch("/api/organization/classes", {
                    headers: {
                        ...getAuthorizationHeader(),
                    },
                });

                if (!response.ok) {
                    const data = (await response.json()) as { message?: string };
                    setStatus({
                        tone: "error",
                        message: data.message || "Unable to load classes.",
                    });
                    return;
                }

                const data = (await response.json()) as { classes: ClassOption[] };
                setClasses(data.classes);
            } catch {
                setStatus({
                    tone: "error",
                    message: "Network error while loading classes.",
                });
            } finally {
                setIsLoadingClasses(false);
            }
        };

        fetchClasses();
    }, []);

    const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = event.target;

        if (name === "phone") {
            const sanitized = value.replace(/\D/g, "").slice(0, 10);
            setFormData((current) => ({ ...current, phone: sanitized }));
        } else if (name === "subjectInput") {
            setFormData((current) => ({ ...current, subjectInput: value }));
        } else if (name === "isClassTeacher" && type === "checkbox") {
            const checkbox = event.target as HTMLInputElement;
            setFormData((current) => ({
                ...current,
                isClassTeacher: checkbox.checked,
                classTeacherClassId: checkbox.checked
                    ? current.classTeacherClassId
                    : "",
            }));
        } else {
            setFormData((current) => ({
                ...current,
                [name]: value,
            }));
        }

        if (status.tone !== "idle") {
            setStatus({ tone: "idle", message: "" });
        }
    };

    const filteredClasses = classes.filter((classItem) => {
        if (!classSearch.trim()) {
            return true;
        }

        const query = classSearch.trim().toLowerCase();
        const label = `${classItem.className}-${classItem.section} ${classItem.academicYear}`.toLowerCase();

        return label.includes(query);
    });

    const selectedClassOptions = classes.filter((classItem) =>
        formData.classIds.includes(classItem.uid),
    );

    const toggleClassId = (classId: string) => {
        setFormData((current) => {
            const isSelected = current.classIds.includes(classId);
            const nextClassIds = isSelected
                ? current.classIds.filter((id) => id !== classId)
                : [...current.classIds, classId];
            const nextClassTeacherClassId = nextClassIds.includes(
                current.classTeacherClassId,
            )
                ? current.classTeacherClassId
                : "";

            return {
                ...current,
                classIds: nextClassIds,
                classTeacherClassId: nextClassTeacherClassId,
            };
        });
    };

    const addSubjectFromInput = () => {
        const subject = normalizeSubject(formData.subjectInput);
        if (!subject) {
            return;
        }

        setFormData((current) => ({
            ...current,
            subjects: current.subjects.includes(subject)
                ? current.subjects
                : [...current.subjects, subject],
            subjectInput: "",
        }));
    };

    const handleSubjectKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            addSubjectFromInput();
        }
    };

    const removeSubject = (subject: string) => {
        setFormData((current) => ({
            ...current,
            subjects: current.subjects.filter((item) => item !== subject),
        }));
    };

    const validateForm = () => {
        const errors: FormFieldErrors = {};

        if (!formData.name.trim()) {
            errors.name = "Teacher name is required.";
        }

        if (!/^\d{10}$/.test(formData.phone)) {
            errors.phone = "Phone number must be exactly 10 digits.";
        }

        if (!formData.dob.trim()) {
            errors.dob = "Date of birth is required.";
        }

        if (formData.classIds.length === 0) {
            errors.classIds = "Select at least one class.";
        }

        if (formData.isClassTeacher && !formData.classTeacherClassId) {
            errors.classTeacherClassId = "Select the class teacher assignment.";
        } else if (
            formData.isClassTeacher &&
            !formData.classIds.includes(formData.classTeacherClassId)
        ) {
            errors.classTeacherClassId =
                "Class teacher assignment must be one of the selected classes.";
        }

        return errors;
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const nextFieldErrors = validateForm();
        setFieldErrors(nextFieldErrors);

        if (Object.values(nextFieldErrors).some(Boolean)) {
            setStatus({
                tone: "error",
                message: "Fix the highlighted fields and submit again.",
            });
            return;
        }

        try {
            setIsSubmitting(true);

            const normalizedSubjectInput = normalizeSubject(formData.subjectInput);
            const subjects = normalizedSubjectInput
                ? formData.subjects.includes(normalizedSubjectInput)
                    ? formData.subjects
                    : [...formData.subjects, normalizedSubjectInput]
                : formData.subjects;

            if (normalizedSubjectInput) {
                setFormData((current) => ({
                    ...current,
                    subjects,
                    subjectInput: "",
                }));
            }

            const response = await fetch("/api/organization/teachers", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...getAuthorizationHeader(),
                },
                body: JSON.stringify({
                    name: formData.name,
                    phone: formData.phone,
                    dob: formData.dob,
                    classIds: formData.classIds,
                    classTeacherClassId: formData.classTeacherClassId,
                    subjects,
                    isClassTeacher: formData.isClassTeacher,
                }),
            });

            const responseData = (await response.json()) as AddTeacherResponse;

            if (!response.ok) {
                setStatus({
                    tone: "error",
                    message: responseData.message || "Unable to add teacher.",
                });
                return;
            }

            setFormData((current) => ({
                ...initialFormData,
                classIds: current.classIds,
            }));
            setFieldErrors({});
            setStatus({
                tone: "success",
                message: responseData.message || "Teacher added successfully.",
            });
        } catch {
            setStatus({
                tone: "error",
                message: "Network error while adding teacher.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-medium text-[#243552]">
                    Teacher Name
                    <input
                        className={inputClassName}
                        name="name"
                        type="text"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Enter teacher full name"
                        autoComplete="name"
                        required
                    />
                    {fieldErrors.name ? (
                        <p className={errorTextClassName}>{fieldErrors.name}</p>
                    ) : null}
                </label>

                <label className="block text-sm font-medium text-[#243552]">
                    Phone
                    <input
                        className={inputClassName}
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="Enter 10-digit phone number"
                        inputMode="numeric"
                        maxLength={10}
                        required
                    />
                    {fieldErrors.phone ? (
                        <p className={errorTextClassName}>{fieldErrors.phone}</p>
                    ) : null}
                </label>

                <label className="block text-sm font-medium text-[#243552]">
                    Date of Birth
                    <input
                        className={inputClassName}
                        name="dob"
                        type="date"
                        value={formData.dob}
                        onChange={handleChange}
                        required
                    />
                    {fieldErrors.dob ? (
                        <p className={errorTextClassName}>{fieldErrors.dob}</p>
                    ) : null}
                </label>

                <div className="sm:col-span-2">
                    <p className="text-sm font-medium text-[#243552]">Classes</p>
                    <div
                        className={`mt-2 rounded-[1rem] border bg-white p-4 ${isLoadingClasses || classes.length === 0
                            ? "border-[rgba(18,36,76,0.08)] bg-[#f8fbff]"
                            : "border-[rgba(18,36,76,0.12)]"
                            }`}
                    >
                        <input
                            className={`w-full rounded-[0.85rem] border border-[rgba(18,36,76,0.12)] bg-[#f8fbff] px-4 py-2.5 text-sm text-[#10203f] outline-none transition placeholder:text-[#8a96ad] focus:border-[#1a61ff] focus:bg-white focus:shadow-[0_0_0_4px_rgba(26,97,255,0.12)] ${isLoadingClasses || classes.length === 0
                                ? "cursor-not-allowed opacity-80"
                                : ""
                                }`}
                            type="text"
                            value={classSearch}
                            onChange={(event) => setClassSearch(event.target.value)}
                            placeholder="Search classes"
                            disabled={isLoadingClasses || classes.length === 0}
                        />
                        <div className="mt-3 max-h-52 overflow-y-auto pr-1">
                            {isLoadingClasses ? (
                                <p className="text-sm text-[#8a96ad]">Loading classes...</p>
                            ) : classes.length === 0 ? (
                                <p className="text-sm text-[#8a96ad]">No classes available.</p>
                            ) : filteredClasses.length === 0 ? (
                                <p className="text-sm text-[#8a96ad]">No matching classes.</p>
                            ) : (
                                <div className="space-y-2">
                                    {filteredClasses.map((classItem) => (
                                        <label
                                            key={classItem.uid}
                                            className="flex cursor-pointer items-center gap-3 rounded-[0.75rem] px-3 py-2 transition hover:bg-[#f5f7fb]"
                                        >
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 accent-[#1a61ff]"
                                                checked={formData.classIds.includes(classItem.uid)}
                                                onChange={() => toggleClassId(classItem.uid)}
                                            />
                                            <span className="text-sm text-[#243552]">
                                                {classItem.className}-{classItem.section} (
                                                {classItem.academicYear})
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                        {formData.classIds.length > 0 ? (
                            <p className="mt-3 text-xs font-medium text-[#5e6d8c]">
                                Selected {formData.classIds.length} class
                                {formData.classIds.length > 1 ? "es" : ""}
                            </p>
                        ) : null}
                    </div>
                    {fieldErrors.classIds ? (
                        <p className={errorTextClassName}>{fieldErrors.classIds}</p>
                    ) : null}
                </div>

                <label className="block text-sm font-medium text-[#243552] sm:col-span-2">
                    Subjects (Press Enter to add)
                    <input
                        className={inputClassName}
                        name="subjectInput"
                        type="text"
                        value={formData.subjectInput}
                        onChange={handleChange}
                        onKeyDown={handleSubjectKeyDown}
                        placeholder="Example: Math, Science"
                    />
                    {formData.subjects.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {formData.subjects.map((subject) => (
                                <span
                                    key={subject}
                                    className="inline-flex items-center gap-2 rounded-full bg-[#f6f1ff] px-3 py-1 text-xs font-semibold text-[#6d2cc8]"
                                >
                                    {subject}
                                    <button
                                        type="button"
                                        onClick={() => removeSubject(subject)}
                                        className="text-[#6d2cc8] transition hover:text-[#4c178f]"
                                        aria-label={`Remove ${subject}`}
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                    ) : null}
                </label>

                <label className="block text-sm font-medium text-[#243552] sm:col-span-2">
                    Is Class Teacher?
                    <div className="mt-3 flex items-center gap-3">
                        <input
                            className="h-4 w-4 accent-[#1a61ff]"
                            name="isClassTeacher"
                            type="checkbox"
                            checked={formData.isClassTeacher}
                            onChange={handleChange}
                        />
                        <span className="text-sm text-[#5e6d8c]">Yes, assign as class teacher</span>
                    </div>
                </label>

                {formData.isClassTeacher ? (
                    <label className="block text-sm font-medium text-[#243552] sm:col-span-2">
                        Class Teacher Assignment
                        <select
                            className={inputClassName}
                            name="classTeacherClassId"
                            value={formData.classTeacherClassId}
                            onChange={handleChange}
                            required
                            disabled={selectedClassOptions.length === 0}
                        >
                            <option value="">
                                {selectedClassOptions.length === 0
                                    ? "Select classes above first"
                                    : "Select class teacher assignment"}
                            </option>
                            {selectedClassOptions.map((classItem) => (
                                <option key={classItem.uid} value={classItem.uid}>
                                    {classItem.className}-{classItem.section} (
                                    {classItem.academicYear})
                                </option>
                            ))}
                        </select>
                        {fieldErrors.classTeacherClassId ? (
                            <p className={errorTextClassName}>
                                {fieldErrors.classTeacherClassId}
                            </p>
                        ) : null}
                    </label>
                ) : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <button
                    type="submit"
                    disabled={isSubmitting || isLoadingClasses}
                    className="inline-flex items-center justify-center rounded-full bg-[#1a61ff] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(26,97,255,0.28)] transition hover:-translate-y-px hover:bg-[#114fe0] disabled:cursor-not-allowed disabled:bg-[#7aa5ff] disabled:shadow-none"
                >
                    {isSubmitting ? "Adding..." : "Add Teacher"}
                </button>
            </div>

            {status.message ? (
                <p
                    className={`rounded-2xl border px-4 py-3 text-sm ${status.tone === "error"
                        ? "border-[#f3c3c3] bg-[#fff5f5] text-[#a23232]"
                        : "border-[#bddfc7] bg-[#f3fff6] text-[#20683c]"
                        }`}
                    aria-live="polite"
                >
                    {status.message}
                </p>
            ) : null}
        </form>
    );
}
