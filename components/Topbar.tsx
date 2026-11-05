"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { daysUntil, dueDate } from "@/lib/due";
import { newId } from "@/lib/ink";
import { wiggle } from "@/lib/motion";
import { worksheetProgress } from "@/lib/progress";
import { useStore } from "@/lib/store";
import { STATUS_LINES } from "@/lib/tomato";
import Button from "./Button";
import ImportModal from "./ImportModal";
import RaceSheet from "./RaceSheet";
import Tomato from "./Tomato";

export function Wordmark() {
  const { tomato, toast } = useStore();
  const ref = useRef<HTMLSpanElement>(null);
  return (
    <Link href="/" className="flex items-baseline text-[1.5rem] leading-none">
      tamatar
      <span
        ref={ref}
        className="inline-block text-tomato"
        style={{ rotate: "-6deg" }}
        onClick={(e) => {
          e.preventDefault();
          wiggle(ref.current);
          toast(STATUS_LINES[tomato.state]);
        }}
      >
        .si
      </span>
    </Link>
  );
}

const NAV = [
  { href: "/", label: "Home" },
  { href: "/#how", label: "How it works" },
  { href: "/#meet", label: "Meet Tamatar" },
  { href: "/team", label: "Meet Team" },
];

/** Closes a popover when the pointer goes down anywhere outside `ref`. */
function useDismiss(open: boolean, ref: React.RefObject<HTMLElement>, setOpen: (open: boolean) => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open, ref, setOpen]);
}

/** Red dot for "something is due today or overdue". */
function DueDot({ className = "" }: { className?: string }) {
  return <span className={`absolute h-2 w-2 rounded-full bg-tomato ring-2 ring-white ${className}`} aria-hidden />;
}

/** Wordmark · nav · tamatar badge · Challenge · New + menu (§4.4). `floating` = transparent, for the landing hero. */
export default function Topbar({ children, floating = false }: { children?: React.ReactNode; floating?: boolean }) {
  const { saveBoard, account, signOut, toast, homework, progress, name } = useStore();
  const router = useRouter();
  const path = usePathname();
  const waitlistOnly = floating || path === "/team";
  const [menu, setMenu] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [race, setRace] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  useDismiss(menu, menuRef, setMenu);
  useDismiss(navOpen, navRef, setNavOpen);

  // Unfinished homework due today or earlier puts a dot on Calendar.
  const dueNow =
    !!name &&
    homework.some((hw) => {
      const d = dueDate(hw);
      if (!d || daysUntil(d) > 0) return false;
      const { done, total } = worksheetProgress(hw, progress);
      return done < total;
    });

  const navLinks = (vertical: boolean) =>
    NAV.map((n) => {
      const on = n.href === path || (n.href === "/home" && path.startsWith("/solve"));
      const dot = dueNow && n.href === "/calendar";
      return (
        <Link
          key={n.href}
          href={n.href}
          onClick={() => setNavOpen(false)}
          className={`relative whitespace-nowrap rounded-full px-3 py-1 transition-colors hover:bg-blush ${vertical ? "!rounded-lg py-2 text-[1rem]" : ""} ${on ? "text-tomato" : "text-ink-2"}`}
        >
          {n.label}
          {dot && (
            <>
              <DueDot className={vertical ? "right-3 top-1/2 -translate-y-1/2" : "right-0.5 top-0.5"} />
              <span className="sr-only"> (something is due)</span>
            </>
          )}
        </Link>
      );
    });

  return (
    <header
      className={`z-30 flex h-[3.4rem] shrink-0 items-center gap-2 px-4 sm:gap-5 sm:px-5 ${
        floating ? "fixed inset-x-0 top-0 bg-white/80 backdrop-blur-sm" : "divider relative bg-white"
      }`}
    >
      <Wordmark />
      <nav className="hidden items-center gap-1 text-[0.95rem] lg:flex" aria-label="main">
        {navLinks(false)}
      </nav>
      {/* below lg the nav folds into a menu so the bar never scrolls sideways */}
      <div ref={navRef} className="relative lg:hidden">
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-blush"
          aria-label={dueNow ? "menu (something is due)" : "menu"}
          aria-expanded={navOpen}
          onClick={() => setNavOpen((o) => !o)}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6 C8 5 14 7 19 6 M3 11 C8 12 14 10 19 11 M3 16 C8 15 14 17 19 16" />
          </svg>
          {dueNow && <DueDot className="right-1 top-1" />}
        </button>
        {navOpen && (
          <nav className="menu hand wb absolute left-0 top-[calc(100%+8px)] flex w-56 flex-col bg-white p-2 shadow-[4px_5px_0_#f6d9d5]" aria-label="main">
            {navLinks(true)}
          </nav>
        )}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
      {!waitlistOnly && (
        <div className="hidden items-center lg:flex">
          <Tomato size={34} track={false} />
        </div>
      )}
      {waitlistOnly ? (
        <Link href="/#waitlist" className="btn btn-red wc !text-[1rem]">
          join the waitlist
        </Link>
      ) : (
      <>
      <Button className="wa" onClick={() => setRace(true)}>
        Challenge
      </Button>
      <div ref={menuRef} className="relative">
        <Button variant="red" className="wc" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          New +
        </Button>
        {menu && (
          <div className="menu hand wa absolute right-0 top-[calc(100%+8px)] flex w-60 flex-col bg-white p-2 shadow-[4px_5px_0_#f6d9d5]">
            {account && <div className="truncate px-3 pb-1 pt-1 text-[0.75rem] text-muted" title={account.email}>signed in as {account.email}</div>}
            {[
              { label: "Upload worksheet", act: () => setImportOpen(true) },
              {
                label: "Blank whiteboard",
                act: () => {
                  const id = newId();
                  saveBoard({ id, title: "untitled board", strokes: [] });
                  router.push(`/board/${id}`);
                },
              },
              ...(account
                ? [{
                    label: "Log out",
                    act: () => {
                      signOut().then(() => router.push("/login"), () => toast("could not log out. try again?"));
                    },
                  }]
                : []),
            ].map((it, i) => (
              <button
                key={it.label}
                type="button"
                className="rounded-lg px-3 py-2 text-left text-[1rem] hover:bg-blush"
                style={{ animationDelay: `${i * 40}ms` }}
                onClick={() => {
                  setMenu(false);
                  it.act();
                }}
              >
                {it.label}
              </button>
            ))}
          </div>
        )}
      </div>
      </>
      )}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
      {race && <RaceSheet onClose={() => setRace(false)} />}
    </header>
  );
}
