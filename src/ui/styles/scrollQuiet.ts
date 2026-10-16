/**
 * Scroll-quiet (Track P). While the page scrolls, the sheets slide under a
 * mouse that is standing still. Every sheet that passes under the pointer gets
 * `:hover`, which lifts it (a transform plus a bigger box-shadow) and repaints
 * a large, textured sheet at high-DPI. On a 4x-throttled CPU that was the main
 * cause of dropped frames on the dispatch and after-action screens.
 *
 * Fix: `body.gv-scrolling` switches the hover lift off while the page moves
 * (see materials.css), and it comes back 150 ms after the last scroll event.
 * Nothing is lost: the lift is decoration, and it works the moment scrolling stops.
 *
 * One passive listener, no layout reads, no per-frame work.
 */

const IDLE_MS = 150;

export function installScrollQuiet(target: Window = window, body: HTMLElement = document.body): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const onScroll = (): void => {
    if (timer === null) body.classList.add('gv-scrolling');
    else clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      body.classList.remove('gv-scrolling');
    }, IDLE_MS);
  };
  // `capture` so scrolling inside a nested box (the beat feed) counts too.
  target.addEventListener('scroll', onScroll, { passive: true, capture: true });
  return () => {
    target.removeEventListener('scroll', onScroll, { capture: true });
    if (timer !== null) clearTimeout(timer);
    body.classList.remove('gv-scrolling');
  };
}
