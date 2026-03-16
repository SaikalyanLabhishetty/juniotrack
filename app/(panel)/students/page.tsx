import { AddStudentForm } from "../academics/add-student-form";

export default function StudentsPage() {
    return (
        <div className="mt-6">
            <section className="rounded-[1.5rem] border border-[rgba(18,36,76,0.08)] bg-white/90 p-6 shadow-[0_16px_40px_rgba(16,32,68,0.06)] backdrop-blur-[6px] sm:p-8">
                <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#0f1f3a]">
                    Students
                </h2>
                <p className="mt-1 text-sm text-[#60708d]">
                    Add students along with parent information.
                </p>
                <AddStudentForm />
            </section>
        </div>
    );
}
