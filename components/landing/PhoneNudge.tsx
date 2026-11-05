"use client";

import { useEffect, useState } from "react";

const LINK = "https://tamatar.si";
const MSG = `tamatar, the notebook that grades you back. open this on my iPad: ${LINK}`;

/**
 * On a phone, the notebook can't really work (no room, no Pencil). Instead of losing the
 * visitor, offer a one-tap "send me the link" for their iPad or laptop.
 */
export default function PhoneNudge({ className = "" }: { className?: string }) {
  const [phone, setPhone] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse) and (max-width: 700px)");
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  if (!phone) return null;
  return (
    <div className={`sticky-note text-left ${className}`} style={{ rotate: "-1deg" }}>
      <div className="text-[1rem]">on your phone?</div>
      <p className="mt-1 text-[0.85rem] leading-snug text-ink-2">tamatar is built for an iPad with a Pencil (a laptop works too). Send yourself the link for later:</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a className="btn btn-red wa !min-h-[2.4rem] !text-[0.95rem]" href={`sms:?&body=${encodeURIComponent(MSG)}`}>
          text me the link
        </a>
        <a className="btn wb !min-h-[2.4rem] !text-[0.95rem]" href={`mailto:?subject=${encodeURIComponent("tamatar for my iPad")}&body=${encodeURIComponent(MSG)}`}>
          email it
        </a>
        <button
          type="button"
          className="btn wc !min-h-[2.4rem] !text-[0.95rem]"
          onClick={() => {
            navigator.clipboard?.writeText(LINK).then(() => setCopied(true), () => {});
          }}
        >
          {copied ? "copied!" : "copy link"}
        </button>
      </div>
    </div>
  );
}
