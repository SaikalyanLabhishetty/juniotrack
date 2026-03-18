"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, GraduationCap, Users, UserRound, LogOut, Settings } from "lucide-react";
import { ACCESS_TOKEN_STORAGE_KEY, getAuthorizationHeader } from "@/lib/client-auth";
import { SiteHeader } from "../components/site-header";

const navItems = [
    {
        label: "Dashboard",
        href: "/dashboard",
        icon: <LayoutDashboard size={18} strokeWidth={2} />,
    },
    {
        label: "Classes",
        href: "/classes",
        icon: <GraduationCap size={18} strokeWidth={2} />,
    },
    {
        label: "Teachers",
        href: "/teachers",
        icon: <Users size={18} strokeWidth={2} />,
    },
    {
        label: "Students",
        href: "/students",
        icon: <UserRound size={18} strokeWidth={2} />,
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

    const isAddSchoolRoute = /^\/[^/]+\/addnew$/.test(pathname);
    const currentRouteInfo = isAddSchoolRoute
        ? {
            title: "Add New School",
            subtitle: "Create a school and attach it to this organization.",
        }
        : Object.entries(routeTitles).find(([route]) =>
            pathname === route || pathname.startsWith(`${route}/`)
        )?.[1] || { title: "Organization Panel", subtitle: "" };

    return (
        <div className="flex min-h-screen">
            <aside className="sticky top-0 flex h-screen w-[260px] shrink-0 flex-col border-r border-[rgba(18,36,76,0.06)] bg-white/70 backdrop-blur-[12px] max-md:w-[72px]">
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
                            <Settings size={18} strokeWidth={2} />
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
                            <LogOut size={18} strokeWidth={2} />
                        </span>
                        <span className="max-md:hidden">Logout</span>
                    </button>
                </div>
            </aside>

            <main className="flex-1">
                <SiteHeader
                    showAction={false}
                    showSchoolSwitcher
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
