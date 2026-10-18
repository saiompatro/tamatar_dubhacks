<div align="center">

<img src="docs/images/logo.png" alt="tamatar smiling tomato logo" width="120">

# tamatar.si

### A red pen tutor for physics diagrams.

Write naturally. Find the first mistake. Keep learning.

**DubHacks 2026 · University of Washington · October 17–18**

[The idea](#the-idea) · [Demo](#a-look-at-the-demo) · [How it works](#how-it-works) · [Run locally](#run-locally) · [Project docs](#project-docs)

</div>

---

## The idea

You fill a page with arrows, equations, and crossed-out calculations. The answer key tells you that you're wrong. It doesn't tell you where your reasoning went off track.

**tamatar is designed to bring a teaching assistant's red pen to your own handwriting.** Draw a free-body diagram and solve a physics problem on an iPad. Press **Check**, and the tutor looks for the first incorrect step, circles the relevant ink, and offers just as much help as you want.

Start with a mark. Reveal a hint. Ask for an explanation. See the full answer when you're ready.

*Tamatar means “tomato” in Hindi.* Your little tomato companion bruises when you repeat a mistake and perks up as you improve—a playful reason to try again.

## A look at the demo

<img src="docs/images/artifact-home.png" alt="Artifact demo home screen with a tomato companion, homework cards, progress dots, and a scratch whiteboard." width="100%">

*A notebook-inspired home for homework, scratch work, and a tomato that grows with you.*

<details>
<summary><strong>See the handwriting-first onboarding</strong></summary>

<br>

<img src="docs/images/artifact-writing-tour.png" alt="Artifact demo onboarding showing handwritten ramp equations and the instruction: Write your work on the canvas. Use your Pencil like it is paper." width="100%">

*Use your Pencil like paper. No typing, no special syntax.*

</details>

**These screenshots show our interactive artifact prototype.** The integrated Next.js app focuses on inclined-plane homework and scratch work.

## The red pen experience

1. **Draw the forces.** Start with a free-body diagram: gravity, normal force, friction, and any applied force.
2. **Check your reasoning.** Find the first mistake, such as a normal force pointing vertically instead of perpendicular to the ramp.
3. **Choose your help.** Move through **Mark → Hint → Explain → Answer** without requesting another check.
4. **Fix it and solve.** Continue into component decomposition, Newton's second law, algebra, and units.
5. **Circle your final answer.** The planned circle-to-finish interaction keeps the flow on the page.

The visual language stays close to a student's notebook: graph paper, wobbly ink borders, red annotations, sticky-note hints, and our own **Myfont** handwriting font, extended with physics and math symbols.

## Built for one complete physics problem

Our demo centers on **five ramp problems**, covering frictionless motion, kinetic friction, static friction, a horizontal applied force, and normal force. Each has a reference diagram description and a worked solution.

The goal is to check both the **diagram** and the **equations**, rather than only compare a final number. A misplaced arrow can explain every wrong line that follows it.

### Current implementation

- Next.js application scaffold with TypeScript, Tailwind CSS, and the custom font.
- `/api/check` for handwritten PNG submissions, with server-controlled reference solutions and validated feedback.
- `/api/extract` for PDF problem extraction, plus `/api/health` for basic health checks.
- Claude adapter (Sonnet 5.5 by default, Haiku 5.5 selectable per route), bounded retries, cancellation, and request deadlines.
- Five ramp problems, shared response types, mock feedback fixtures, and handwriting dataset research.

The Pencil canvas, red-pen overlays, help controls, and tomato interactions now call the backend. PDF import extracts supported problems, lets you select them, and saves homework in this browser. Imported references are signed by the server and verified on subsequent checks. API accuracy and error localization still need evaluation on real student handwriting.

## How it works

```text
Handwritten work → PNG → /api/check → vision model + reference solution
                                              ↓
                           validated feedback + error-region coordinates
                                              ↓
                              red circle + mark / hint / explanation
```

The browser sends the problem ID and work image. The backend supplies the reference solution, asks for the first incorrect step, and validates the response. Feedback includes a normalized bounding box so the frontend can place the annotation on the student's work.

**Stack:** Next.js 14 · React · TypeScript · Tailwind CSS · Zod · Anthropic SDK (Claude Sonnet 5.5 / Haiku 5.5). The planned drawing layer uses Pointer Events, HTML canvas, and perfect-freehand; Vercel is the intended hosting target.

Provider keys stay on the server. The response contains all help levels, so changing the help slider can reveal more guidance immediately.

## Run locally

Use Node.js 20 or newer and npm.

```bash
git clone https://github.com/saiompatro/tamatar_dubhacks.git
cd tamatar_dubhacks
npm ci
cp .env.example .env.local
```

Edit `.env.local` and set `ANTHROPIC_API_KEY`. Both routes use Claude Sonnet 5.5 by default; set `AI_CHECK_MODEL=haiku` or `AI_EXTRACT_MODEL=haiku` to use Claude Haiku 5.5 instead.

Optional model, effort, and timeout settings are documented in [.env.example](.env.example). Never commit actual keys.

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000) and complete the welcome flow. Open **HW 4 · Ramps** to draw and check work, or use **New + → Import problems** to upload a PDF (under 3 MB, at most 10 pages).

`NEXT_PUBLIC_MOCK=0` uses the real backend and displays request errors. Set it to `1` only for explicitly labeled simulated check feedback; PDF import still uses the backend. Provider keys stay on the server. You can set a stable `PROBLEM_SIGNING_SECRET` for imported homework; otherwise signing uses a configured provider key, and rotating that key requires reimporting saved PDFs.

To check basic server health:

```bash
curl http://localhost:3000/api/health
# {"ok":true}
```

### iPad app

`ios/` holds a native iPad app that wraps the site and adds Apple Pencil double-tap, squeeze, hover, barrel roll and haptics. To install it with a free Apple ID, run `npm run dev:ipad` and follow [ios/README.md](ios/README.md).

Available project checks:

```bash
npm run typecheck
npm run lint
npm run build
```

## What's next

Next, evaluate the complete ramp-solving and PDF import experience on iPad Safari, then expand into more mechanics problems and richer feedback.

We're also exploring **our own handwriting recognizer** using symbol and expression datasets. The longer-term path separates reading ink from checking physics: a custom recognizer supplies structured math, while diagram geometry and reasoning checks identify the mistake. This is research in progress; no custom trained model is claimed in this submission.

## Project docs

- [Project context](planning/product/context.md) — scope, shared contracts, and the demo story.
- [Design plans](planning/design/ui_planning.md) and [delight spec](planning/design/delight.md) — the notebook interface, tomato, motion, and sound.
- [Backend and hosting](planning/backend/backend_planning.md) — architecture and deployment plan.
- [AI model comparison](planning/ai/api_planning.md) — candidates and evaluation criteria.
- [Handwriting datasets](planning/ai/handwriting-datasets.md) and [dataset strategy](planning/ai/dataset_strategy.md) — data sources and how we plan to use them.
- [Team responsibilities](planning/team/split.md) · [Full planning index](planning/README.md).

---

<div align="center">

**Built by a team of three at DubHacks 2026.**

*A little red ink. A clearer next step. A fresher tomato.*


</div>
