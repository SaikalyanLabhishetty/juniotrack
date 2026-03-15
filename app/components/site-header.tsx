import Link from "next/link";

type SiteHeaderProps = {
  actionHref?: string;
  actionLabel?: string;
};

export function SiteHeader({
  actionHref = "/login",
  actionLabel = "Login",
}: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/80 bg-white/65 px-4 py-3 shadow-[0_12px_28px_rgba(16,32,68,0.09)] backdrop-blur-[8px] sm:px-6 lg:px-10 xl:px-16">
      <div className="mx-auto flex w-full max-w-[1160px] items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="grid h-[2.2rem] w-[2.2rem] place-content-center rounded-[0.7rem] bg-gradient-to-br from-[#1a61ff] to-[#6c8eff] font-semibold text-white shadow-[0_12px_20px_rgba(26,97,255,0.25)]">
            J
          </div>
          <div>
            <p className="m-0 text-base font-semibold tracking-[0.01em]">
              juniotrack
            </p>
            <span className="mt-0.5 hidden text-xs tracking-[0.01em] text-[#5e6d8c] sm:block">
              School Progress For Every Parent
            </span>
          </div>
        </div>
        <Link
          className="rounded-full border border-[rgba(18,36,76,0.14)] bg-white px-4 py-2 text-sm font-semibold no-underline transition hover:-translate-y-px hover:border-[rgba(20,72,204,0.32)] hover:shadow-[0_12px_24px_rgba(20,72,204,0.17)] max-sm:px-3 max-sm:text-[0.82rem]"
          href={actionHref}
        >
          {actionLabel}
        </Link>
      </div>
    </header>
  );
}
