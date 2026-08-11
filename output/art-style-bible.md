# Guild Vigil — Art Style Bible v1: "Pastes on the Marshal's Desk"
**Date**: 2026-08-11
**Status**: APPROVED 2026-08-11 (Steven: "Approved as drafted"; first batch scoped small — see decision record)
**Anchors**: four reference sheets provided 2026-08-11 (orc male/female, tiefling male/female — from the May/June Claude style briefs). Reference of record: `output/anchors/` (Steven: save the four originals there as `anchor-orc-m.png`, `anchor-orc-f.png`, `anchor-tiefling-m.png`, `anchor-tiefling-f.png` — comps-in-repo discipline, same as `output/exploration/`).
**Authorities**: brief #8 (generated art enters as "daguerreotype" pastes on vellum — content, never chrome), the recorded generated-map decision (procedural chart stays; flourish pastes parked), phase-3 pipeline notes (ChatGPT Image 2.0; style bible = locked prompt spec + CSS treatment layer).

## 1. What this document is
The single normative reference for every generated image that enters Guild Vigil. It locks the style DNA distilled from the four anchors, provides fill-in-the-slot prompt templates per asset class, defines the acceptance checklist each generation must pass, and specs the CSS treatment layer that flattens residual style drift when art lands on the desk. Generation without this bible is the art-direction equivalent of retyping content by hand.

**Boundary with brief #8**: the UI layer remains pure CSS + inline SVG — the zero-image-asset guard is untouched. Generated art is CONTENT, referenced by the sim/registries and pasted into portrait frames; it never becomes chrome, texture, or affordance.

## 2. The anchors — style DNA (locked)
What the four sheets share, distilled. These clauses are the constitution; every template below inherits them.

- **Format**: full-body character sheet, two views — three-quarter front + true profile — same figure, on a flat dark slate background (near `#2e3138`), no environment, no ground plane, no props. Figure fills ~85% of frame height.
- **Render**: painterly digital concept art. Confident hard-edged silhouette; planar, faceted brushwork on musculature; soft blends on skin gradients; matte finish with restrained sheen on the largest planes. No outlines, no cel shading, no photo texture, no impasto.
- **Proportions**: naturalistic heroic (~7.5–8 heads). Real anatomy, athletic builds; orcs carry heavier mass with SMALL lower tusks — weathered people, not beasts. Pointed ears where the ancestry has them.
- **Lighting (the signature — never vary)**: two locked sources. Warm golden key from upper front-left; cool cyan-teal rim from behind right. Dark background holds the silhouette in value contrast.
- **Palette**: skin carries the identity (anchor examples: crimson red with cool shadows; olive-moss green with warm key). Costume stays neutral undyed textile — bone/oat linen, grey-brown sashes — so skin, faction grade, and status colors read. Small emissive accents only (the anchors' amber-glow eyes).
- **Costume baseline ("the recruit's wraps")**: barefoot, loose cropped trousers with tied waist sash, forearm and shin bandage wraps, chest wrap for women. No armor, weapons, or jewelry — the neutral base identity; class kit is NOT painted into baseline portraits.
- **Bearing**: calm, grounded, self-possessed. Neutral-to-slight expression range.
- **Forbidden**: photorealism · anime/cel style · environments or backdrops · dramatic mono-color lighting · saturated costume dyes · oversized weapons/hands/shoulders · glossy plastic skin · text or watermarks · asymmetric one-view compositions for sheet-class assets.

## 3. Asset classes & prompt templates
Every generation attaches 1–2 anchor images as style reference PLUS the class template below. One subject per generation. Slots in `{braces}`.

### 3a. Hero reference sheets (ancestry × gender — the baseline set)
The playable roster draws from the REGISTRY ancestries — Human, Elf, Dwarf, Halfling, Half-Orc, Gnome (6 × 2 = 12 sheets). The anchors' orc reads as the Half-Orc reference; the tiefling sheets lock style only (no tiefling in the ancestry registry — do not generate one into the roster).

> Full-body character reference sheet of a {ancestry} {gender} adventurer-recruit, two views: three-quarter front and true profile, same figure. Painterly fantasy concept art, naturalistic heroic proportions, athletic build. {ancestry-specific physique/feature line}. Barefoot; loose cropped {neutral textile color} trousers with tied waist sash; cloth bandage wraps on forearms and shins{; chest wrap if female}. No armor, no weapons, no jewelry. Skin: {ancestry skin tone}; hair: {practical dark style}; eyes {iris note}. Lighting: warm golden key light from upper front-left, cool teal rim light from behind right. Flat dark slate background (#2e3138), no environment, no ground shadow. Matte painterly finish, faceted brushwork on muscle planes, hard clean silhouette. No text.

Halfling/Gnome note: keep the same lighting/costume/render clauses; state "small stature (~3–4 ft), naturalistic child-free adult features" explicitly — small ancestries drift juvenile without it.

### 3b. Roster busts (the portrait-frame crop)
Same subject, second generation (or crop pass) for the ledger/dispatch chips: head-and-shoulders, three-quarter angle, same lighting/background clauses, tighter framing ("bust portrait, head and shoulders, subject centered, gaze slightly off-camera"). Sheets are the identity record; busts are what the UI mostly shows.

### 3c. Named NPCs
Sheet + bust per named figure, with the character's actual description replacing the recruit baseline — NPCs may carry kit (the one class allowed to). Example:

> …of Marshal Edrin Vale, a weathered human frontier marshal in his fifties: grey-streaked hair, campaign-worn oat linen and grey-brown sash, a marshal's baton tucked in the sash. Same lighting/background/render clauses…

### 3d. Enemies & monsters (the Krath order of battle and beyond)
One sheet per enemy base (registry ids; 45 today, e.g. Krathite Conscript, Hobgoblin Vanguard, Warg Alpha, Grave-Whisperer). Kit IS painted here — enemies are recognized by silhouette + gear. Krath-aligned foes may carry ONE muted faction accent (dark iron + oxblood) but costume stays within the neutral-textile discipline; the Krath grade (§5) does the faction talking.
Variants (e.g. undead "Bone Conscript" mirrors) regenerate from the base prompt + a variant clause ("skeletal, desiccated, same silhouette and kit") — silhouette continuity over novelty.

### 3e. Bosses & elites
Same enemy template + presence clauses (scale cue against an implied 6-ft line, heavier kit, ONE signature emissive accent). No environment even for bosses — the elite frame (§5) carries the rank.

### 3f. Chart flourishes & world-map icons — PARKED
The recorded decision stands: the chart is procedural SVG and stays so. Flourish pastes (cartouche vignettes, sea-monster marginalia) are the only sanctioned future entry point and remain parked until Steven deliberately revisits. NOT unlocked by this bible.

## 4. Generation protocol (ChatGPT Image 2.0)
1. Attach the two same-gender anchor sheets as style references + the class template with slots filled.
2. Generate at the platform's maximum quality; 3:2 landscape for sheets, 1:1 for busts.
3. Run the acceptance checklist (below). Reject ANY failure — regenerate rather than retouch; hand-fixes fork the style.
4. Name on save: `{class}-{subject}-{variant}.png` (`hero-halforc-f-01.png`, `enemy-warg-alpha-01.png`, `npc-edrin-vale-bust-01.png`). Append-only, gaps allowed — the content-id discipline applies to art.
5. Accepted originals land in the art staging folder (location finalized in the integration brief); anchors and this bible are the only art that lives in `output/`.

**Acceptance checklist (all must pass):**
- [ ] Two views (sheets) / correct crop (busts); flat slate background, no environment leakage
- [ ] Warm-key/cool-rim lighting reads; silhouette holds at thumbnail size (the roster renders small)
- [ ] Proportions naturalistic-heroic; no anime/photo drift; costume within the neutral-textile discipline
- [ ] Ancestry/subject features match the registry description; no invented kit on baseline heroes
- [ ] No text, watermark, signature, or frame painted into the image

## 5. The treatment layer (CSS spec — implementation is a follow-up brief)
Applied by the UI to every paste, composed over the raw image so residual generation drift flattens into the desk's world. Layers, outermost first:

- **Daguerreotype base grade** (every paste): slight sepia shift + gentle contrast lift + soft vignette + vellum grain blend (multiply against the sheet it sits on). The paste should read as a photograph glued into a ledger, not a screenshot.
- **Faction grades**: Haven-aligned — warm parchment bias (subtle amber). Krath-aligned — cold iron bias (subtle steel-blue, slightly crushed shadows). Applied by allegiance data, never hand-picked per image.
- **Condition overlays**: wounded = progressive desaturation + slight darkening (paired with the numeric HP/wounded label — flourish never replaces the number); dead/lost = full desat + deeper vignette.
- **Elite frame**: bosses/elites take the brass frame treatment from the grammar component set; rank lives in the frame, not the artwork.
- **Flat mode**: the paste and its frame REMAIN (a portrait is data — who this is); the decorative grade layers (sepia, grain, vignette, tilt) switch off with the rest of the ornament. Faction/condition grades remain only via their label-paired twins... condition desat stays (it is label-paired); tilt/tape/grain go.

## 6. Why the anchors say what they say (rationale, for future sessions)
The neutral costume baseline keeps 12 hero sheets reusable across all 13 classes without repainting; the two-source lighting is distinctive enough to survive the daguerreotype grade; skin-carries-identity keeps ancestry legible after faction grading; the dark slate background cuts cleanly when pastes are masked onto vellum. The style sits deliberately between painterly-realist and stylized — far enough from photorealism to regenerate consistently, close enough that the desk's "field report" fiction holds.

## 7. Decision record (resolved at approval, 2026-08-11)
1. **Flat-mode pastes** — CONFIRMED as §5: portrait + frame stay (data), ornament grades/tilt/grain off, condition desat stays (label-paired).
2. **Hero sheet coverage** — START SMALL: first batch validates the pipeline end-to-end before the full 12-sheet matrix. Concretely: Human m/f + Half-Orc m/f (Half-Orc validates directly against the orc anchors; Human proves the style transfers off-anchor). Remaining ancestries batch after acceptance. NOTE for the integration brief: `HeroState` carries no ancestry field yet — portrait assignment needs the hero↔ancestry link decided there (content/system decision, not this bible's).
3. **Anchor commit** — CONFIRMED: the four originals go to `output/anchors/` (Steven saves them; repo is the reference of record).
4. **Bust source** — CROP-FIRST: busts are crops from the sheets; generate a dedicated bust only where the sheet crop composes badly.
