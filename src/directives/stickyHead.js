import { scrollContainerOf } from "@/utils/scrollBelowBar";
import "./stickyHead.less";

/**
 * `v-sticky-head` on a table's wrapper: the table's header row stays in view, under the page's sticky bars, while any
 * of its rows is on screen (brief docs/briefs/2026-10-31-analytics-ux.md, O4).
 *
 * WHY NOT `position: sticky` ON THE HEADER. The analytics tables sit in an `overflow-x: auto` wrapper (so that a wide
 * table scrolls sideways with its business column frozen), and an element in a scroll container sticks to that
 * container, which never scrolls vertically: the header scrolled away with the page. Taking the overflow away would
 * lose the sideways scroll; cloning the header into a sticky container of its own would duplicate the sort buttons
 * and their `aria-sort`. Instead the real header cells are moved down by the distance the table's top has passed the
 * reference line, never further than the table's own bottom, so they stay inside the table's box (the wrapper does
 * not clip them), the frozen column's `position: sticky; left: 0` keeps working, and the sort buttons are the same
 * elements. Each `th` is moved rather than the `thead`, because a transform on a row group is not drawn the same way
 * by every engine, while a cell is.
 *
 * THE REFERENCE LINE is the top of the page's scroll container (the pages scroll inside `#app-central-content`, not
 * the window, and the navbar is outside it) or, lower, the bottom of any element inside it marked
 * `data-sticky-anchor` (the analytics filter bar). The container is looked up when a scroll or a resize happens, not at
 * mount: `scrollContainerOf` needs the content to overflow already, and before that it would answer the document.
 * Scroll events do not bubble, so one capture-phase listener on the document sees the container's scroll; a
 * ResizeObserver on the table catches a row expanded, a page changed, a column grown.
 *
 * Off under 641 px, where the tables draw their rows as cards and no header row is shown.
 */
const NARROW = 641;

// The table's own header cells: a table nested in one of its rows (an expanded row's list) has its own.
function ownTable(el) {
  return el.querySelector("table");
}

function cells(el) {
  const table = ownTable(el);
  return table && table.tHead ? table.tHead.querySelectorAll(":scope > tr > th") : [];
}

function clear(el) {
  cells(el).forEach((th) => { th.style.transform = ""; });
}

// Where a header stuck under `top` has its top, from the table's own box (the transform it carries now is not read, so
// the order the tables are placed in does not matter).
function stuckTop(table, top) {
  const t = table.getBoundingClientRect();
  const head = table.tHead.getBoundingClientRect().height;
  return t.top + Math.min(Math.max(top - t.top, 0), Math.max(0, t.height - head));
}

function line(scroller, el) {
  const isDocument = scroller === document.scrollingElement || scroller === document.documentElement;
  let top = isDocument ? 0 : scroller.getBoundingClientRect().top;
  scroller.querySelectorAll("[data-sticky-anchor]").forEach((anchor) => {
    const r = anchor.getBoundingClientRect();
    if (r.height > 0) top = Math.max(top, r.bottom);
  });
  // a table inside a row of another sticky-headed table stops under that table's header, outermost first
  const outer = [];
  for (let node = el.parentElement; node && node !== scroller; node = node.parentElement) {
    if (node.hasAttribute("data-sticky-head")) outer.unshift(node);
  }
  outer.forEach((node) => {
    const table = ownTable(node);
    if (table && table.tHead) top = Math.max(top, stuckTop(table, top) + table.tHead.getBoundingClientRect().height);
  });
  return top;
}

function place(state) {
  state.frame = null;
  const { el } = state;
  const table = ownTable(el);
  if (!table || !table.tHead || window.innerWidth < NARROW) { clear(el); return; }
  if (!state.scroller || state.scroller === document.scrollingElement) state.scroller = scrollContainerOf(el);
  if (!state.scroller) return;
  const offset = stuckTop(table, line(state.scroller, el)) - table.getBoundingClientRect().top;
  const value = offset > 0 ? "translateY(" + offset + "px)" : "";
  cells(el).forEach((th) => { if (th.style.transform !== value) th.style.transform = value; });
}

function schedule(state) {
  if (state.frame == null) state.frame = window.requestAnimationFrame(() => place(state));
}

export default {
  mounted(el) {
    const state = { el, scroller: null, frame: null };
    state.onScroll = (event) => {
      const target = event.target;
      if (target === document || (target && typeof target.contains === "function" && target.contains(el))) schedule(state);
    };
    state.onResize = () => schedule(state);
    el.setAttribute("data-sticky-head", "");
    document.addEventListener("scroll", state.onScroll, { capture: true, passive: true });
    window.addEventListener("resize", state.onResize, { passive: true });
    if (typeof ResizeObserver === "function") {
      state.observer = new ResizeObserver(() => schedule(state));
      state.observer.observe(el);
    }
    el.__stickyHead = state;
    schedule(state);
  },
  updated(el) {
    if (el.__stickyHead) schedule(el.__stickyHead);
  },
  unmounted(el) {
    const state = el.__stickyHead;
    if (!state) return;
    document.removeEventListener("scroll", state.onScroll, { capture: true });
    window.removeEventListener("resize", state.onResize);
    if (state.observer) state.observer.disconnect();
    if (state.frame != null) window.cancelAnimationFrame(state.frame);
    delete el.__stickyHead;
  },
};
