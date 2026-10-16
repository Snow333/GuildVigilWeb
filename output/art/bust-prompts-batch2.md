# Bust portraits: the 8 missing (copy-paste pack for ChatGPT Image 2.0)

**Have:** Human f/m, Half-Orc f/m. **Need:** Elf, Dwarf, Halfling, Gnome × woman/man (8 images).

## How to do it (about 2 minutes per image)

1. Open ChatGPT and start a **new chat for each image**, so styles don't blend.
2. **Attach two reference images** (drag them into the chat):
   - `C:\GuildVigilWeb\art\heroes\hero-human-m-bust-01.png`
   - `C:\GuildVigilWeb\art\heroes\hero-halforc-f-bust-01.png`
3. Paste the **shared style block** below, then the **one subject line** for that image.
4. Ask for **square (1:1)** at the highest quality.
5. Save it as the file name shown, into `C:\GuildVigilWeb\art\heroes\`.
6. When all 8 are in, tell Hermes **"portraits are in"**. Hermes runs `pnpm portraits`, checks the
   contact sheet and ships them.

**Reject and redo if:** there's a background scene, armour or weapons, text, a child-like face on a
halfling or gnome, or the lighting is a different colour.

---

## Shared style block (paste first, every time)

```
Match the two attached reference portraits exactly in style: painterly digital concept art, planar faceted brushwork, matte finish, no outlines, no cel shading, not photoreal.
Bust portrait, head and shoulders, subject centered, three-quarter angle, gaze slightly off-camera, calm and self-possessed expression.
Lighting is locked: warm golden key light from upper front-left, cool cyan-teal rim light from behind right.
Flat dark slate background (#2e3138), no environment, no props, no text.
Costume: plain undyed oat-linen collarless shirt, like the references. No armour, no weapons, no jewellery.
Square 1:1 image.
```

## Subject lines (paste one after the style block)

| Save as | Subject line |
|---|---|
| `hero-elf-f-bust-01.png` | `Subject: an elf woman adventurer-recruit, adult. Long pointed ears, fine high cheekbones, slender neck. Pale olive skin with cool shadows, long straight dark-brown hair tied back, grey-green eyes.` |
| `hero-elf-m-bust-01.png` | `Subject: an elf man adventurer-recruit, adult. Long pointed ears, narrow angular face, lean build. Light warm-beige skin, shoulder-length straight silver-blond hair, pale amber eyes.` |
| `hero-dwarf-f-bust-01.png` | `Subject: a dwarf woman adventurer-recruit, adult. Broad sturdy shoulders, strong jaw, wide nose, thick braided auburn hair, ruddy weathered tan skin, dark brown eyes. Stocky, powerful build.` |
| `hero-dwarf-m-bust-01.png` | `Subject: a dwarf man adventurer-recruit, adult. Very broad shoulders and thick neck, full braided dark-brown beard, heavy brow, ruddy weathered skin, dark eyes. Stocky, powerful build.` |
| `hero-halfling-f-bust-01.png` | `Subject: a halfling woman adventurer-recruit, a grown adult of small stature (about 3 ft) with naturalistic adult features, not child-like. Round friendly face, curly chestnut hair, warm tan skin, hazel eyes.` |
| `hero-halfling-m-bust-01.png` | `Subject: a halfling man adventurer-recruit, a grown adult of small stature (about 3 ft) with naturalistic adult features, not child-like. Round face, short curly brown hair, light stubble, warm tan skin, brown eyes.` |
| `hero-gnome-f-bust-01.png` | `Subject: a gnome woman adventurer-recruit, a grown adult of small stature (about 3 ft) with naturalistic adult features, not child-like. Large expressive eyes, small pointed ears, sharp nose, bright copper hair in a practical knot, fair skin with freckles.` |
| `hero-gnome-m-bust-01.png` | `Subject: a gnome man adventurer-recruit, a grown adult of small stature (about 3 ft) with naturalistic adult features, not child-like. Large bright eyes, small pointed ears, long nose, short ash-white hair and trimmed beard, light tan skin.` |

---

*Why the reference images matter:* the style bible (`output/art-style-bible.md` §2, §4) says the
lighting and finish are locked. Attaching two existing busts is what keeps a new batch matching the
old one.
