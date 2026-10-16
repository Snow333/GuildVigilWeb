/**
 * Playtest note (output/working-agreement.md §7): Steven types a note, the game
 * downloads it as JSON with the screen, a text snapshot of what was on screen,
 * and the full save state, so feedback arrives with context. `pnpm notes`
 * collects the files from Downloads into output/playtest/inbox/.
 *
 * The game runs from file:// and cannot write into the repo, hence the download.
 */

import { useState } from 'react';
import { useGame } from '../state/GameProvider';
import { overlayButton } from './overlayStyle';

export const NOTE_FILE_PREFIX = 'gv-note-';

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function NoteButton() {
  const { session, screen, campaignName } = useGame();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  const save = (): void => {
    const now = new Date();
    const main = document.querySelector('main');
    const note = {
      kind: 'guild-vigil-playtest-note',
      version: 1,
      createdAt: now.toISOString(),
      note: text.trim(),
      screen,
      campaignName,
      week: session?.currentWeek() ?? null,
      gold: session?.goldAmount() ?? null,
      roster: session?.roster().map((h) => ({ name: h.name, level: h.level, status: h.status })) ?? [],
      // What Steven was looking at, as text — cheaper and more searchable than a screenshot.
      screenText: (main?.innerText ?? '').slice(0, 6000),
      saveState: session?.serialize() ?? null,
    };
    const blob = new Blob([JSON.stringify(note, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const name = `${NOTE_FILE_PREFIX}${stamp(now)}.json`;
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSaved(name);
    setText('');
    setOpen(false);
  };

  return (
    <div data-gv-note="" style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 9000, fontFamily: 'system-ui, sans-serif' }}>
      {open ? (
        <div style={{ background: '#fffaf0', border: '2px solid #5a4630', borderRadius: 8, padding: 10, width: 320, boxShadow: '0 4px 16px rgba(0,0,0,.3)' }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Playtest note</div>
          <textarea
            autoFocus
            data-gv-note-text=""
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && text.trim()) save();
              if (e.key === 'Escape') setOpen(false);
            }}
            placeholder="What felt good, bad, confusing, boring…"
            rows={5}
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 15 }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
            <button style={overlayButton} disabled={!text.trim()} onClick={save} data-gv-note-save="">
              Save note
            </button>
            <button style={overlayButton} onClick={() => setOpen(false)}>Cancel</button>
            <span style={{ fontSize: 12, color: '#666' }}>Ctrl+Enter saves</span>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saved && <span style={{ fontSize: 12, background: '#fffaf0', padding: '2px 6px', borderRadius: 4 }}>Saved {saved}</span>}
          <button style={overlayButton} onClick={() => { setSaved(null); setOpen(true); }} data-gv-note-open="" title="Leave a playtest note">
            ✎ Note
          </button>
        </div>
      )}
    </div>
  );
}
