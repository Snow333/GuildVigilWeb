/**
 * Names for hired heroes.
 *
 * ⚠ WHY THIS EXISTS: `musterHero` falls back to `template.defaultName` when no
 * name is typed, and that is ONE name per class. The founding four are named
 * by the player at character creation, so nobody noticed — but every hire made
 * from the Tavern without typing a name came out identical. A guild with four
 * heroes all called "Torvald" is not a cosmetic problem: the band screen lists
 * who is in each band, and the whole point of a second band is deciding who
 * goes where.
 *
 * ⚠ WHY NOT REUSE THE DATABASE'S NAMES: `nation_leaders` (35) and
 * `legendary_scholars` (28) carry ancestry-tagged names and were the obvious
 * source, but they are SPECIFIC PEOPLE in the world — a random recruit called
 * "King Aldren Voss III" or "Queen Aelindra Starweave" would be nonsense and
 * would collide with story content later. These pools are authored instead,
 * following the naming style those tables establish (Aldren Voss, Seraine
 * Blackwood, Matthias Hale, Pyris Ashvane, Utvise Duskhollow, Karnij
 * Earthsong).
 *
 * Names are picked DETERMINISTICALLY from the campaign seed and the hire's
 * roster index, so a campaign replays identically and a save reloads to the
 * same guild.
 */

import { ancestries } from './generated/ancestries';

/**
 * ⚠ THE ID→NAME MAP IS PARSED FROM THE CONTENT, NOT RETYPED. `MusterChoice`
 * carries an ancestry ID; the pools are keyed by name because that is what
 * reads sensibly here. Deriving the bridge means adding an ancestry to the
 * database cannot silently desync it.
 */
const ANCESTRY_NAME_BY_ID = new Map<number, string>(
  (ancestries as readonly { id: number; name: string }[]).map((a) => [a.id, a.name]),
);

export interface NamePool {
  readonly given: readonly string[];
  readonly family: readonly string[];
}

/** Keyed by the ancestry NAME as `MusterChoice.ancestry` carries it. */
export const NAME_POOLS: Readonly<Record<string, NamePool>> = {
  Human: {
    given: ['Aldren', 'Seraine', 'Matthias', 'Rowan', 'Elsbeth', 'Corwin', 'Maret', 'Halden',
      'Ysolde', 'Bren', 'Catrin', 'Edmund', 'Lioba', 'Garrick', 'Nessa', 'Tobias'],
    family: ['Voss', 'Blackwood', 'Hale', 'Ashby', 'Merrow', 'Danforth', 'Kell', 'Rutheridge',
      'Wren', 'Stormholt', 'Marsh', 'Calloway'],
  },
  Elf: {
    given: ['Aelindra', 'Thessaly', 'Faelar', 'Nimriel', 'Caelum', 'Ysilme', 'Erevan', 'Lirael',
      'Sylvaine', 'Theron', 'Miravel', 'Aerith', 'Ithilwen', 'Daeron', 'Elowen', 'Galadir'],
    family: ['Starweave', 'Duskhollow', 'Silverbough', 'Moonwhisper', 'Nightbloom', 'Dawnreach',
      'Thornsong', 'Evenfall'],
  },
  Dwarf: {
    given: ['Durgan', 'Hilda', 'Brunor', 'Vesta', 'Thrain', 'Morag', 'Balin', 'Gerda',
      'Orsik', 'Helja', 'Dain', 'Runa', 'Bofri', 'Astrid', 'Kazek', 'Ingra'],
    family: ['Earthsong', 'Ironjaw', 'Stoneforge', 'Deepdelve', 'Hammerfall', 'Oreheart',
      'Gravelbeard', 'Anvilborn'],
  },
  Halfling: {
    given: ['Cosmo', 'Pippa', 'Milo', 'Rosie', 'Ferdy', 'Tilda', 'Wendel', 'Posy',
      'Bramble', 'Merry', 'Hob', 'Daisy', 'Nolan', 'Petra', 'Tomkin', 'Clover'],
    family: ['Fairweather', 'Harrow', 'Underbough', 'Goodbarrel', 'Tealeaf', 'Brightwater',
      'Thistledown', 'Applewhite'],
  },
  Gnome: {
    given: ['Pyris', 'Zelli', 'Fennick', 'Wimble', 'Orla', 'Tiddle', 'Navi', 'Bix',
      'Quilla', 'Jix', 'Mirri', 'Dabble', 'Kipp', 'Wendi', 'Sprig', 'Nix'],
    family: ['Ashvane', 'Cogspark', 'Fizzlebrook', 'Glimmerlock', 'Sprocketwhistle', 'Dimble',
      'Brasswick', 'Quickfuse'],
  },
  'Half-Orc': {
    given: ['Gorrah', 'Ruk', 'Vashka', 'Draven', 'Kessa', 'Ogrim', 'Mura', 'Thokk',
      'Rennick', 'Shala', 'Brak', 'Ygra', 'Hesk', 'Varra', 'Dro', 'Ulka'],
    family: ['Splitfang', 'Mor-Tal', 'Ironhand', 'Koss', 'Bloodmoor', 'Grimhowl',
      'Stonetusk', 'Redfell'],
  },
};

/** Every ancestry in `ancestries` has a pool; Human is the fallback for anything new. */
export const FALLBACK_ANCESTRY = 'Human';

/**
 * A name for a hire, chosen without randomness so the campaign is reproducible.
 *
 * ⚠ `seedN` MUST VARY PER HIRE or every recruit shares a name again — pass the
 * roster index, not a constant.
 *
 * ⚠ WHAT ACTUALLY GUARANTEES NO DUPLICATES IN ONE GUILD is that every pool's
 * GIVEN list is longer than the largest roster the Barracks allows (15 beds),
 * so the given name alone cannot repeat within a single guild. A test pins
 * that. The `* 7 + 3` offset on the surname is COSMETIC — it stops hires
 * pairing the two lists index-for-index — and an earlier comment here claimed
 * it deepened the pool, which is not true: with these lengths the repeat
 * period is the same either way. Kept, but no longer load-bearing.
 */
export function hireName(ancestryId: number, seedN: number): string {
  const ancestry = ANCESTRY_NAME_BY_ID.get(ancestryId) ?? FALLBACK_ANCESTRY;
  const pool = NAME_POOLS[ancestry] ?? NAME_POOLS[FALLBACK_ANCESTRY]!;
  const given = pool.given[seedN % pool.given.length]!;
  const family = pool.family[(seedN * 7 + 3) % pool.family.length]!;
  return `${given} ${family}`;
}
