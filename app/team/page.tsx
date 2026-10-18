"use client";

import Topbar from "@/components/Topbar";
import { TEAM, TEAM_PHOTO } from "@/data/team";

/** Meet Team: the group photo, taped onto the page, with everyone's name underneath. */
export default function Team() {
  return (
    <div className="min-h-screen">
      <Topbar />
      <main className="mx-auto max-w-[64rem] px-8 pb-24 pt-10">
        <h1 className="text-center" style={{ fontSize: "clamp(2.4rem, 6vw, 3.6rem)" }}>
          meet the team
        </h1>
        <p className="mb-8 text-center text-[1.1rem] text-ink-2">the people who taught a tamatar physics</p>

        <figure className="mx-auto w-full max-w-[24rem]" style={{ animation: "deal-in 500ms var(--pop) both" }}>
          <div className="relative" style={{ rotate: "-1.5deg" }}>
            <div className="lp-tape" style={{ left: "10%", rotate: "-8deg" }} aria-hidden />
            <div className="lp-tape" style={{ right: "10%", rotate: "7deg" }} aria-hidden />
            <div className="wb overflow-hidden border-[2.5px] border-ink bg-white p-2 shadow-[6px_8px_0_#f6d9d5]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={TEAM_PHOTO} alt="Saiom Patro, Rajvir Ajmani and Arnav Bhattacharya at DubHacks" className="wa aspect-[3/4] w-full object-cover" />
            </div>
          </div>
          <figcaption className="mt-8 grid grid-cols-3 gap-4 text-center">
            {TEAM.map((m, i) => (
              <div key={m.name} style={{ animation: `pop-in 400ms var(--pop) ${300 + i * 120}ms both` }}>
                <div className="text-[1.2rem] leading-tight">{m.name}</div>
                <div className="text-[0.95rem] text-tomato">{m.role}</div>
              </div>
            ))}
          </figcaption>
        </figure>
      </main>
    </div>
  );
}
