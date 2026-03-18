"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, LogIn, Plus } from "lucide-react";
import {
  ACCESS_TOKEN_STORAGE_KEY,
  ADD_SCHOOL_ROUTE_INTENT_KEY,
  getAuthorizationHeader,
  getStoredAccessTokenPayload,
} from "@/lib/client-auth";

type SiteHeaderProps = {
  actionHref?: string;
  actionLabel?: string;
  showAction?: boolean;
  showSchoolSwitcher?: boolean;
  title?: string;
  subtitle?: string;
};

type SchoolOption = {
  uid: string;
  label: string;
};

type ProfileResponse = {
  organization?: {
    uid?: string;
    name?: string;
    organizationName?: string;
    schools?: Array<{
      uid?: string;
      schoolName?: string;
      name?: string;
    }>;
  };
};

type SelectSchoolResponse = {
  message?: string;
  accessToken?: string;
};

const ORGANIZATION_SCHOOLS_UPDATED_EVENT = "organization-schools-updated";

export function SiteHeader({
  actionHref = "/login",
  actionLabel = "Login",
  showAction = true,
  showSchoolSwitcher = false,
  title,
  subtitle,
}: SiteHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [organizationId, setOrganizationId] = useState("");
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [isLoadingSchools, setIsLoadingSchools] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const [isSwitchingSchool, setIsSwitchingSchool] = useState(false);
  const [isSchoolMenuOpen, setIsSchoolMenuOpen] = useState(false);
  const [schoolsRefreshTick, setSchoolsRefreshTick] = useState(0);
  const schoolMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleSchoolsUpdated = () => {
      setSchoolsRefreshTick((current) => current + 1);
    };

    window.addEventListener(
      ORGANIZATION_SCHOOLS_UPDATED_EVENT,
      handleSchoolsUpdated,
    );

    return () => {
      window.removeEventListener(
        ORGANIZATION_SCHOOLS_UPDATED_EVENT,
        handleSchoolsUpdated,
      );
    };
  }, []);

  useEffect(() => {
    if (!showSchoolSwitcher) {
      return;
    }

    let isMounted = true;

    async function fetchOrganizationSchools() {
      try {
        setIsLoadingSchools(true);
        setSwitchError("");

        const response = await fetch("/api/organization/profile", {
          headers: {
            ...getAuthorizationHeader(),
          },
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as ProfileResponse;
        const organization = data.organization;

        if (!organization || !isMounted) {
          return;
        }

        const normalizedOrganizationId = (organization.uid || "").trim();
        const schoolOptions =
          Array.isArray(organization.schools) && organization.schools.length > 0
            ? organization.schools
                .map((school) => ({
                  uid: (school.uid || "").trim(),
                  label:
                    (school.schoolName || school.name || "").trim() || "Unnamed School",
                }))
                .filter((school) => school.uid)
            : [
                {
                  uid: normalizedOrganizationId,
                  label:
                    (organization.organizationName || organization.name || "").trim() ||
                    "School",
                },
              ];

        const tokenSchoolId =
          getStoredAccessTokenPayload()?.schoolId?.trim() || "";
        const resolvedSelectedSchool =
          schoolOptions.find((school) => school.uid === tokenSchoolId)?.uid ||
          schoolOptions[0]?.uid ||
          "";

        setOrganizationId(normalizedOrganizationId);
        setSchools(schoolOptions);
        setSelectedSchoolId(resolvedSelectedSchool);
      } catch {
        if (isMounted) {
          setSwitchError("Unable to load schools.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingSchools(false);
        }
      }
    }

    fetchOrganizationSchools();

    return () => {
      isMounted = false;
    };
  }, [showSchoolSwitcher, schoolsRefreshTick]);

  const canShowSwitcher = useMemo(
    () => showSchoolSwitcher && schools.length > 0,
    [showSchoolSwitcher, schools.length],
  );
  const selectedSchoolLabel = useMemo(
    () =>
      schools.find((school) => school.uid === selectedSchoolId)?.label ||
      schools[0]?.label ||
      "Select School",
    [schools, selectedSchoolId],
  );

  useEffect(() => {
    if (!isSchoolMenuOpen) {
      return;
    }

    function handleOutsideClick(event: MouseEvent) {
      if (!schoolMenuRef.current) {
        return;
      }

      const target = event.target as Node | null;

      if (!target || schoolMenuRef.current.contains(target)) {
        return;
      }

      setIsSchoolMenuOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isSchoolMenuOpen]);

  const openAddSchoolRoute = () => {
    if (!organizationId) {
      return;
    }

    sessionStorage.setItem(
      ADD_SCHOOL_ROUTE_INTENT_KEY,
      JSON.stringify({
        organizationId,
        path: pathname,
        timestamp: Date.now(),
      }),
    );

    setIsSchoolMenuOpen(false);
    router.push(`/${organizationId}/addnew`);
  };

  const handleSchoolChange = async (nextSchoolId: string) => {
    if (!nextSchoolId) {
      return;
    }

    if (nextSchoolId === "__add_new_school__") {
      openAddSchoolRoute();
      return;
    }

    if (nextSchoolId === selectedSchoolId) {
      return;
    }

    try {
      setIsSwitchingSchool(true);
      setSwitchError("");

      const response = await fetch("/api/organization/select-school", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthorizationHeader(),
        },
        body: JSON.stringify({
          schoolId: nextSchoolId,
        }),
      });

      const responseData = (await response.json()) as SelectSchoolResponse;

      if (!response.ok || !responseData.accessToken) {
        setSwitchError(responseData.message || "Unable to switch school.");
        return;
      }

      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, responseData.accessToken);
      setSelectedSchoolId(nextSchoolId);
      setIsSchoolMenuOpen(false);
      window.location.reload();
    } catch {
      setSwitchError("Unable to switch school.");
    } finally {
      setIsSwitchingSchool(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[rgba(255,255,255,0.3)] bg-white/60 px-4 py-3 shadow-[0_8px_32px_rgba(16,32,68,0.06)] backdrop-blur-[12px] sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[1100px] items-center justify-between">
        <div className="flex items-center gap-3.5">
          {title ? (
            <div>
              <h1 className="m-0 text-[1.05rem] font-bold tracking-tight text-[#0f1f3a] sm:text-[1.15rem]">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-0.5 hidden text-[0.7rem] font-medium text-[#5e6d8c] sm:block">
                  {subtitle}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="grid h-[2.2rem] w-[2.2rem] place-content-center rounded-[0.7rem] bg-gradient-to-br from-[#1a61ff] to-[#6c8eff] font-semibold text-white shadow-[0_8px_16px_rgba(26,97,255,0.2)]">
                J
              </div>
              <div>
                <p className="m-0 text-[0.95rem] font-bold tracking-tight text-[#0f1f3a]">
                  juniotrack
                </p>
                <span className="mt-0.5 hidden text-[0.68rem] font-medium tracking-[0.01em] text-[#5e6d8c] sm:block">
                  School Progress For Every Parent
                </span>
              </div>
            </>
          )}
        </div>
        {canShowSwitcher ? (
          <div className="flex flex-col items-end gap-1">
            <div className="relative w-[250px]" ref={schoolMenuRef}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-[0.85rem] border border-[rgba(18,36,76,0.12)] bg-white px-3 py-2.5 text-left text-xs font-semibold text-[#10203f] shadow-[0_6px_16px_rgba(16,32,68,0.05)] transition hover:border-[rgba(26,97,255,0.32)] hover:shadow-[0_10px_20px_rgba(16,32,68,0.09)] focus:outline-none focus:ring-4 focus:ring-[rgba(26,97,255,0.14)] disabled:cursor-not-allowed disabled:opacity-75"
                disabled={isLoadingSchools || isSwitchingSchool}
                onClick={() => setIsSchoolMenuOpen((current) => !current)}
                aria-haspopup="menu"
                aria-expanded={isSchoolMenuOpen}
                aria-label="Select school"
              >
                <span className="truncate">
                  {isLoadingSchools ? "Loading schools..." : selectedSchoolLabel}
                </span>
                <ChevronDown
                  size={15}
                  strokeWidth={2.2}
                  className={`shrink-0 text-[#5b6a88] transition-transform ${
                    isSchoolMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isSchoolMenuOpen ? (
                <div className="absolute right-0 top-[calc(100%+8px)] z-[70] w-full overflow-hidden rounded-[0.95rem] border border-[rgba(18,36,76,0.12)] bg-white shadow-[0_22px_46px_rgba(16,32,68,0.16)]">
                  <div className="max-h-64 overflow-y-auto p-1.5">
                    {schools.map((school) => {
                      const isSelected = school.uid === selectedSchoolId;

                      return (
                        <button
                          key={school.uid}
                          type="button"
                          className={`flex w-full items-center justify-between gap-2 rounded-[0.7rem] px-2.5 py-2 text-left text-xs font-semibold transition ${
                            isSelected
                              ? "bg-[rgba(26,97,255,0.1)] text-[#1149bf]"
                              : "text-[#233554] hover:bg-[rgba(18,36,76,0.05)]"
                          }`}
                          onClick={() => void handleSchoolChange(school.uid)}
                        >
                          <span className="truncate">{school.label}</span>
                          {isSelected ? (
                            <Check
                              size={14}
                              strokeWidth={2.8}
                              className="shrink-0"
                            />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  {organizationId ? (
                    <div className="border-t border-[rgba(18,36,76,0.08)] p-1.5">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-[0.7rem] px-2.5 py-2 text-left text-xs font-semibold text-[#174ebf] transition hover:bg-[rgba(26,97,255,0.1)]"
                        onClick={openAddSchoolRoute}
                      >
                        <Plus size={14} strokeWidth={2.7} />
                        Add New School
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            {switchError ? (
              <p className="text-[11px] font-medium text-[#a23232]">{switchError}</p>
            ) : null}
          </div>
        ) : showAction ? (
          <Link
            className="flex items-center gap-2 rounded-full border border-[rgba(18,36,76,0.1)] bg-white/80 px-4 py-2 text-xs font-bold text-[#10203f] no-underline transition-all hover:-translate-y-px hover:border-[rgba(26,97,255,0.3)] hover:bg-white hover:shadow-[0_8px_20px_rgba(26,97,255,0.12)]"
            href={actionHref}
          >
            <LogIn size={14} strokeWidth={2.5} />
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </header>
  );
}
