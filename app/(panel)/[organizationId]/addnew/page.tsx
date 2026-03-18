import { AddSchoolForm } from "./add-school-form";

type AddNewSchoolPageProps = {
    params: Promise<{
        organizationId: string;
    }>;
};

export default async function AddNewSchoolPage({
    params,
}: AddNewSchoolPageProps) {
    const { organizationId } = await params;

    return (
        <div className="mt-6">
            <section className="rounded-3xl border border-[rgba(18,36,76,0.08)] bg-white/90 p-6 shadow-[0_16px_40px_rgba(16,32,68,0.06)] backdrop-blur-[6px] sm:p-8">
                <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#0f1f3a]">
                    Add New School
                </h2>
                <p className="mt-1 text-sm text-[#60708d]">
                    Create a school under this organization. After saving, the new
                    school will become the active school.
                </p>
                <AddSchoolForm organizationId={organizationId} />
            </section>
        </div>
    );
}
