"use client";

import { useState } from "react";
import Link from "next/link";
import { Brand, languageButton } from "./components/ui";

import { copy } from "./home-content";

export default function Home() {
  const [locale, setLocale] = useState<"es" | "en">("es");
  const t = copy[locale];

  return (
    <main className="home-stripe min-h-screen bg-paper px-0 pb-0">
      <button
        className={`${languageButton} absolute top-[31px] right-[max(30px,calc((100vw-900px)/2))] z-10`}
        type="button"
        onClick={() => setLocale(locale === "es" ? "en" : "es")}
      >
        {t.language}
      </button>
      <section className="mx-auto grid min-h-[50vh] max-w-[960px] content-center px-[30px] pt-[70px] pb-[34px] text-left max-md:min-h-[48vh] max-md:px-5 max-md:pt-[66px] max-md:pb-7">
        <Brand className="mb-[31px]" />
        <p className="mb-3 w-max bg-safety px-2 py-1.5 font-mono text-[10px] font-semibold uppercase">
          {t.status}
        </p>
        <h1 className="max-w-[680px] text-[clamp(46px,7.5vw,84px)] leading-[.91] font-semibold tracking-[-.09em] [&_em]:not-italic [&_em]:text-accent">
          {t.title}
        </h1>
        <p className="mt-4 max-w-[400px] text-base text-[#4f5855]">{t.lede}</p>
      </section>
      <section
        className="mx-auto grid w-full max-w-[960px] grid-cols-3 gap-0 px-[30px] pb-[58px] max-lg:grid-cols-2 max-md:grid-cols-1 max-md:px-5 max-md:pb-10"
        aria-label="Available tools"
      >
        {t.tools.map((tool, index) => (
          <Link
            className="relative grid min-h-[240px] grid-cols-[auto_1fr] gap-4 border-2 border-ink bg-[#f5f2eb] p-6 text-ink no-underline transition-shadow hover:shadow-[inset_0_-8px_0_#f5bd19] [&+&]:border-l-0 max-lg:nth-[3]:border-l-2 max-lg:nth-[3]:border-t-0 max-md:min-h-[165px] max-md:[&+&]:border-t-0 max-md:[&+&]:border-l-2"
            href={tool.href}
            key={tool.href}
          >
            <span className="absolute top-3 right-[13px] font-mono text-[11px] text-[#737871]">
              0{index + 1}
            </span>
            <span
              className={`grid size-[42px] place-items-center border-2 border-ink font-mono text-[25px] ${tool.className === "proposal-tool" ? "bg-[#f0c49c]" : tool.className === "appointment-tool" ? "bg-[#c9d9d3]" : "bg-safety"}`}
              aria-hidden="true"
            >
              {tool.icon}
            </span>
            <div>
              <h2 className="mt-1 mb-2 text-[21px] tracking-[-.04em]">
                {tool.title}
              </h2>
              <p className="m-0 text-[13px] leading-[1.48] text-[#657681]">
                {tool.description}
              </p>
            </div>
            <strong className="col-start-2 self-end text-[13px] text-ink">
              {tool.action} <b>↗</b>
            </strong>
          </Link>
        ))}
      </section>
    </main>
  );
}
