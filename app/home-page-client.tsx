"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import gsap from "gsap";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SiteHeader } from "./components/site-header";

type HomePageClientProps = {
  initialHasAccessToken: boolean;
};

const features = [
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[18px] w-[18px]"
        aria-hidden
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M8 2v4M16 2v4M3 10h18" />
        <path d="m9 15 2 2 4-4" />
      </svg>
    ),
    title: "Attendance",
    description: "See daily attendance status as soon as it is marked.",
    detail: "No waiting for end-of-week summaries.",
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[18px] w-[18px]"
        aria-hidden
      >
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    title: "Homework",
    description: "Track assignments and submission deadlines in one feed.",
    detail: "Keep study routines consistent at home.",
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[18px] w-[18px]"
        aria-hidden
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 17v-3M12 17v-5M16 17v-2" />
      </svg>
    ),
    title: "Reports",
    description: "Access school reports with clear progress insights.",
    detail: "Support your child before small gaps grow.",
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[18px] w-[18px]"
        aria-hidden
      >
        <circle cx="12" cy="8.5" r="3.5" />
        <path d="M8.5 12 7 21l5-3 5 3-1.5-9" />
      </svg>
    ),
    title: "Marks",
    description: "Monitor marks unit by unit and term by term.",
    detail: "Spot learning trends early and act quickly.",
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[18px] w-[18px]"
        aria-hidden
      >
        <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
        <path d="M9 17a3 3 0 0 0 6 0" />
      </svg>
    ),
    title: "Announcements",
    description: "Receive school notices instantly with priority highlights.",
    detail: "Never miss events, exams, or policy updates.",
  },
];

const steps = [
  {
    number: "01",
    title: "Teachers post updates quickly",
    description:
      "Attendance, homework, marks, and reports are shared from a single workflow.",
  },
  {
    number: "02",
    title: "Parents get real-time visibility",
    description:
      "Juniotrack sends updates immediately so families stay aligned with school days.",
  },
  {
    number: "03",
    title: "Progress becomes actionable",
    description:
      "Use reports and announcements to guide your child with better timing and clarity.",
  },
];

const metrics = [
  { value: "24/7", label: "Parent Visibility" },
  { value: "1 Feed", label: "Daily School Updates" },
  { value: "5+", label: "Core Tracking Areas" },
];

const ease = [0.22, 1, 0.36, 1] as const;

export function HomePageClient({ initialHasAccessToken }: HomePageClientProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  const [hasAccessToken, setHasAccessToken] = useState(initialHasAccessToken);

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      try {
        const response = await fetch("/api/organization/profile", {
          cache: "no-store",
        });

        if (isMounted) {
          setHasAccessToken(response.ok);
        }
      } catch {
        if (isMounted) {
          setHasAccessToken(false);
        }
      }
    };

    checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.set(".hero-badge", { y: 24, autoAlpha: 0 });
      gsap.set(".hero-title-line", { y: 56, autoAlpha: 0 });
      gsap.set(".hero-subheading", { y: 20, autoAlpha: 0 });
      gsap.set(".hero-cta", { y: 18, autoAlpha: 0 });
      gsap.set(".hero-metric", { y: 14, autoAlpha: 0 });
      gsap.set(".hero-image-block", { y: 40, autoAlpha: 0 });

      const introTimeline = gsap.timeline({
        defaults: { duration: 0.75, ease: "power3.out" },
      });

      introTimeline
        .to(".hero-badge", { y: 0, autoAlpha: 1, duration: 0.5 })
        .to(".hero-title-line", { y: 0, autoAlpha: 1, stagger: 0.14 }, "-=0.2")
        .to(".hero-subheading", { y: 0, autoAlpha: 1, duration: 0.6 }, "-=0.35")
        .to(".hero-cta", { y: 0, autoAlpha: 1, stagger: 0.12, duration: 0.5 }, "-=0.35")
        .to(".hero-metric", { y: 0, autoAlpha: 1, stagger: 0.08, duration: 0.42 }, "-=0.25")
        .to(".hero-image-block", { y: 0, autoAlpha: 1, duration: 0.65 }, "-=0.45");

      gsap.to(".ambient-orb", {
        x: () => gsap.utils.random(-18, 18),
        y: () => gsap.utils.random(-24, 24),
        rotation: () => gsap.utils.random(-8, 8),
        duration: () => gsap.utils.random(4.8, 7),
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        stagger: { each: 0.55, from: "random" },
      });
    }, pageRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={pageRef}
      className="relative flex min-h-screen flex-col overflow-x-hidden bg-gradient-to-br from-[#edf3ff] via-[#f8fbff] to-[#eef7ff] pt-0 text-[#0f1f3a] [text-rendering:optimizeLegibility]"
    >
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-25 [background-image:radial-gradient(rgba(15,31,58,0.035)_0.8px,transparent_0.8px)] [background-size:3px_3px]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden>
        <span className="ambient-orb absolute -right-20 -top-[90px] h-80 w-80 rounded-full opacity-60 blur-[1px] [background:radial-gradient(circle_at_30%_30%,rgba(70,156,255,0.68),rgba(70,156,255,0.14))]" />
        <span className="ambient-orb absolute -left-[95px] top-[42%] h-[220px] w-[220px] rounded-full opacity-60 blur-[1px] [background:radial-gradient(circle_at_30%_30%,rgba(89,217,200,0.55),rgba(89,217,200,0.1))]" />
        <span className="ambient-orb absolute bottom-[8%] right-[15%] h-[180px] w-[180px] rounded-full opacity-60 blur-[1px] [background:radial-gradient(circle_at_25%_25%,rgba(124,170,255,0.48),rgba(124,170,255,0.08))]" />
      </div>

      <SiteHeader
        actionHref={hasAccessToken ? "/dashboard" : "/login"}
        actionLabel={hasAccessToken ? "Go to App" : "Login"}
      />

      <main className="relative z-[3] mx-auto w-full max-w-[1160px] flex-1 px-4 sm:px-6 lg:px-10 xl:px-0">
        <section className="mt-10 grid items-center gap-8 lg:grid-cols-[1.06fr_0.94fr]">
          <div>
            <p className="hero-badge m-0 w-fit rounded-full border border-[rgba(26,97,255,0.22)] bg-[rgba(26,97,255,0.14)] px-[0.78rem] py-[0.4rem] text-[0.76rem] font-bold uppercase tracking-[0.04em] text-[#1a4cc8] opacity-0">
              Parent + Teacher Sync, Day by Day
            </p>
            <h1 className="mt-[1.1rem] text-[clamp(2rem,4.3vw,4rem)] leading-[1.04] tracking-[-0.03em]">
              <span className="hero-title-line opacity-0">Stay Connected to Your</span>
              <span className="hero-title-line opacity-0">Child&apos;s School Journey</span>
            </h1>
            <p className="hero-subheading m-0 max-w-[44ch] text-[clamp(1rem,1.55vw,1.2rem)] leading-[1.65] text-[#32405e] opacity-0">
              Juniotrack keeps parents and teachers connected with real-time
              updates on attendance, homework, reports, and announcements.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <motion.a
                href={hasAccessToken ? "/dashboard" : "#features"}
                className="hero-cta inline-flex h-[2.9rem] items-center justify-center rounded-[0.85rem] bg-gradient-to-br from-[#1a61ff] to-[#1348cc] px-[1.15rem] text-[0.94rem] font-[650] text-white no-underline shadow-[0_16px_28px_rgba(19,72,204,0.3)] opacity-0"
                whileHover={{ y: -3, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                {hasAccessToken ? "Go to App" : "Start With Juniotrack"}
              </motion.a>
              <motion.a
                href="#daily-flow"
                className="hero-cta inline-flex h-[2.9rem] items-center justify-center rounded-[0.85rem] border border-[rgba(18,36,76,0.14)] bg-white px-[1.15rem] text-[0.94rem] font-[650] text-[#0f1f3a] no-underline opacity-0"
                whileHover={{ y: -3, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                See Daily Flow
              </motion.a>
            </div>

            <div className="mt-[1.45rem] grid max-w-[620px] grid-cols-1 gap-[0.6rem] md:grid-cols-3">
              {metrics.map((metric) => (
                <div
                  className="hero-metric rounded-[0.9rem] border border-[rgba(18,36,76,0.14)] bg-white/70 px-[0.85rem] py-[0.8rem] opacity-0"
                  key={metric.label}
                >
                  <strong className="block text-[1.08rem] tracking-[-0.02em]">
                    {metric.value}
                  </strong>
                  <span className="text-[0.78rem] font-[550] text-[#5e6d8c]">
                    {metric.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <aside className="hero-image-block w-full max-w-[560px] justify-self-start opacity-0 lg:max-w-[540px] lg:justify-self-end">
            <Image
              src="/assets/kid.png"
              alt="A student using Juniotrack to stay connected with school updates"
              width={560}
              height={716}
              priority
              className="block h-auto w-full bg-transparent mix-blend-multiply"
            />
          </aside>
        </section>

        <section id="features" className="mt-12 sm:mt-16 lg:mt-24">
          <motion.div
            className="max-w-none"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.55, ease }}
          >
            <p className="m-0 whitespace-nowrap text-[0.78rem] font-bold uppercase tracking-[0.06em] text-[#2253be]">
              Everything Important, In One View
            </p>
            <h2 className="mt-3 whitespace-nowrap text-[2rem] leading-[1.16] tracking-[-0.02em] md:text-[2.1rem] lg:text-[2.2rem]">
              Built for reliable school-parent communication.
            </h2>
          </motion.div>

          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {features.map((feature, index) => (
              <motion.article
                key={feature.title}
                className="rounded-2xl border border-white/95 bg-gradient-to-br from-white/95 to-white/75 px-4 py-4 shadow-[0_12px_28px_rgba(16,32,68,0.09)]"
                initial={{ opacity: 0, y: 26 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{
                  duration: 0.55,
                  delay: index * 0.08,
                  ease,
                }}
                whileHover={{ y: -8, scale: 1.01 }}
              >
                <span className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-[0.62rem] bg-gradient-to-br from-[#1c6bff] to-[#4a90ff] text-white">
                  {feature.icon}
                </span>
                <h3 className="m-0 text-base font-semibold">{feature.title}</h3>
                <p className="m-0 mt-2.5 text-[0.9rem] leading-[1.55] text-[#32405e]">
                  {feature.description}
                </p>
                <small className="mt-2.5 block text-[0.76rem] font-[650] text-[#2c509a]">
                  {feature.detail}
                </small>
              </motion.article>
            ))}
          </div>
        </section>

        <section id="daily-flow" className="mt-12 sm:mt-16 lg:mt-24">
          <motion.div
            className="max-w-none"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.55, ease }}
          >
            <p className="m-0 whitespace-nowrap text-[0.78rem] font-bold uppercase tracking-[0.06em] text-[#2253be]">
              How Juniotrack Works
            </p>
            <h2 className="mt-3 whitespace-nowrap text-[2rem] leading-[1.16] tracking-[-0.02em] md:text-[2.1rem] lg:text-[2.2rem]">
              A clear loop from classroom actions to parent support.
            </h2>
          </motion.div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <motion.article
                key={step.number}
                className="rounded-2xl border border-[rgba(22,45,101,0.12)] bg-gradient-to-br from-white/95 to-[#f2f8ff]/85 p-4"
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{
                  duration: 0.6,
                  delay: index * 0.12,
                  ease,
                }}
              >
                <span className="inline-flex h-[2.3rem] min-w-[2.3rem] items-center justify-center rounded-[0.65rem] bg-[rgba(68,209,190,0.22)] text-[0.82rem] font-extrabold text-[#1f7f84]">
                  {step.number}
                </span>
                <h3 className="m-0 mt-3 text-[1.05rem] font-semibold">{step.title}</h3>
                <p className="m-0 mt-2 text-[0.9rem] leading-[1.58] text-[#32405e]">
                  {step.description}
                </p>
              </motion.article>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative z-[3] mt-16 border-t border-[rgba(18,36,76,0.1)] bg-white/65">
        <div className="mx-auto w-full max-w-[1160px] px-4 py-6 text-center text-sm text-[#5e6d8c] sm:px-6 lg:px-10 xl:px-0">
          © {new Date().getFullYear()} juniotrack. All rights reserved.
        </div>
      </footer>
    </div>
  );
}