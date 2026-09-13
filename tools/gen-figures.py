#!/usr/bin/env python
"""
Generate the missing paperdoll figures (brief #24 sheet work).

TWO OF SIX ANCESTRIES had art; this fills Dwarf, Elf, Gnome and Halfling,
male and female. The prompt is pinned here rather than typed by hand each
time, because the whole value of these figures is that they look like ONE
commission: same framing, same palette, same flat backdrop. A one-off prompt
in a shell history is not a reproducible art direction.

⚠ THE BACKDROP MUST STAY FLAT AND EDGE-CONNECTED. tools/build-figures.mjs
keys the background by flood-filling from the image border, so a vignette or
a painted scene behind the figure survives the key and ships as a grey slab
behind the paperdoll. 'plain flat background' is load-bearing, not taste.

⚠ AND THE POSE MUST BE FULL-BODY, ARMS CLEAR OF THE TORSO. A cropped or
contrapposto figure cannot carry equipment boxes down both margins.
"""
import json
import subprocess
import sys
from pathlib import Path

SCRIPTS = Path(r"C:\Users\sigse\AppData\Local\hermes\skills\creative\comfyui\scripts")
WORKFLOW = SCRIPTS.parent / "workflows" / "sdxl_txt2img.json"
OUT = Path(r"C:\GuildVigilWeb\art\heroes\_incoming")

# Shared style contract — every figure gets this verbatim.
# ⚠ NEVER SAY "CHARACTER SHEET" OR "CONCEPT ART" IN THE PROMPT. Both phrases
# pull SDXL straight to a real concept-art PAGE: the first dwarf came back as
# a turnaround with a second, smaller back-view figure beside the main one.
# A paperdoll needs EXACTLY ONE figure, so the prompt asks for a single
# centred subject and the negative prompt bans the turnaround vocabulary.
STYLE = (
    "single character, one figure only, centered, "
    "full body standing straight facing viewer, arms relaxed at sides, "
    "complete figure head to feet, "
    "painterly digital painting, muted desaturated earthy palette, "
    # ⚠ SAY THE BACKGROUND THREE WAYS. One mention is not enough: four of the
    # first eight renders came back with a painted backdrop (a vignette disc,
    # a suggestion of a wall) that NO keying tolerance can remove, because it
    # is a picture rather than a flat field with a figure on it. Those ship a
    # grey slab behind the paperdoll. build-figures.mjs now names them.
    "isolated on a solid uniform light grey background, "
    "empty flat background, no scenery, no shadow on the ground, "
    "soft even lighting, detailed but restrained fantasy illustration"
)
NEG = (
    # the turnaround problem, first and loudest
    "character sheet, turnaround, model sheet, multiple views, two figures, "
    "back view, side view, duplicate character, reference sheet, collage, "
    "split image, diptych, "
    # framing
    "cropped, cut off, close-up, portrait crop, bust, headshot, "
    # background
    "busy background, scenery, landscape, interior, text, watermark, signature, "
    "vignette, gradient background, painted backdrop, ground shadow, cast shadow, "
    "stone wall, floor, horizon, framed border, "
    # rendering
    "weapon pointing at viewer, dramatic perspective, "
    "neon, oversaturated, glowing, lens flare, blurry, deformed hands"
)

# ⚠ ANCESTRY DESCRIPTIONS CARRY THE SILHOUETTE, which is the only thing that
# reads at paperdoll size. 'gnome' alone returns a generic small human; the
# build words are what make them distinguishable at 300px tall.
SUBJECTS = {
    # ⚠ The three ORIGINAL hand-made figures render barefoot in pale cream
    # linen against a light field. That combination keys badly no matter the
    # tolerance: the cloth edge and the field are the same value, so the
    # silhouette frays. Regenerated with darker clothing and boots.
    "halforc-f": "a tall muscular female half-orc fighter, green-grey skin, dark braided hair, dark leather and mail, sturdy boots",
    "human-f": "a female human cleric, dark red and brown robes over mail, short hair, sturdy boots",
    "human-m": "a male human fighter, dark blue tunic over chain mail, short hair, sturdy boots",
    # ⚠ The two hand-made half-orcs and humans render barefoot in pale linen,
    # which keys badly: bare feet on a light field leave almost nothing at
    # ankle height. Boots give the silhouette something solid to end on.
    "halforc-m": "a tall muscular male half-orc rogue, green-grey skin, dark hair, dark leather armour and sturdy boots",
    "dwarf-m": "a stout broad-shouldered male dwarf warrior, thick braided beard, heavy build, mail hauberk",
    "dwarf-f": "a stout sturdy female dwarf warrior, braided hair, broad build, mail hauberk and leather",
    "elf-m": "a tall slender male elf ranger, long pale hair, pointed ears, layered leather travelling gear",
    "elf-f": "a tall slender female elf ranger, long braided hair, pointed ears, layered leather travelling gear",
    "gnome-m": "a very small wiry male gnome tinkerer, oversized head, wild hair, patched robes and tool belts",
    "gnome-f": "a very small wiry female gnome tinkerer, oversized head, wild hair, patched robes and tool belts",
    "halfling-m": "a short round-faced male halfling scout, curly hair, barefoot, simple travelling clothes and cloak",
    "halfling-f": "a short round-faced female halfling scout, curly hair, barefoot, simple travelling clothes and cloak",
}


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    only = sys.argv[1:] or list(SUBJECTS)
    failures = []

    for key in only:
        subject = SUBJECTS[key]
        args = {
            "prompt": f"{subject}, {STYLE}",
            "negative_prompt": NEG,
            "seed": -1,
            "steps": 30,
            "cfg": 6.5,
            # 2:3 keeps a standing figure uncropped; the sheet box is 3:4, so
            # a touch taller than the frame is safer than a touch wider.
            "width": 832,
            "height": 1248,
        }
        print(f"  generating {key} ...", flush=True)
        proc = subprocess.run(
            [
                sys.executable, str(SCRIPTS / "run_workflow.py"),
                "--workflow", str(WORKFLOW),
                "--args", json.dumps(args),
                "--output-dir", str(OUT),
                "--flat-output", "--randomize-seed",
                "--timeout", "300",
            ],
            capture_output=True, text=True, cwd=str(SCRIPTS),
        )
        if proc.returncode != 0:
            failures.append(key)
            print(f"  FAILED {key}: {proc.stdout[-400:]}{proc.stderr[-400:]}", flush=True)
            continue

        # Rename the workflow's output to the pipeline's naming convention.
        newest = max(OUT.glob("*.png"), key=lambda p: p.stat().st_mtime)
        target = OUT / f"hero-{key}-figure-01.png"
        if newest != target:
            target.unlink(missing_ok=True)
            newest.rename(target)
        print(f"  ok {target.name} ({target.stat().st_size:,} bytes)", flush=True)

    print(f"\ndone: {len(only) - len(failures)}/{len(only)} generated")
    if failures:
        print("failed:", ", ".join(failures))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
