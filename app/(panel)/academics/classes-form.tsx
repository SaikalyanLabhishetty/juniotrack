"use client";

import { type ChangeEvent, type FormEvent, type KeyboardEvent, useMemo, useState } from "react";
import { getAuthorizationHeader } from "@/lib/client-auth";

type Mode = "single" | "bulk";

type SingleClassFormData = {
    className: string;
    section: string;
    academicYear: string;
};

type BulkClassFormData = {
    count: string;
    className: string;
    sections: string[];
    sectionInput: string;
    academicYear: string;
};

type FormFieldErrors = Partial<Record<string, string>>;

type CreateClassResponse = {
    message?: string;
    fieldErrors?: FormFieldErrors;
};

const inputClassName =
    "mt-2 w-full rounded-[1rem] border border-[rgba(18,36,76,0.12)] bg-[#f8fbff] px-4 py-3 text-sm text-[#10203f] outline-none transition placeholder:text-[#8a96ad] focus:border-[#1a61ff] focus:bg-white focus:shadow-[0_0_0_4px_rgba(26,97,255,0.12)] disabled:cursor-not-allowed disabled:bg-[#eef3fb] disabled:text-[#8a96ad]";

const errorTextClassName = "mt-2 text-xs font-medium text-[#b42318]";

function getDefaultAcademicYear() {
    const currentYear = new Date().getFullYear();
    return `${currentYear}-${currentYear + 1}`;
}

const initialSingleFormData: SingleClassFormData = {
    className: "",
    section: "",
    academicYear: getDefaultAcademicYear(),
};

const initialBulkFormData: BulkClassFormData = {
    count: "1",
    className: "",
    sections: [],
    sectionInput: "",
    academicYear: getDefaultAcademicYear(),
};

function isValidAcademicYear(value: string) {
    const match = value.match(/^(\d{4})-(\d{4})$/);

    if (!match) {
        return false;
    }

    return Number(match[2]) === Number(match[1]) + 1;
}

function normalizeSectionInput(value: string) {
    return value.toUpperCase().replace(/[^A-Z0-9,\s]/g, "");
}

function normalizeSectionValue(value: string) {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function ClassesForm() {
    const [mode, setMode] = useState<Mode>("single");
    const [singleFormData, setSingleFormData] =
        useState<SingleClassFormData>(initialSingleFormData);
    const [bulkFormData, setBulkFormData] =
        useState<BulkClassFormData>(initialBulkFormData);
    const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<{
        tone: "idle" | "error" | "success";
        message: string;
    }>({
        tone: "idle",
        message: "",
    });

    const bulkCountNumber = useMemo(() => Number(bulkFormData.count), [bulkFormData.count]);

    const setModeAndReset = (nextMode: Mode) => {
        setMode(nextMode);
        setFieldErrors({});
        setStatus({ tone: "idle", message: "" });
    };

    const handleSingleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        let nextValue = value;

        if (name === "className" || name === "section") {
            nextValue = nextValue.toUpperCase();
        }

        if (name === "section") {
            nextValue = nextValue.replace(/[^A-Z]/g, "");
        }

        setSingleFormData((current) => ({
            ...current,
            [name]: nextValue,
        }));
    };

    const handleBulkChange = (event: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;

        if (name === "count") {
            const sanitized = value.replace(/\D/g, "");
            setBulkFormData((current) => ({
                ...current,
                count: sanitized,
            }));
            return;
        }

        if (name === "className") {
            setBulkFormData((current) => ({
                ...current,
                className: value.toUpperCase(),
            }));
            return;
        }

        if (name === "sectionInput") {
            setBulkFormData((current) => ({
                ...current,
                sectionInput: normalizeSectionInput(value),
            }));
            return;
        }

        if (name === "academicYear") {
            setBulkFormData((current) => ({
                ...current,
                academicYear: value,
            }));
        }
    };

    const addSectionsFromInput = () => {
        if (!bulkFormData.sectionInput.trim()) {
            return;
        }

        const tokens = bulkFormData.sectionInput
            .split(",")
            .map((token) => normalizeSectionValue(token))
            .filter(Boolean);

        if (tokens.length === 0) {
            setBulkFormData((current) => ({
                ...current,
                sectionInput: "",
            }));
            return;
        }

        setBulkFormData((current) => {
            const nextSections = [...current.sections];
            tokens.forEach((token) => {
                if (!nextSections.includes(token)) {
                    nextSections.push(token);
                }
            });

            return {
                ...current,
                sections: nextSections,
                sectionInput: "",
            };
        });
    };

    const handleBulkSectionKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            if (bulkFormData.sectionInput.trim()) {
                event.preventDefault();
                addSectionsFromInput();
            }
        }
    };

    const removeBulkSection = (section: string) => {
        setBulkFormData((current) => ({
            ...current,
            sections: current.sections.filter((item) => item !== section),
        }));
    };

    const validateSingleForm = () => {
        const errors: FormFieldErrors = {};

        if (!singleFormData.className.trim()) {
            errors.className = "Class name is required.";
        }

        if (!singleFormData.section.trim()) {
            errors.section = "Section is required.";
        }

        if (!isValidAcademicYear(singleFormData.academicYear)) {
            errors.academicYear = "Academic year must be in YYYY-YYYY format (e.g. 2025-2026).";
        }

        return errors;
    };

    const collectBulkSections = () => {
        const inputTokens = bulkFormData.sectionInput
            .split(",")
            .map((token) => normalizeSectionValue(token))
            .filter(Boolean);

        const nextSections = [...bulkFormData.sections];
        inputTokens.forEach((token) => {
            if (!nextSections.includes(token)) {
                nextSections.push(token);
            }
        });

        return nextSections;
    };

    const validateBulkForm = (sectionsOverride?: string[]) => {
        const sections = sectionsOverride ?? bulkFormData.sections;
        const errors: FormFieldErrors = {};

        if (!bulkFormData.count.trim()) {
            errors.count = "Number of classes is required.";
        } else if (bulkCountNumber !== 1) {
            errors.count = "Bulk add currently supports one class at a time.";
        }

        if (!bulkFormData.className.trim()) {
            errors.className = "Class name is required.";
        }

        if (sections.length === 0) {
            errors.sections = "Add at least one section (e.g. 1A, 1B, 1C).";
        }

        if (!isValidAcademicYear(bulkFormData.academicYear)) {
            errors.academicYear = "Academic year must be in YYYY-YYYY format (e.g. 2025-2026).";
        }

        return errors;
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const bulkSections = mode === "bulk" ? collectBulkSections() : [];

        if (mode === "bulk" && bulkFormData.sectionInput.trim()) {
            setBulkFormData((current) => ({
                ...current,
                sections: bulkSections,
                sectionInput: "",
            }));
        }
        const nextErrors =
            mode === "single" ? validateSingleForm() : validateBulkForm(bulkSections);

        setFieldErrors(nextErrors);

        if (Object.values(nextErrors).some(Boolean)) {
            setStatus({
                tone: "error",
                message: "Fix the highlighted fields and submit again.",
            });
            return;
        }

        try {
            setIsSubmitting(true);

            if (mode === "single") {
                const response = await fetch("/api/organization/classes", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...getAuthorizationHeader(),
                    },
                    body: JSON.stringify(singleFormData),
                });

                const responseData = (await response.json()) as CreateClassResponse;

                if (!response.ok) {
                    setStatus({
                        tone: "error",
                        message: responseData.message || "Unable to create class.",
                    });
                    return;
                }

                setSingleFormData((current) => ({
                    ...initialSingleFormData,
                    className: current.className,
                }));
                setFieldErrors({});
                setStatus({
                    tone: "success",
                    message: responseData.message || "Class created successfully.",
                });
                return;
            }

            const className = bulkFormData.className.trim().toUpperCase();
            const sections = bulkSections.map((section) =>
                section.toUpperCase().trim(),
            );

            const payloads = sections.map((sectionValue) => {
                let resolvedClassName = className;
                let resolvedSection = sectionValue;

                if (resolvedClassName && sectionValue.startsWith(resolvedClassName)) {
                    resolvedSection = sectionValue.slice(resolvedClassName.length);
                } else if (!resolvedClassName) {
                    const match = sectionValue.match(/^([0-9A-Z]+?)([A-Z]+)$/);
                    if (match) {
                        resolvedClassName = match[1];
                        resolvedSection = match[2];
                    }
                }

                return {
                    className: resolvedClassName,
                    section: resolvedSection,
                    academicYear: bulkFormData.academicYear,
                };
            });

            const invalidPayload = payloads.find(
                (payload) =>
                    !payload.className ||
                    !payload.section ||
                    !/^[A-Z]+$/.test(payload.section),
            );

            if (invalidPayload) {
                setStatus({
                    tone: "error",
                    message:
                        "Sections must be alphabetic (A-Z). Example: 1A, 1B, 1C.",
                });
                return;
            }

            const responses = await Promise.all(
                payloads.map((payload) =>
                    fetch("/api/organization/classes", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...getAuthorizationHeader(),
                        },
                        body: JSON.stringify(payload),
                    }),
                ),
            );

            const failedIndex = responses.findIndex((response) => !response.ok);

            if (failedIndex >= 0) {
                const responseData = (await responses[failedIndex].json()) as CreateClassResponse;
                setStatus({
                    tone: "error",
                    message: responseData.message || "Unable to create all classes.",
                });
                return;
            }

            setBulkFormData((current) => ({
                ...initialBulkFormData,
                className: current.className,
                academicYear: current.academicYear,
            }));
            setFieldErrors({});
            setStatus({
                tone: "success",
                message: "Classes created successfully.",
            });
        } catch {
            setStatus({
                tone: "error",
                message: "Network error while creating classes.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => setModeAndReset("single")}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${mode === "single"
                        ? "bg-[#1a61ff] text-white shadow-[0_12px_24px_rgba(26,97,255,0.25)]"
                        : "border border-[rgba(18,36,76,0.12)] bg-white text-[#48566f] hover:text-[#1a61ff]"
                        }`}
                >
                    Add Single Class
                </button>
                <button
                    type="button"
                    onClick={() => setModeAndReset("bulk")}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${mode === "bulk"
                        ? "bg-[#1a61ff] text-white shadow-[0_12px_24px_rgba(26,97,255,0.25)]"
                        : "border border-[rgba(18,36,76,0.12)] bg-white text-[#48566f] hover:text-[#1a61ff]"
                        }`}
                >
                    Add Bulk Classes
                </button>
            </div>

            {mode === "single" ? (
                <div className="grid gap-5 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-[#243552]">
                        Class Name
                        <input
                            className={inputClassName}
                            name="className"
                            type="text"
                            value={singleFormData.className}
                            onChange={handleSingleChange}
                            placeholder="Example: 5"
                            required
                        />
                        {fieldErrors.className ? (
                            <p className={errorTextClassName}>{fieldErrors.className}</p>
                        ) : null}
                    </label>

                    <label className="block text-sm font-medium text-[#243552]">
                        Section
                        <input
                            className={inputClassName}
                            name="section"
                            type="text"
                            value={singleFormData.section}
                            onChange={handleSingleChange}
                            placeholder="Example: A"
                            maxLength={3}
                            required
                        />
                        {fieldErrors.section ? (
                            <p className={errorTextClassName}>{fieldErrors.section}</p>
                        ) : null}
                    </label>

                    <label className="block text-sm font-medium text-[#243552] sm:col-span-2">
                        Academic Year
                        <input
                            className={inputClassName}
                            name="academicYear"
                            type="text"
                            value={singleFormData.academicYear}
                            onChange={handleSingleChange}
                            placeholder="2025-2026"
                            required
                        />
                        {fieldErrors.academicYear ? (
                            <p className={errorTextClassName}>{fieldErrors.academicYear}</p>
                        ) : null}
                    </label>
                </div>
            ) : (
                <div className="grid gap-5 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-[#243552]">
                        How Many Classes?
                        <input
                            className={inputClassName}
                            name="count"
                            type="text"
                            value={bulkFormData.count}
                            onChange={handleBulkChange}
                            placeholder="Example: 1"
                            inputMode="numeric"
                            required
                        />
                        {fieldErrors.count ? (
                            <p className={errorTextClassName}>{fieldErrors.count}</p>
                        ) : (
                            <p className="mt-2 text-xs text-[#6b7a96]">
                                For now, bulk add supports one class with multiple sections.
                            </p>
                        )}
                    </label>

                    <label className="block text-sm font-medium text-[#243552]">
                        Class Name
                        <input
                            className={inputClassName}
                            name="className"
                            type="text"
                            value={bulkFormData.className}
                            onChange={handleBulkChange}
                            placeholder="Example: 1"
                            required
                        />
                        {fieldErrors.className ? (
                            <p className={errorTextClassName}>{fieldErrors.className}</p>
                        ) : null}
                    </label>

                    <label className="block text-sm font-medium text-[#243552] sm:col-span-2">
                        Sections (Press Enter to add)
                        <input
                            className={inputClassName}
                            name="sectionInput"
                            type="text"
                            value={bulkFormData.sectionInput}
                            onChange={handleBulkChange}
                            onBlur={addSectionsFromInput}
                            onKeyDown={handleBulkSectionKeyDown}
                            placeholder="Example: 1A, 1B, 1C"
                        />
                        {bulkFormData.sections.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {bulkFormData.sections.map((section) => (
                                    <span
                                        key={section}
                                        className="inline-flex items-center gap-2 rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-semibold text-[#1a61ff]"
                                    >
                                        {section}
                                        <button
                                            type="button"
                                            onClick={() => removeBulkSection(section)}
                                            className="text-[#1a61ff] transition hover:text-[#0f3ea6]"
                                            aria-label={`Remove ${section}`}
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                        ) : null}
                        {fieldErrors.sections ? (
                            <p className={errorTextClassName}>{fieldErrors.sections}</p>
                        ) : null}
                    </label>

                    <label className="block text-sm font-medium text-[#243552] sm:col-span-2">
                        Academic Year
                        <input
                            className={inputClassName}
                            name="academicYear"
                            type="text"
                            value={bulkFormData.academicYear}
                            onChange={handleBulkChange}
                            placeholder="2025-2026"
                            required
                        />
                        {fieldErrors.academicYear ? (
                            <p className={errorTextClassName}>{fieldErrors.academicYear}</p>
                        ) : null}
                    </label>
                </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center rounded-full bg-[#1a61ff] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(26,97,255,0.28)] transition hover:-translate-y-px hover:bg-[#114fe0] disabled:cursor-not-allowed disabled:bg-[#7aa5ff] disabled:shadow-none"
                >
                    {isSubmitting
                        ? mode === "single"
                            ? "Creating..."
                            : "Creating..."
                        : mode === "single"
                            ? "Create Class"
                            : "Create Classes"}
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
