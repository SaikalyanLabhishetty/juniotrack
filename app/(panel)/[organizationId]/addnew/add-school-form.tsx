"use client";

import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    ACCESS_TOKEN_STORAGE_KEY,
    ADD_SCHOOL_ROUTE_INTENT_KEY,
    getAuthorizationHeader,
    getStoredAccessTokenPayload,
} from "@/lib/client-auth";

type AddSchoolFormProps = {
    organizationId: string;
};

type AddSchoolFormData = {
    schoolName: string;
    phone: string;
    state: string;
    district: string;
    pincode: string;
    address: string;
};

type FormFieldErrors = Partial<Record<keyof AddSchoolFormData, string>>;

type CreateSchoolResponse = {
    message?: string;
    school?: {
        uid: string;
    };
    fieldErrors?: FormFieldErrors;
};

type SelectSchoolResponse = {
    message?: string;
    accessToken?: string;
};

const ORGANIZATION_SCHOOLS_UPDATED_EVENT = "organization-schools-updated";

const inputClassName =
    "mt-2 w-full rounded-[1rem] border border-[rgba(18,36,76,0.12)] bg-[#f8fbff] px-4 py-3 text-sm text-[#10203f] outline-none transition placeholder:text-[#8a96ad] focus:border-[#1a61ff] focus:bg-white focus:shadow-[0_0_0_4px_rgba(26,97,255,0.12)] disabled:cursor-not-allowed disabled:bg-[#eef3fb] disabled:text-[#8a96ad]";
const errorTextClassName = "mt-2 text-xs font-medium text-[#b42318]";

const phonePattern = /^\d{10}$/;
const pincodePattern = /^\d{6}$/;
const routeIntentTtlMs = 10 * 60 * 1000;

const initialFormData: AddSchoolFormData = {
    schoolName: "",
    phone: "",
    state: "",
    district: "",
    pincode: "",
    address: "",
};

function validateField(
    name: keyof AddSchoolFormData,
    value: string,
): string | undefined {
    if (name === "schoolName" && !value.trim()) {
        return "School name is required.";
    }

    if (name === "phone" && !phonePattern.test(value)) {
        return "Phone number must be exactly 10 digits.";
    }

    if (name === "state" && !value.trim()) {
        return "State is required.";
    }

    if (name === "district" && !value.trim()) {
        return "District is required.";
    }

    if (name === "pincode" && !pincodePattern.test(value)) {
        return "Pincode must be exactly 6 digits.";
    }

    if (name === "address" && !value.trim()) {
        return "Address is required.";
    }

    return undefined;
}

export function AddSchoolForm({ organizationId }: AddSchoolFormProps) {
    const router = useRouter();
    const [isRouteAllowed, setIsRouteAllowed] = useState(false);
    const [isCheckingRouteAccess, setIsCheckingRouteAccess] = useState(true);
    const [formData, setFormData] = useState<AddSchoolFormData>(initialFormData);
    const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<{
        tone: "idle" | "error" | "success";
        message: string;
    }>({
        tone: "idle",
        message: "",
    });

    useEffect(() => {
        const tokenPayload = getStoredAccessTokenPayload();

        if (!tokenPayload?.uid || tokenPayload.uid !== organizationId) {
            router.replace("/dashboard");
            return;
        }

        try {
            const intentRaw = sessionStorage.getItem(ADD_SCHOOL_ROUTE_INTENT_KEY);

            if (!intentRaw) {
                router.replace("/dashboard");
                return;
            }

            const intent = JSON.parse(intentRaw) as {
                organizationId?: string;
                timestamp?: number;
            };
            const timestamp = Number(intent.timestamp);

            if (
                intent.organizationId !== organizationId ||
                !Number.isFinite(timestamp) ||
                Date.now() - timestamp > routeIntentTtlMs
            ) {
                router.replace("/dashboard");
                return;
            }

            setIsRouteAllowed(true);
        } catch {
            router.replace("/dashboard");
            return;
        } finally {
            setIsCheckingRouteAccess(false);
        }
    }, [organizationId, router]);

    const handleCancel = () => {
        sessionStorage.removeItem(ADD_SCHOOL_ROUTE_INTENT_KEY);
        router.replace("/dashboard");
    };

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        const fieldName = name as keyof AddSchoolFormData;
        let nextValue = value;

        if (fieldName === "phone" || fieldName === "pincode") {
            nextValue = nextValue.replace(/\D/g, "");
        }

        if (fieldName === "phone") {
            nextValue = nextValue.slice(0, 10);
        }

        if (fieldName === "pincode") {
            nextValue = nextValue.slice(0, 6);
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
            schoolName: validateField("schoolName", formData.schoolName),
            phone: validateField("phone", formData.phone),
            state: validateField("state", formData.state),
            district: validateField("district", formData.district),
            pincode: validateField("pincode", formData.pincode),
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

            const createSchoolResponse = await fetch("/api/organization/schools", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...getAuthorizationHeader(),
                },
                body: JSON.stringify(formData),
            });
            const createSchoolData =
                (await createSchoolResponse.json()) as CreateSchoolResponse;

            if (!createSchoolResponse.ok || !createSchoolData.school?.uid) {
                if (createSchoolData.fieldErrors) {
                    setFieldErrors((current) => ({
                        ...current,
                        ...createSchoolData.fieldErrors,
                    }));
                }

                setStatus({
                    tone: "error",
                    message: createSchoolData.message || "Unable to add school.",
                });
                return;
            }

            const selectSchoolResponse = await fetch("/api/organization/select-school", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...getAuthorizationHeader(),
                },
                body: JSON.stringify({
                    schoolId: createSchoolData.school.uid,
                }),
            });
            const selectSchoolData =
                (await selectSchoolResponse.json()) as SelectSchoolResponse;

            if (!selectSchoolResponse.ok || !selectSchoolData.accessToken) {
                setStatus({
                    tone: "error",
                    message:
                        selectSchoolData.message ||
                        "School added but unable to switch to it.",
                });
                return;
            }

            localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, selectSchoolData.accessToken);
            sessionStorage.removeItem(ADD_SCHOOL_ROUTE_INTENT_KEY);
            window.dispatchEvent(new Event(ORGANIZATION_SCHOOLS_UPDATED_EVENT));
            setStatus({
                tone: "success",
                message: "School added successfully. Redirecting...",
            });
            router.replace("/dashboard");
            router.refresh();
        } catch {
            setStatus({
                tone: "error",
                message: "Network error while adding school.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isCheckingRouteAccess) {
        return (
            <div className="mt-6 flex items-center gap-3 text-sm text-[#60708d]">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#1a61ff] border-t-transparent" />
                Verifying access...
            </div>
        );
    }

    if (!isRouteAllowed) {
        return null;
    }

    return (
        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-medium text-[#243552]">
                    School Name
                    <input
                        className={inputClassName}
                        name="schoolName"
                        type="text"
                        value={formData.schoolName}
                        onChange={handleChange}
                        placeholder="Enter school name"
                        required
                    />
                    {fieldErrors.schoolName ? (
                        <p className={errorTextClassName}>{fieldErrors.schoolName}</p>
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
                        placeholder="Enter school phone number"
                        required
                    />
                    {fieldErrors.phone ? (
                        <p className={errorTextClassName}>{fieldErrors.phone}</p>
                    ) : null}
                </label>

                <label className="block text-sm font-medium text-[#243552]">
                    State
                    <input
                        className={inputClassName}
                        name="state"
                        type="text"
                        value={formData.state}
                        onChange={handleChange}
                        placeholder="Enter state"
                        required
                    />
                    {fieldErrors.state ? (
                        <p className={errorTextClassName}>{fieldErrors.state}</p>
                    ) : null}
                </label>

                <label className="block text-sm font-medium text-[#243552]">
                    District
                    <input
                        className={inputClassName}
                        name="district"
                        type="text"
                        value={formData.district}
                        onChange={handleChange}
                        placeholder="Enter district"
                        required
                    />
                    {fieldErrors.district ? (
                        <p className={errorTextClassName}>{fieldErrors.district}</p>
                    ) : null}
                </label>

                <label className="block text-sm font-medium text-[#243552]">
                    Pincode
                    <input
                        className={inputClassName}
                        name="pincode"
                        type="text"
                        value={formData.pincode}
                        onChange={handleChange}
                        placeholder="Enter pincode"
                        required
                    />
                    {fieldErrors.pincode ? (
                        <p className={errorTextClassName}>{fieldErrors.pincode}</p>
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
                        placeholder="Enter school address"
                        required
                    />
                    {fieldErrors.address ? (
                        <p className={errorTextClassName}>{fieldErrors.address}</p>
                    ) : null}
                </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center rounded-full bg-[#1a61ff] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(26,97,255,0.28)] transition hover:-translate-y-px hover:bg-[#114fe0] disabled:cursor-not-allowed disabled:bg-[#7aa5ff] disabled:shadow-none"
                >
                    {isSubmitting ? "Saving..." : "Add School"}
                </button>
                <button
                    type="button"
                    onClick={handleCancel}
                    className="inline-flex items-center justify-center rounded-full border border-[rgba(18,36,76,0.12)] bg-white px-6 py-3 text-sm font-semibold text-[#10203f] transition hover:bg-[#f8fbff]"
                >
                    Cancel
                </button>
            </div>

            {status.message ? (
                <p
                    className={`rounded-[1rem] border px-4 py-3 text-sm ${
                        status.tone === "error"
                            ? "border-[#f3c3c3] bg-[#fff5f5] text-[#a23232]"
                            : "border-[#bddfc7] bg-[#f3fff6] text-[#20683c]"
                    }`}
                >
                    {status.message}
                </p>
            ) : null}
        </form>
    );
}
