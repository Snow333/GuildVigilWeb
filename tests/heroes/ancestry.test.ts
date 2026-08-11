import { describe, expect, it } from 'vitest';
import { fnv1a32, fnv1aHex } from '@sim/core/hash';
import { ArtKeys } from '@sim/core/ids';
import {
  GENDERS, deriveHeroIdentity, isAncestryId, isGender, portraitKey,
} from '@sim/heroes/ancestry';
import { ancestryIds, ancestryNameById } from '@sim/registry';
import { signState } from '@platform/envelope';
import { portraits, PORTRAIT_KEYS } from '@content/generated/portraits';

describe('the house hash (no Math.random anywhere near identity)', () => {
  it('is FNV-1a and matches the save signature it replaced byte for byte', () => {
    // signState now delegates here; a drift would silently invalidate every
    // existing save's integrity check.
    for (const s of ['', 'a', 'hero_1', '{"v":1,"week":3}', 'Ω≈ç√']) {
      expect(fnv1aHex(s)).toBe(signState(s));
      expect(fnv1aHex(s)).toHaveLength(8);
    }
    expect(fnv1a32('')).toBe(0x811c9dc5);
  });
});

describe('deterministic hero identity (brief #10 decision 3)', () => {
  it('is a pure function of the hero id — same id, same face, forever', () => {
    for (const id of ['hero_1', 'hero_2', 'hero_3', 'hero_4', 'hero_57']) {
      const a = deriveHeroIdentity(id);
      const b = deriveHeroIdentity(id);
      expect(a).toEqual(b);
      expect(ancestryIds).toContain(a.ancestry);
      expect(GENDERS).toContain(a.gender);
    }
  });

  it('pins the exact backfill any existing save will receive', () => {
    // A snapshot in code, not a .snap: these four values are what a pre-#10
    // save's party becomes on first load, on every machine. Changing this
    // function changes veterans' faces — that is the point of pinning it.
    expect(['hero_1', 'hero_2', 'hero_3', 'hero_4'].map(deriveHeroIdentity)).toMatchInlineSnapshot(`
      [
        {
          "ancestry": 5,
          "gender": "f",
        },
        {
          "ancestry": 1,
          "gender": "f",
        },
        {
          "ancestry": 3,
          "gender": "m",
        },
        {
          "ancestry": 1,
          "gender": "m",
        },
      ]
    `);
  });

  it('does not correlate ancestry with gender (separate hash namespaces)', () => {
    // One namespace would tie the ancestry pick's parity to the gender pick.
    // Over 400 ids every ancestry×gender pair should appear at least once.
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const { ancestry, gender } = deriveHeroIdentity(`hero_${i}`);
      seen.add(`${ancestry}-${gender}`);
    }
    expect(seen.size).toBe(ancestryIds.length * GENDERS.length);
  });

  it('guards reject values that are not live registry ids', () => {
    expect(isAncestryId(ancestryIds[0])).toBe(true);
    expect(isAncestryId(999)).toBe(false);
    expect(isAncestryId('1')).toBe(false);
    expect(isAncestryId(undefined)).toBe(false);
    expect(isGender('f')).toBe(true);
    expect(isGender('x')).toBe(false);
  });
});

describe('portrait keys (bible §4 naming, executable)', () => {
  it('builds the key the art filenames carry', () => {
    const halfOrc = ancestryIds.find((id) => ancestryNameById.get(id) === 'Half-Orc')!;
    expect(portraitKey(halfOrc, 'f')).toBe('hero-halforc-f');
    expect(portraitKey(halfOrc, 'm')).toBe('hero-halforc-m');
    const human = ancestryIds.find((id) => ancestryNameById.get(id) === 'Human')!;
    expect(portraitKey(human, 'f')).toBe('hero-human-f');
  });

  it('every ancestry × gender resolves to a key, art or not', () => {
    for (const id of ancestryIds) {
      for (const g of GENDERS) {
        expect(portraitKey(id, g)).toMatch(/^hero-[a-z0-9]+-[fm]$/);
      }
    }
  });

  it('NPC and enemy keys hyphenate words (the bible\'s other slug rule)', () => {
    expect(ArtKeys.npc('Edrin Vale')).toBe('npc-edrin-vale');
    expect(ArtKeys.enemy('Warg Alpha')).toBe('enemy-warg-alpha');
    expect(ArtKeys.npc("Marshal O'Dell")).toBe('npc-marshal-o-dell');
  });
});

describe('generated portraits module + the silhouette fallback path', () => {
  it('carries exactly the batch-1 subjects, keyed as the sim asks for them', () => {
    expect([...PORTRAIT_KEYS].sort()).toEqual([
      'hero-halforc-f', 'hero-halforc-m', 'hero-human-f', 'hero-human-m',
    ]);
  });

  it('every payload is an inlined webp data URI (no runtime fetching, ever)', () => {
    for (const key of PORTRAIT_KEYS) {
      expect(portraits[key]).toMatch(/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/);
    }
  });

  it('THE FALLBACK IS THE COMMON CASE: 8 of 12 hero subjects have no art', () => {
    // Elf/Dwarf/Halfling/Gnome are parked pending the artist decision, so the
    // silhouette is a normal play path, not an error path. If this ever reads
    // 12/12, the fallback stopped being exercised in real play — keep a test
    // that pins the fallback behavior itself.
    const all = ancestryIds.flatMap((id) => GENDERS.map((g) => portraitKey(id, g)));
    expect(all).toHaveLength(12);
    const missing = all.filter((k) => !(k in portraits));
    expect(missing.sort()).toEqual([
      'hero-dwarf-f', 'hero-dwarf-m', 'hero-elf-f', 'hero-elf-m',
      'hero-gnome-f', 'hero-gnome-m', 'hero-halfling-f', 'hero-halfling-m',
    ]);
  });
});
