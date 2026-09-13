/**
 * THE ITEM TOOLTIP (brief #24, Variant G).
 *
 * ⚠ A TOOLTIP IS AN ACCESSIBILITY TRAP UNLESS IT IS BUILT DELIBERATELY, so
 * this one follows WAI-ARIA's tooltip pattern rather than a bare CSS :hover:
 *
 *   - it opens on FOCUS as well as hover, so it is reachable by keyboard
 *   - Escape dismisses it without moving focus (APG requirement)
 *   - the trigger owns `aria-describedby`, so a screen reader announces the
 *     contents instead of silently skipping a visual-only layer
 *   - it never contains interactive content: everything inside is also
 *     available in the inspector panel, because a hover-only affordance is
 *     unusable on touch and the sheet must stay fully usable without it
 *
 * ⚠ AND IT IS NOT THE ONLY PATH TO THIS INFORMATION. Clicking the slot still
 * opens the inspector with the same facts. The tooltip is an accelerator for
 * a mouse user, not the sole home of the data.
 */

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ItemContribution } from '@sim/campaign/session';

export interface ItemTooltipData {
  name: string;
  slot: string | null;
  category: string;
  /** e.g. '1d8', for weapons. */
  damage?: string | null;
  price?: number | null;
  contributions: readonly ItemContribution[];
  /** Named reasons this item is underperforming, if any. */
  warnings?: readonly string[];
}

/**
 * Position the panel next to its trigger, flipping when it would leave the
 * viewport.
 *
 * ⚠ MEASURED AFTER PAINT, NOT GUESSED. The panel's height depends on how many
 * contribution rows an item has, so a fixed offset clips the tall ones off the
 * bottom of the window. useLayoutEffect reads the real box before the browser
 * paints, so there is no visible jump.
 */
function useAnchoredPosition(
  open: boolean,
  anchor: HTMLElement | null,
  panel: HTMLElement | null,
): { left: number; top: number } {
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!open || !anchor || !panel) return;
    const a = anchor.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    /**
     * ⚠ AVOID THE WHOLE PANEL, NOT JUST THE TRIGGER.
     *
     * Two earlier versions failed the same way. Anchoring to the trigger's own
     * rect — right side first, then "flip on viewport overflow" — kept landing
     * the panel on top of the head and accessory slots: technically on-screen,
     * but covering the sibling slots the player is comparing against, which is
     * the one thing a comparison tooltip must never do.
     *
     * The rect to clear is the CONTAINER the trigger sits in. Measuring
     * `closest('.gv-sheet')` puts the panel beside the whole paperdoll column,
     * so it cannot cover a sibling slot however the doll is laid out.
     */
    const container = anchor.closest('.gv-sheet') ?? anchor;
    const box = container.getBoundingClientRect();
    const GAP = 12;

    const roomRight = window.innerWidth - box.right;
    const roomLeft = box.left;
    let left = roomRight >= p.width + GAP + 8 || roomRight >= roomLeft
      ? box.right + GAP
      : box.left - p.width - GAP;
    if (left + p.width > window.innerWidth - 8) left = window.innerWidth - p.width - 8;
    if (left < 8) left = 8;

    /**
     * Vertically track the TRIGGER (so the panel reads as belonging to the
     * slot under the cursor) while staying inside the viewport.
     */
    let top = a.top + a.height / 2 - p.height / 2;
    top = Math.max(8, Math.min(top, window.innerHeight - p.height - 8));

    setPos({ left, top });
  }, [open, anchor, panel]);

  return pos;
}

export function ItemTooltip({
  data,
  children,
  className,
  ...rest
}: {
  data: ItemTooltipData | null;
  children: React.ReactNode;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  /**
   * ⚠ STATE, NOT A REF — a ref does not re-render, so the positioning effect
   * ran once with `panelRef.current === null`, bailed out, and never ran
   * again. Measured: the panel shipped with `style="left: 0px; top: 0px"`.
   * A callback ref stored in state re-renders when the node mounts, which is
   * what makes the measurement happen at all.
   */
  const [panelEl, setPanelEl] = useState<HTMLDivElement | null>(null);
  const panelRef = useCallback((node: HTMLDivElement | null) => setPanelEl(node), []);
  const id = useId();
  const pos = useAnchoredPosition(open, anchorRef.current, panelEl);

  /** ⚠ Escape closes it (WAI-ARIA APG), and the listener is scoped to open. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const show = open && data !== null;

  return (
    <>
      <button
        {...rest}
        ref={anchorRef}
        type="button"
        className={className}
        aria-describedby={show ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children}
      </button>

      {/*
        ⚠ PORTALLED TO document.body, AND THAT IS LOAD-BEARING.
        `position: fixed` is viewport-relative ONLY while no ancestor has a
        transform, filter or perspective — any of those create a new
        containing block and the panel's coordinates silently become relative
        to that ancestor instead. The sheet's cards carry a slight rotate for
        the paper look, so an inline tooltip measured 591px from a container
        at 590px: correct arithmetic, wrong origin. The portal removes the
        ancestor entirely rather than fighting it.
      */}
      {show && createPortal(
        <div
          ref={panelRef}
          id={id}
          role="tooltip"
          className="gv-tip"
          style={{ left: pos.left, top: pos.top }}
        >
          <div className="gv-tip-head">
            <span className="gv-tip-name">{data.name}</span>
            <span className="gv-tip-cat">
              {data.slot ? data.slot.replace('_', ' ') : data.category}
            </span>
          </div>

          {data.damage && (
            <div className="gv-tip-stat">
              <span>Damage</span><b>{data.damage}</b>
            </div>
          )}

          {data.contributions.length === 0
            ? <p className="gv-tip-none">Carries no effect the sheet can measure.</p>
            : (
              <div className="gv-tip-rows">
                {data.contributions.map((c, i) => (
                  <div className="gv-tip-row" key={i} data-live={c.live ? 'yes' : 'no'}>
                    <span className="gv-dot" data-kind={c.kind} />
                    <span className="gv-tip-label">
                      {c.label}
                      {/* ⚠ the word, not just the colour — greyscale must survive */}
                      {!c.live && <span className="gv-badge gv-badge--dead">not built</span>}
                      <small>{c.detail}</small>
                    </span>
                  </div>
                ))}
              </div>
            )}

          {data.warnings && data.warnings.length > 0 && (
            <div className="gv-tip-warn">
              {data.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
            </div>
          )}

          {data.price != null && (
            <div className="gv-tip-foot">worth {data.price}g</div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
