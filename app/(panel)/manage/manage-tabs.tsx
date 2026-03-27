"use client";

import { useState } from "react";
import { ClassesTable } from "../classes/classes-table";
import { TeachersTable } from "../teachers/teachers-table";
import { StudentsTable } from "../students/students-table";

type ManageTab = "classes" | "teachers" | "students";

const tabs: Array<{ key: ManageTab; label: string }> = [
    { key: "classes", label: "Classes" },
    { key: "teachers", label: "Teachers" },
    { key: "students", label: "Students" },
];

const emptySubtitle = "Create records from the dedicated sections to see them here.";

export function ManageTabs() {
    const [activeTab, setActiveTab] = useState<ManageTab>("classes");

    return (
        <section className="rounded-3xl border border-[rgba(18,36,76,0.08)] bg-white/90 p-6 shadow-[0_16px_40px_rgba(16,32,68,0.06)] backdrop-blur-[6px] sm:p-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#0f1f3a]">
                        Manage Records
                    </h2>
                    <p className="mt-1 text-sm text-[#60708d]">
                        Switch between classes, teachers, and students to review all data.
                    </p>
                </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.key;

                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key)}
                            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                                isActive
                                    ? "bg-[#1a61ff] text-white shadow-[0_12px_24px_rgba(26,97,255,0.25)]"
                                    : "border border-[rgba(18,36,76,0.12)] bg-white text-[#48566f] hover:text-[#1a61ff]"
                            }`}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            <div className="mt-6">
                {activeTab === "classes" ? <ClassesTable emptySubtitle={emptySubtitle} /> : null}
                {activeTab === "teachers" ? <TeachersTable emptySubtitle={emptySubtitle} /> : null}
                {activeTab === "students" ? <StudentsTable emptySubtitle={emptySubtitle} /> : null}
            </div>
        </section>
    );
}
