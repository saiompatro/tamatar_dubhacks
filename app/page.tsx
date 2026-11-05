import type { Metadata } from "next";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import HelpLadder from "@/components/landing/HelpLadder";
import LiveTry from "@/components/landing/LiveTry";
import PhoneNudge from "@/components/landing/PhoneNudge";
import Reveal from "@/components/landing/Reveal";
import TomatoPlayground from "@/components/landing/TomatoPlayground";
import TomatoRain from "@/components/landing/TomatoRain";
import MeetTamatar from "@/components/landing/MeetTamatar";

export const metadata: Metadata = {
  title: "tamatar.si: a notebook that grades you back",
  description: "Write your physics homework by hand. tamatar's red pen circles the first slip and helps just enough for you to fix it yourself.",
};

const COVERS = [
  { title: "checks well", tone: "text-good", items: ["ramps and inclined planes", "friction, static and kinetic", "free-body diagrams", "Newton's second law, ma = ΣF"] },
  { title: "getting there", tone: "text-ink", items: ["kinematics and projectiles", "work and energy", "momentum and impulse", "circular motion"] },
  { title: "not yet", tone: "text-tomato", items: ["torque and rotation", "electricity and magnetism", "waves, optics, thermo", "anything past intro mechanics"] },
];

const STEPS = [
  {
    n: "1",
    title: "write it like paper",
    body: "Pencil on the canvas. No typing, no equation editor, no special syntax.",
    doodle: "M8 44 Q30 10 52 30 T96 22",
  },
  {
    n: "2",
    title: "draw forces as arrows",
    body: "Start every arrow on the object. tamatar checks which way each one points.",
    doodle: "M14 46 L86 14 M86 14 L70 14 M86 14 L80 29",
  },
  {
    n: "3",
    title: "circle your answer",
    body: "A circle means done. The red pen reads the whole page and finds the first slip.",
    doodle: "M50 8 C80 6 96 22 92 36 C88 52 60 56 36 52 C14 48 4 34 12 22 C20 10 40 6 58 10",
  },
];

export default function Landing() {
  return (
    <div className="lp">
      <div className="lp-margin" aria-hidden />

      <Topbar floating />

      {/* meet tamatar: the first screen is just the tamatar */}
      <MeetTamatar />

      {/* pitch */}
      <section id="about" className="relative mx-auto grid scroll-mt-16 max-w-[1180px] items-center gap-12 px-4 pb-24 pt-12 sm:px-10 lg:grid-cols-[1fr_1.05fr] lg:pt-16">
        <div>
          <div className="sticky-note inline-block text-[0.85rem]" style={{ rotate: "-2deg" }}>
            for handwritten physics homework
          </div>
          <h1 className="mt-5 leading-[0.95]" style={{ fontSize: "clamp(48px, 7vw, 92px)" }}>
            a notebook
            <br />
            that <span className="lp-scribble">grades</span> you
            <br />
            <span className="text-tomato">back.</span>
          </h1>
          <p className="mt-6 max-w-[520px] text-[1.15rem] leading-snug text-ink">
            Answer keys teach you to copy. tamatar won&rsquo;t just tell you.
          </p>
          <p className="mt-2 max-w-[520px] text-[1.05rem] leading-snug text-ink-2">
            Write your work by hand and circle your answer. The red pen marks your <span className="hl">first slip</span>, then you choose how much more help you need:
          </p>
          {/* the help ladder, up top: the reason to care */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[1rem]" aria-label="the help ladder: mark, hint, explain, answer">
            {["mark", "hint", "explain", "answer"].map((r, i) => (
              <span key={r} className="flex items-center gap-2">
                {i > 0 && <span className="text-faint">→</span>}
                <span className={`rounded-full border-[1.5px] px-3 py-0.5 ${i === 0 ? "border-tomato text-tomato" : "border-rule text-ink-2"}`}>{r}</span>
              </span>
            ))}
            <span className="ml-1 text-[0.85rem] text-muted">and a tally of every rung you climb</span>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Link href="/#waitlist" className="btn btn-red wa lp-cta !min-h-[60px] !px-8 !text-[1.35rem]">
              join the waitlist →
            </Link>
            <a href="#how" className="link text-[1rem] text-ink-2">
              or see how it works
            </a>
          </div>
          <PhoneNudge className="mt-8 max-w-[520px]" />
          <p className="mt-8 max-w-[520px] text-[0.8rem] leading-snug text-muted">
            <span className="text-ink-2">Your handwriting:</span> a picture of your page goes to Anthropic&rsquo;s Claude only to be checked. We don&rsquo;t keep the image, and it isn&rsquo;t used to train AI.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-[600px] lg:mr-0" style={{ rotate: "1.2deg" }}>
          <div className="lp-tape" style={{ left: "12%", rotate: "-8deg" }} aria-hidden />
          <div className="lp-tape" style={{ right: "14%", rotate: "6deg" }} aria-hidden />
          <LiveTry />
        </div>
      </section>

      {/* scope: say what it covers, so a torque problem isn't a surprise */}
      <section id="covers" className="relative mx-auto max-w-[1180px] scroll-mt-16 px-4 pb-20 sm:px-10">
        <Reveal>
          <SectionHead kicker="what it checks" title="honest about what it knows." />
        </Reveal>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {COVERS.map((c, i) => (
            <Reveal key={c.title} delay={i * 90}>
              <div className={`card ${["wa", "wb", "wc"][i]} h-full !p-5`}>
                <div className={`text-[1.25rem] ${c.tone}`}>{c.title}</div>
                <ul className="mt-2 flex flex-col gap-1 text-[0.95rem] text-ink-2">
                  {c.items.map((t) => (
                    <li key={t}>· {t}</li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-4 text-[0.85rem] text-muted">Intro mechanics only, for now. If your problem is on the &lsquo;not yet&rsquo; list, tamatar will probably get it wrong.</p>
      </section>

      {/* how it works */}
      <section id="how" className="lp-band relative scroll-mt-16 py-20">
        <div className="mx-auto max-w-[1180px] px-4 sm:px-10">
          <Reveal>
            <SectionHead kicker="how it works" title="three moves. no typing." />
          </Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <div className={`card ${["wa", "wb", "wc"][i]} cut h-full !p-6`} style={{ rotate: `${[-1, 0.8, -0.5][i]}deg` }}>
                  <div className="flex items-start justify-between">
                    <span className="lp-num">{s.n}</span>
                    <svg width="100" height="60" viewBox="0 0 100 60" aria-hidden>
                      <path d={s.doodle} fill="none" stroke={i === 2 ? "var(--tomato)" : "var(--ink)"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h3 className="mt-4 text-[1.4rem] leading-tight">{s.title}</h3>
                  <p className="mt-2 text-[0.95rem] leading-snug text-ink-2">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* the red pen */}
      <section id="red-pen" className="relative scroll-mt-6 py-24">
        <div className="mx-auto max-w-[1180px] px-4 sm:px-10">
          <Reveal>
            <SectionHead kicker="the red pen" title="help you can ration." />
            <p className="mt-4 max-w-[640px] text-[1.05rem] leading-snug text-ink-2">
              Answer keys teach you to copy. tamatar starts with a single red mark and lets you decide how much more you need. Every step up the ladder gets a tally, so you always know how much was you.
            </p>
          </Reveal>
          <Reveal className="mt-12">
            <HelpLadder />
          </Reveal>
        </div>
      </section>

      {/* the tamatar */}
      <section id="tamatar" className="lp-band relative scroll-mt-6 py-24">
        <div className="mx-auto grid max-w-[1180px] items-center gap-12 px-4 sm:px-10 lg:grid-cols-[1fr_1.2fr]">
          <Reveal>
            <SectionHead kicker="the tamatar" title="meet your tamatar." />
            <p className="mt-4 max-w-[480px] text-[1.05rem] leading-snug text-ink-2">
              It lives in the corner of every page and watches you write. Right answers keep it happy. Hit the same slip twice and it gets worried about you: it leans in and offers the explain rung. One right answer and it relaxes.
            </p>
            <p className="mt-4 max-w-[480px] text-[1.05rem] leading-snug text-ink-2">
              Go ahead, poke it. It doesn&rsquo;t mind. Much.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <TomatoPlayground />
          </Reveal>
        </div>
      </section>

      {/* not an answer machine */}
      <section className="relative py-24">
        <div className="mx-auto max-w-[1180px] px-4 sm:px-10">
          <Reveal>
            <SectionHead kicker="the rules" title="what tamatar won't do." />
          </Reveal>
          <div className="mt-10 grid gap-x-10 gap-y-6 md:grid-cols-2">
            {[
              ["hand you the answer first", "The full solution is the last rung, and it costs a tally."],
              ["mark your whole page red", "It finds the first slip. Fix that one, then check again."],
              ["make you type equations", "If you can write it on paper, you can write it here."],
              ["cover up your work", "Feedback goes around your ink, never on top of it."],
            ].map(([t, b], i) => (
              <Reveal key={t} delay={i * 70}>
                <div className="flex gap-4">
                  <svg className="mt-1 shrink-0" width="34" height="34" viewBox="0 0 34 34" aria-hidden>
                    <path d="M7 7 L27 27 M27 7 L7 27" stroke="var(--tomato)" strokeWidth="3.4" strokeLinecap="round" />
                  </svg>
                  <div>
                    <div className="text-[1.25rem] leading-tight">
                      <span className="lp-strike">{t}</span>
                    </div>
                    <p className="mt-1 text-[0.95rem] text-ink-2">{b}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* closing */}
      <section className="lp-band relative py-24">
        <div className="px-4 sm:px-10">
          <TomatoRain />
        </div>
      </section>

      <footer className="relative mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-10 text-[0.8rem] text-muted sm:px-10">
        <img src="/logo.png" alt="" width={28} height={30} />
        <span>tamatar.si</span>
        <Link href="/team" className="link">meet the team</Link>
        <span className="sm:ml-auto">no tamatars were harmed. some got a little worried.</span>
      </footer>
    </div>
  );
}

function SectionHead({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <div className="text-[0.9rem] text-tomato" style={{ rotate: "-2deg", display: "inline-block" }}>
        {kicker}
      </div>
      <h2 className="mt-1 leading-none" style={{ fontSize: "clamp(36px, 5vw, 60px)" }}>
        {title}
      </h2>
    </div>
  );
}
