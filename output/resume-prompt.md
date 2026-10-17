Resume Guild Vigil (C:\GuildVigilWeb). Load the `guild-vigil` skill first, then read `output/handoff.md`.

Context: the M1 loop and my 8-request M2 feedback round are merged and pushed (spells tab, cleric prepared casting, 10-slot quest board, easy early quests, Marshal commissions, honest item cards, scroll performance). Last session switched Hermes image generation to `image_gen.provider: openai-codex`, so the image tool should now work through my ChatGPT sign-in, with no API key.

Do this, in order:

1. **Generate the 8 missing ancestry busts.** Use `output/art/bust-prompts-batch2.md`: style block plus one subject line each, square, with `art/heroes/hero-human-m-bust-01.png` and `art/heroes/hero-halforc-f-bust-01.png` attached as style references. Save each one as `art/heroes/hero-<ancestry>-<f|m>-bust-01.png`.
   - Look at every image yourself against `output/art-style-bible.md`. Regenerate any that has a background scene, armour or weapons, text, a child-like halfling or gnome, or the wrong lighting.
   - Then run `pnpm portraits` and check `output/exploration/portrait-contact-sheet.html`.
   - Run the full gate with `GV_PORT`, commit and push.
   - Show me the contact sheet at the end so I can approve the look.
   - If the image tool is missing or fails, stop and tell me exactly why. Don't work around it.

2. **Then continue the roadmap.** Pick the next milestone from `output/roadmap.md`, together with the content to-dos in `output/handoff.md`:
   - mid-level quests, since the board thins out after week 17
   - Scroll of Raise Dead casts the wrong spell
   - odd item prices
   - when abilities like Power Attack should fire

   Split independent work into parallel worktree tracks, as the skill describes.

Keep the working agreement: you build and decide, log each design call in `output/decisions.md`, and end with a playtest note and an updated handoff. I'm dyslexic: short paragraphs, tables, and a summary at the very end.
