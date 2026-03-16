"use client";

import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { getAuthorizationHeader } from "@/lib/client-auth";

type ClassOption = {
    uid: string;
    className: string;
    section: string;
    academicYear: string;
};

type AddStudentFormData = {
    name: string;
    classId: string;
    dob: string;
    enrollmentNumber: string;
    parentName: string;
    parentPhone: string;
    parentEmail: string;
    address: string;
};

type FormFieldErrors = Partial<Record<keyof AddStudentFormData, string>>;

type AddStudentResponse = {
    message?: string;
    fieldErrors?: FormFieldErrors;
};

const inputClassName =
    "mt-2 w-full rounded-[1rem] border border-[rgba(18,36,76,0.12)] bg-[#f8fbff] px-4 py-3 text-sm text-[#10203f] outline-none transition placeholder:text-[#8a96ad] focus:border-[#1a61ff] focus:bg-white focus:shadow-[0_0_0_4px_rgba(26,97,255,0.12)] disabled:cursor-not-allowed disabled:bg-[#eef3fb] disabled:text-[#8a96ad]";

const errorTextClassName = "mt-2 text-xs font-medium text-[#b42318]";

const initialFormData: AddStudentFormData = {
    name: "",
    classId: "",
    dob: "",
    enrollmentNumber: "",
    parentName: "",
    parentPhone: "",
    parentEmail: "",
    address: "",
};

function validateField(
    name: keyof AddStudentFormData,
    value: string,
): string | undefined {
    if (name === "name" && !value.trim()) {
        return "Student name is required.";
    }

    if (name === "classId" && !value.trim()) {
        return "Class is required.";
    }

    if (name === "dob" && !value.trim()) {
        return "Date of birth is required.";
    }

    if (name === "enrollmentNumber" && !value.trim()) {
        return "Enrollment number is required.";
    }

    if (name === "parentName" && !value.trim()) {
        return "Parent name is required.";
    }

    if (name === "parentPhone" && !/^\d{10}$/.test(value)) {
        return "Phone number must be exactly 10 digits.";
    }

    if (name === "parentEmail" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return "Enter a valid email address.";
    }

    if (name === "address" && !value.trim()) {
        return "Address is required.";
    }

    return undefined;
}

export function AddStudentForm() {
    const [formData, setFormData] = useState<AddStudentFormData>(initialFormData);
    const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingClasses, setIsLoadingClasses] = useState(true);
    const [classes, setClasses] = useState<ClassOption[]>([]);
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

                const data = (await response.json()) as {
                    classes: Array<{
                        uid: string;
                        className: string;
                        section: string;
                        academicYear: string;
                    }>;
                };

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

    const handleChange = (
        event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => {
        const { name, value } = event.target;
        const fieldName = name as keyof AddStudentFormData;
        let nextValue = value;

        if (fieldName === "parentPhone") {
            nextValue = nextValue.replace(/\D/g, "").slice(0, 10);
        }

        if (fieldName === "enrollmentNumber") {
            nextValue = nextValue.replace(/\s/g, "");
        }

        setFormData((current) => ({
            ...current,
            [fieldName]: nextValue,
        }));

        setFieldErrors((current) => ({
            ...current,
            [fieldName]: validateField(fieldName, nextValue),
        }));

        if (status.tone !== "idle") {
            setStatus({ tone: "idle", message: "" });
        }
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const nextFieldErrors: FormFieldErrors = {
            name: validateField("name", formData.name),
            classId: validateField("classId", formData.classId),
            dob: validateField("dob", formData.dob),
            enrollmentNumber: validateField(
                "enrollmentNumber",
                formData.enrollmentNumber,
            ),
            parentName: validateField("parentName", formData.parentName),
            parentPhone: validateField("parentPhone", formData.parentPhone),
            parentEmail: validateField("parentEmail", formData.parentEmail),
            address: validateField("address", formData.address),
        };

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

            const response = await fetch("/api/organization/students", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...getAuthorizationHeader(),
                },
                body: JSON.stringify(formData),
            });

            const responseData = (await response.json()) as AddStudentResponse;

            if (!response.ok) {
                if (responseData.fieldErrors) {
                    setFieldErrors((current) => ({
                        ...current,
                        ...responseData.fieldErrors,
                    }));
                }

                setStatus({
                    tone: "error",
                    message: responseData.message || "Unable to add student.",
                });
                return;
            }

            setFormData((current) => ({
                ...initialFormData,
                classId: current.classId,
            }));
            setFieldErrors({});
            setStatus({
                tone: "success",
                message:
                    responseData.message || "Student added successfully.",
            });
        } catch {
            setStatus({
                tone: "error",
                message: "Network error while adding student.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-medium text-[#243552]">
                    Student Name
                    <input
                        className={inputClassName}
                        name="name"
                        type="text"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Enter student full name"
                        autoComplete="name"
                        required
                    />
                    {fieldErrors.name ? (
                        <p className={errorTextClassName}>{fieldErrors.name}</p>
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

                <label className="block text-sm font-medium text-[#243552]">
                    Enrollment Number
                    <input
                        className={inputClassName}
                        name="enrollmentNumber"
                        type="text"
                        value={formData.enrollmentNumber}
                        onChange={handleChange}
                        placeholder="Enter enrollment number"
                        required
                    />
                    {fieldErrors.enrollmentNumber ? (
                        <p className={errorTextClassName}>{fieldErrors.enrollmentNumber}</p>
                    ) : null}
                </label>

                <label className="block text-sm font-medium text-[#243552] sm:col-span-2">
                    Class
                    <select
                        className={inputClassName}
                        name="classId"
                        value={formData.classId}
                        onChange={handleChange}
                        required
                        disabled={isLoadingClasses || classes.length === 0}
                    >
                        <option value="">
                            {isLoadingClasses
                                ? "Loading classes..."
                                : classes.length === 0
                                    ? "No classes available"
                                    : "Select class"}
                        </option>
                        {classes.map((classItem) => (
                            <option key={classItem.uid} value={classItem.uid}>
                                {classItem.className}-{classItem.section} ({classItem.academicYear})
                            </option>
                        ))}
                    </select>
                    {fieldErrors.classId ? (
                        <p className={errorTextClassName}>{fieldErrors.classId}</p>
                    ) : null}
                </label>

                <label className="block text-sm font-medium text-[#243552]">
                    Parent Name
                    <input
                        className={inputClassName}
                        name="parentName"
                        type="text"
                        value={formData.parentName}
                        onChange={handleChange}
                        placeholder="Enter parent name"
                        required
                    />
                    {fieldErrors.parentName ? (
                        <p className={errorTextClassName}>{fieldErrors.parentName}</p>
                    ) : null}
                </label>

                <label className="block text-sm font-medium text-[#243552]">
                    Parent Phone
                    <input
                        className={inputClassName}
                        name="parentPhone"
                        type="tel"
                        value={formData.parentPhone}
                        onChange={handleChange}
                        placeholder="Enter parent phone"
                        inputMode="numeric"
                        maxLength={10}
                        required
                    />
                    {fieldErrors.parentPhone ? (
                        <p className={errorTextClassName}>{fieldErrors.parentPhone}</p>
                    ) : null}
                </label>

                <label className="block text-sm font-medium text-[#243552]">
                    Parent Email
                    <input
                        className={inputClassName}
                        name="parentEmail"
                        type="email"
                        value={formData.parentEmail}
                        onChange={handleChange}
                        placeholder="Enter parent email"
                        autoComplete="email"
                        required
                    />
                    {fieldErrors.parentEmail ? (
                        <p className={errorTextClassName}>{fieldErrors.parentEmail}</p>
                    ) : null}
                </label>

                <label className="block text-sm font-medium text-[#243552] sm:col-span-2">
                    Address
                    <input
                        className={inputClassName}
                        name="address"
                        type="text"
                        value={formData.address}
                        onChange={handleChange}
                        placeholder="Enter parent address"
                        required
                    />
                    {fieldErrors.address ? (
                        <p className={errorTextClassName}>{fieldErrors.address}</p>
                    ) : null}
                </label>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <button
                    type="submit"
                    disabled={isSubmitting || isLoadingClasses || classes.length === 0}
                    className="inline-flex items-center justify-center rounded-full bg-[#1a61ff] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(26,97,255,0.28)] transition hover:-translate-y-px hover:bg-[#114fe0] disabled:cursor-not-allowed disabled:bg-[#7aa5ff] disabled:shadow-none"
                >
                    {isSubmitting ? "Adding..." : "Add Student"}
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
