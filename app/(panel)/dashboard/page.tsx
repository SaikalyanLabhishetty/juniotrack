import DashboardClient from "./DashboardClient";

export default function DashboardPage() {
  return (
    <>
      <h1 className="text-[clamp(1.8rem,3.5vw,2.4rem)] font-semibold tracking-[-0.03em] text-[#0f1f3a]">
        Overview
      </h1>
      <p className="mt-2 max-w-[50ch] text-sm leading-6 text-[#60708d]">
        Welcome back. Here is your organization&apos;s summary.
      </p>

      <DashboardClient />
    </>
  );
}
