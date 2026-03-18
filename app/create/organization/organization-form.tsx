"use client";

import locationData from "@/public/json/states-and-districts.json";
import {
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
  useState,
} from "react";

type OrganizationFormData = {
  name: string;
  email: string;
  phone: string;
  organizationName: string;
  schoolName: string;
  state: string;
  district: string;
  pincode: string;
  address: string;
  password: string;
  confirmPassword: string;
};

type LocationDirectory = {
  states: {
    state: string;
    districts: string[];
  }[];
};

type FormFieldErrors = Partial<Record<keyof OrganizationFormData, string>>;

type CreateOrganizationResponse = {
  message?: string;
  fieldErrors?: FormFieldErrors;
};

const initialFormData: OrganizationFormData = {
  name: "",
  email: "",
  phone: "",
  organizationName: "",
  schoolName: "",
  state: "",
  district: "",
  pincode: "",
  address: "",
  password: "",
  confirmPassword: "",
};

const inputClassName =
  "mt-2 w-full rounded-[1rem] border border-[rgba(18,36,76,0.12)] bg-[#f8fbff] px-4 py-3 text-sm text-[#10203f] outline-none transition placeholder:text-[#8a96ad] focus:border-[#1a61ff] focus:bg-white focus:shadow-[0_0_0_4px_rgba(26,97,255,0.12)] disabled:cursor-not-allowed disabled:bg-[#eef3fb] disabled:text-[#8a96ad]";

const errorTextClassName = "mt-2 text-xs font-medium text-[#b42318]";
const dropdownClassName =
  "absolute left-0 right-0 top-full z-20 mt-2 max-h-56 overflow-y-auto rounded-[1rem] border border-[rgba(18,36,76,0.12)] bg-white p-2 shadow-[0_18px_36px_rgba(16,32,68,0.12)]";
const dropdownButtonClassName =
  "w-full rounded-[0.8rem] px-3 py-2 text-left text-sm text-[#243552] transition hover:bg-[#eef4ff]";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\d{10}$/;
const pincodePattern = /^\d{6}$/;
const stateRecords = (locationData as LocationDirectory).states;

function findStateRecord(stateValue: string) {
  const normalizedState = stateValue.trim().toLowerCase();

  return stateRecords.find(
    (record) => record.state.toLowerCase() === normalizedState,
  );
}

function validateField(
  name: keyof OrganizationFormData,
  value: string,
): string | undefined {
  if (name === "name" && !value.trim()) {
    return "Name is required.";
  }

  if (name === "email" && !emailPattern.test(value.trim())) {
    return "Enter a valid email address.";
  }

  if (name === "phone" && !phonePattern.test(value)) {
    return "Phone number must be exactly 10 digits.";
  }

  if (name === "pincode" && !pincodePattern.test(value)) {
    return "Pincode must be exactly 6 digits.";
  }

  if (name === "address" && !value.trim()) {
    return "Address is required.";
  }

  if (name === "organizationName" && !value.trim()) {
    return "Organization name is required.";
  }

  if (name === "schoolName" && !value.trim()) {
    return "School name is required.";
  }

  return undefined;
}

export function OrganizationForm() {
  const [formData, setFormData] = useState<OrganizationFormData>(initialFormData);
  const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
  const [isStateDropdownOpen, setIsStateDropdownOpen] = useState(false);
  const [isDistrictDropdownOpen, setIsDistrictDropdownOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{
    tone: "idle" | "error" | "success";
    message: string;
  }>({
    tone: "idle",
    message: "",
  });

  const matchedStateRecord = findStateRecord(formData.state);
  const normalizedStateQuery = formData.state.trim().toLowerCase();
  const normalizedDistrictQuery = formData.district.trim().toLowerCase();
  const stateSuggestions = stateRecords
    .filter((record) =>
      record.state.toLowerCase().includes(normalizedStateQuery),
    )
    .slice(0, 12);
  const districtSuggestions = matchedStateRecord
    ? matchedStateRecord.districts
        .filter((district) =>
          district.toLowerCase().includes(normalizedDistrictQuery),
        )
        .slice(0, 12)
    : [];

  const selectState = (state: string) => {
    setFormData((current) => ({
      ...current,
      state,
      district: "",
    }));
    setFieldErrors((current) => ({
      ...current,
      state: undefined,
      district: undefined,
    }));
    setIsStateDropdownOpen(false);
    setIsDistrictDropdownOpen(false);
  };

  const selectDistrict = (district: string) => {
    setFormData((current) => ({
      ...current,
      district,
    }));
    setFieldErrors((current) => ({
      ...current,
      district: undefined,
    }));
    setIsDistrictDropdownOpen(false);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const fieldName = event.target.name as keyof OrganizationFormData;
    let nextValue = event.target.value;

    if (fieldName === "phone" || fieldName === "pincode") {
      nextValue = nextValue.replace(/\D/g, "");
    }

    if (fieldName === "phone") {
      nextValue = nextValue.slice(0, 10);
    }

    if (fieldName === "pincode") {
      nextValue = nextValue.slice(0, 6);
    }

    if (fieldName === "state") {
      setIsStateDropdownOpen(true);
    }

    if (fieldName === "district" && matchedStateRecord) {
      setIsDistrictDropdownOpen(true);
    }

    setFormData((current) => {
      if (fieldName === "state") {
        return {
          ...current,
          state: nextValue,
          district: "",
        };
      }

      return {
        ...current,
        [fieldName]: nextValue,
      };
    });

    setFieldErrors((current) => {
      if (
        fieldName !== "email" &&
        fieldName !== "phone" &&
        fieldName !== "pincode" &&
        fieldName !== "state" &&
        fieldName !== "district" &&
        fieldName !== "name" &&
        fieldName !== "organizationName" &&
        fieldName !== "schoolName" &&
        fieldName !== "address"
      ) {
        return current;
      }

      return {
        ...current,
        [fieldName]:
          fieldName === "state" || fieldName === "district"
            ? undefined
            : validateField(fieldName, nextValue),
        ...(fieldName === "state" ? { district: undefined } : {}),
      };
    });

    if (status.tone !== "idle") {
      setStatus({ tone: "idle", message: "" });
    }
  };

  const handleDropdownBlur = (
    fieldName: "state" | "district",
    event: FocusEvent<HTMLInputElement>,
  ) => {
    const nextFocusedElement = event.relatedTarget as HTMLElement | null;

    if (nextFocusedElement?.dataset.dropdownField === fieldName) {
      return;
    }

    if (fieldName === "state") {
      setIsStateDropdownOpen(false);
      return;
    }

    setIsDistrictDropdownOpen(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const selectedStateRecord = findStateRecord(formData.state);
    const nextFieldErrors: FormFieldErrors = {
      name: validateField("name", formData.name),
      organizationName: validateField(
        "organizationName",
        formData.organizationName,
      ),
      schoolName: validateField("schoolName", formData.schoolName),
      email: validateField("email", formData.email),
      phone: validateField("phone", formData.phone),
      pincode: validateField("pincode", formData.pincode),
      address: validateField("address", formData.address),
      state: selectedStateRecord
        ? undefined
        : "Select a valid state from the suggestions.",
      district: !selectedStateRecord
        ? undefined
        : selectedStateRecord.districts.some(
              (district) =>
                district.toLowerCase() ===
                formData.district.trim().toLowerCase(),
            )
          ? undefined
          : "Select a valid district for the chosen state.",
    };

    setFieldErrors(nextFieldErrors);

    if (Object.values(nextFieldErrors).some(Boolean)) {
      setStatus({
        tone: "error",
        message: "Fix the highlighted fields and submit again.",
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setStatus({
        tone: "error",
        message: "Password and confirm password must match.",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch("/api/organization", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          organizationName: formData.organizationName,
          schoolName: formData.schoolName,
          email: formData.email,
          phone: formData.phone,
          state: formData.state,
          district: formData.district,
          pincode: formData.pincode,
          address: formData.address,
          password: formData.password,
        }),
      });

      const responseData = (await response.json()) as CreateOrganizationResponse;

      if (!response.ok) {
        if (responseData.fieldErrors) {
          setFieldErrors((current) => ({
            ...current,
            ...responseData.fieldErrors,
          }));
        }

        setStatus({
          tone: "error",
          message: responseData.message || "Unable to create organization.",
        });
        return;
      }

      setFormData(initialFormData);
      setFieldErrors({});
      setIsStateDropdownOpen(false);
      setIsDistrictDropdownOpen(false);
      setStatus({
        tone: "success",
        message: responseData.message || "Organization created successfully.",
      });
    } catch {
      setStatus({
        tone: "error",
        message: "Network error while creating the organization.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-4">
        <label className="text-sm font-medium text-[#243552]">
          Name
          <input
            className={inputClassName}
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter your full name"
            autoComplete="name"
            required
          />
          {fieldErrors.name ? (
            <p className={errorTextClassName}>{fieldErrors.name}</p>
          ) : null}
        </label>

        <label className="text-sm font-medium text-[#243552]">
          Email
          <input
            className={inputClassName}
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter your email"
            autoComplete="email"
            required
          />
          {fieldErrors.email ? (
            <p className={errorTextClassName}>{fieldErrors.email}</p>
          ) : null}
        </label>

        <label className="text-sm font-medium text-[#243552]">
          Phone
          <input
            className={inputClassName}
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            placeholder="Enter your phone number"
            autoComplete="tel"
            inputMode="numeric"
            pattern="[0-9]{10}"
            maxLength={10}
            required
          />
          {fieldErrors.phone ? (
            <p className={errorTextClassName}>{fieldErrors.phone}</p>
          ) : null}
        </label>

        <label className="text-sm font-medium text-[#243552]">
          Organization Name
          <input
            className={inputClassName}
            name="organizationName"
            type="text"
            value={formData.organizationName}
            onChange={handleChange}
            placeholder="Enter organization name"
            autoComplete="organization"
            required
          />
          {fieldErrors.organizationName ? (
            <p className={errorTextClassName}>
              {fieldErrors.organizationName}
            </p>
          ) : null}
        </label>

        <label className="text-sm font-medium text-[#243552]">
          School Name
          <input
            className={inputClassName}
            name="schoolName"
            type="text"
            value={formData.schoolName ?? ""}
            onChange={handleChange}
            placeholder="Enter school name"
            required
          />
          {fieldErrors.schoolName ? (
            <p className={errorTextClassName}>
              {fieldErrors.schoolName}
            </p>
          ) : null}
        </label>

        <label className="text-sm font-medium text-[#243552]">
          State
          <div className="relative">
            <input
              className={inputClassName}
              name="state"
              type="text"
              value={formData.state}
              onChange={handleChange}
              onFocus={() => setIsStateDropdownOpen(true)}
              onBlur={(event) => handleDropdownBlur("state", event)}
              placeholder="Type to search state"
              autoComplete="off"
              required
            />
            {isStateDropdownOpen && stateSuggestions.length > 0 ? (
              <div className={dropdownClassName}>
                {stateSuggestions.map((record) => (
                  <button
                    key={record.state}
                    type="button"
                    className={dropdownButtonClassName}
                    data-dropdown-field="state"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectState(record.state);
                    }}
                  >
                    {record.state}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {fieldErrors.state ? (
            <p className={errorTextClassName}>{fieldErrors.state}</p>
          ) : null}
        </label>

        <label className="text-sm font-medium text-[#243552]">
          District
          <div className="relative">
            <input
              className={inputClassName}
              name="district"
              type="text"
              value={formData.district}
              onChange={handleChange}
              onFocus={() => {
                if (matchedStateRecord) {
                  setIsDistrictDropdownOpen(true);
                }
              }}
              onBlur={(event) => handleDropdownBlur("district", event)}
              placeholder={
                matchedStateRecord
                  ? "Type to search district"
                  : "Select a state first"
              }
              autoComplete="off"
              disabled={!matchedStateRecord}
              required
            />
            {isDistrictDropdownOpen && districtSuggestions.length > 0 ? (
              <div className={dropdownClassName}>
                {districtSuggestions.map((district) => (
                  <button
                    key={district}
                    type="button"
                    className={dropdownButtonClassName}
                    data-dropdown-field="district"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectDistrict(district);
                    }}
                  >
                    {district}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {fieldErrors.district ? (
            <p className={errorTextClassName}>{fieldErrors.district}</p>
          ) : null}
        </label>

        <label className="text-sm font-medium text-[#243552]">
          Pincode
          <input
            className={inputClassName}
            name="pincode"
            type="text"
            value={formData.pincode}
            onChange={handleChange}
            placeholder="Enter 6-digit pincode"
            autoComplete="postal-code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
          />
          {fieldErrors.pincode ? (
            <p className={errorTextClassName}>{fieldErrors.pincode}</p>
          ) : null}
        </label>

        <label className="text-sm font-medium text-[#243552]">
          Address
          <input
            className={inputClassName}
            name="address"
            type="text"
            value={formData.address}
            onChange={handleChange}
            placeholder="Enter address"
            autoComplete="street-address"
            required
          />
          {fieldErrors.address ? (
            <p className={errorTextClassName}>{fieldErrors.address}</p>
          ) : null}
        </label>

        <label className="text-sm font-medium text-[#243552]">
          Password
          <input
            className={inputClassName}
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Create a password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          {fieldErrors.password ? (
            <p className={errorTextClassName}>{fieldErrors.password}</p>
          ) : null}
        </label>

        <label className="text-sm font-medium text-[#243552]">
          Confirm Password
          <input
            className={inputClassName}
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="Re-enter your password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-[#60708d]">
          Passwords must be at least 8 characters long.
        </p>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-full bg-[#1a61ff] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(26,97,255,0.28)] transition hover:-translate-y-px hover:bg-[#114fe0] disabled:cursor-not-allowed disabled:bg-[#7aa5ff] disabled:shadow-none"
        >
          {isSubmitting ? "Creating..." : "Create organization"}
        </button>
      </div>

      {status.message ? (
        <p
          className={`rounded-[1rem] border px-4 py-3 text-sm ${
            status.tone === "error"
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
