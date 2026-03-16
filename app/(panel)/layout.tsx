"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ACCESS_TOKEN_STORAGE_KEY, getAuthorizationHeader } from "@/lib/client-auth";
import { SiteHeader } from "../components/site-header";

const navItems = [
    {
        label: "Dashboard",
        href: "/dashboard",
        icon: (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-[18px] w-[18px]"
                aria-hidden
            >
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
        ),
    },
    {
        label: "Classes",
        href: "/classes",
        icon: (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-[18px] w-[18px]"
                aria-hidden
            >
                <path d="M2 7l10-4 10 4-10 4-10-4z" />
                <path d="M6 10.5V15c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.5" />
                <path d="M22 9v6" />
            </svg>
        ),
    },
    {
        label: "Teachers",
        href: "/teachers",
        icon: (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-[18px] w-[18px]"
                aria-hidden
            >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
        ),
    },
    {
        label: "Students",
        href: "/students",
        icon: (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-[18px] w-[18px]"
                aria-hidden
            >
                <path d="M2 7l10-4 10 4-10 4-10-4z" />
                <path d="M6 10.5V15c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.5" />
                <path d="M22 9v6" />
            </svg>
        ),
    },
];

export default function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const pathname = usePathname();

    const routeTitles: Record<string, { title: string; subtitle: string }> = {
        "/dashboard": { title: "Overview", subtitle: "Welcome back. Here is your organization's summary." },
        "/classes": { title: "Classes", subtitle: "Add and manage class sections for your organization." },
        "/teachers": { title: "Teachers", subtitle: "Add and manage teacher records." },
        "/students": { title: "Students", subtitle: "Add and manage student records." },
        "/profile": { title: "Organization Profile", subtitle: "Manage your organization settings and security." },
    };

    const currentRouteInfo = Object.entries(routeTitles).find(([route]) =>
        pathname === route || pathname.startsWith(`${route}/`)
    )?.[1] || { title: "Organization Panel", subtitle: "" };

    return (
        <div className="flex min-h-screen bg-gradient-to-br from-[#edf3ff] via-[#f8fbff] to-[#eef7ff]">
            <aside className="sticky top-0 flex h-screen w-[250px] shrink-0 flex-col border-r border-[rgba(18,36,76,0.08)] bg-white/80 backdrop-blur-[10px] max-md:w-[72px]">
                <div className="flex h-[64px] items-center gap-3 border-b border-[rgba(18,36,76,0.06)] px-5 max-md:justify-center max-md:px-0">
                    <div className="grid h-[2.2rem] w-[2.2rem] shrink-0 place-content-center rounded-[0.7rem] bg-gradient-to-br from-[#1a61ff] to-[#6c8eff] text-sm font-semibold text-white shadow-[0_8px_16px_rgba(26,97,255,0.25)]">
                        J
                    </div>
                    <div className="max-md:hidden">
                        <p className="m-0 text-[0.92rem] font-semibold tracking-[0.01em] text-[#0f1f3a]">
                            juniotrack
                        </p>
                        <span className="text-[0.68rem] tracking-[0.01em] text-[#5e6d8c]">
                            Organization Panel
                        </span>
                    </div>
                </div>

                <nav className="flex-1 space-y-1 px-3 pt-5 max-md:px-2">
                    {navItems.map((item) => {
                        const isActive =
                            item.href === "/dashboard"
                                ? pathname === "/dashboard"
                                : pathname.startsWith(item.href);

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`group flex items-center gap-3 rounded-[0.75rem] px-3 py-[0.62rem] text-[0.88rem] font-medium no-underline transition-all max-md:justify-center max-md:px-0 max-md:py-3 ${isActive
                                    ? "bg-gradient-to-r from-[rgba(26,97,255,0.12)] to-[rgba(26,97,255,0.06)] text-[#1a61ff] shadow-[0_2px_8px_rgba(26,97,255,0.08)]"
                                    : "text-[#4a5a7a] hover:bg-[rgba(26,97,255,0.05)] hover:text-[#1a61ff]"
                                    }`}
                            >
                                <span
                                    className={`shrink-0 transition-colors ${isActive
                                        ? "text-[#1a61ff]"
                                        : "text-[#8a96ad] group-hover:text-[#1a61ff]"
                                        }`}
                                >
                                    {item.icon}
                                </span>
                                <span className="max-md:hidden">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="border-t border-[rgba(18,36,76,0.06)] p-3 max-md:px-2">
                    <Link
                        href="/profile"
                        className={`group flex items-center gap-3 rounded-[0.75rem] px-3 py-[0.62rem] text-[0.88rem] font-medium no-underline transition-all max-md:justify-center max-md:px-0 max-md:py-3 ${pathname === "/profile"
                            ? "bg-gradient-to-r from-[rgba(26,97,255,0.12)] to-[rgba(26,97,255,0.06)] text-[#1a61ff] shadow-[0_2px_8px_rgba(26,97,255,0.08)]"
                            : "text-[#4a5a7a] hover:bg-[rgba(26,97,255,0.05)] hover:text-[#1a61ff]"
                            }`}
                    >
                        <span className={`shrink-0 transition-colors ${pathname === "/profile" ? "text-[#1a61ff]" : "text-[#8a96ad] group-hover:text-[#1a61ff]"}`}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden>
                                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                        </span>
                        <span className="max-md:hidden">Profile</span>
                    </Link>

                    <button
                        onClick={async () => {
                            await fetch("/api/organization/logout", {
                                method: "POST",
                                headers: {
                                    ...getAuthorizationHeader(),
                                },
                            });
                            localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
                            window.location.href = "/login";
                        }}
                        className="mt-1 flex w-full items-center gap-3 rounded-[0.75rem] border-none bg-transparent px-3 py-[0.62rem] text-left text-[0.88rem] font-medium text-[#4a5a7a] outline-none transition-all hover:bg-[rgba(255,71,71,0.08)] hover:text-[#ff4747] max-md:justify-center max-md:px-0 max-md:py-3"
                    >
                        <span className="shrink-0 text-[#8a96ad] transition-colors group-hover:text-[#ff4747]">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden>
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1-2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                        </span>
                        <span className="max-md:hidden">Logout</span>
                    </button>
                </div>
            </aside>

            <main className="flex-1">
                <SiteHeader
                    showAction={false}
                    title={currentRouteInfo.title}
                    subtitle={currentRouteInfo.subtitle}
                />
                <div className="mx-auto w-full max-w-[1100px] px-6 py-8 lg:px-10">
                    {children}
                </div>
            </main>
        </div>
    );
}
