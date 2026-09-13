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
    "soft diffuse lighting, plain flat pale grey background, "
    "detailed but restrained fantasy illustration"
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
    # rendering
    "weapon pointing at viewer, dramatic perspective, "
    "neon, oversaturated, glowing, lens flare, blurry, deformed hands"
)

# ⚠ ANCESTRY DESCRIPTIONS CARRY THE SILHOUETTE, which is the only thing that
# reads at paperdoll size. 'gnome' alone returns a generic small human; the
# build words are what make them distinguishable at 300px tall.
SUBJECTS = {
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
