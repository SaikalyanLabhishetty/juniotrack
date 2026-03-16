import { ClassesForm } from "./classes-form";

export default function ClassesPage() {
    return (
        <div className="mt-6">
            <section className="rounded-3xl border border-[rgba(18,36,76,0.08)] bg-white/90 p-6 shadow-[0_16px_40px_rgba(16,32,68,0.06)] backdrop-blur-[6px] sm:p-8">
                <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#0f1f3a]">
                    Classes
                </h2>
                <p className="mt-1 text-sm text-[#60708d]">
                    Add single or bulk classes for the academic year.
                </p>
                <ClassesForm />
            </section>
        </div>
    );
}
