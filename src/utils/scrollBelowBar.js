/**
 * Brings a section of an analytics page to the top of the screen, just under the page's sticky
 * filter bar, by scrolling the element's own scroll container.
 *
 * WHY NOT `scrollIntoView` WITH `scroll-margin-top`. Measured 2026-10-22 on the admin page, iPhone 13
 * emulation: `scrollIntoView({ block: "start" })` on the assistants section scrolled
 * #app-central-content to its maximum (3923 of 3923) and left the section 138px above the screen,
 * margin or not; and a fixed margin is wrong anyway when the bar's height changes (one line on a
 * phone, wrapped on a tablet). This measures both and sets `scrollTop` once.
 */
export function scrollBelowBar(el) {
    if (!el || typeof el.getBoundingClientRect !== "function") return;
    const scroller = scrollContainerOf(el);
    if (!scroller) return;
    const bar = scroller.querySelector(".analytics-filter-bar");
    const barHeight = bar ? bar.getBoundingClientRect().height : 0;
    const offset = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    scroller.scrollTop = Math.max(0, scroller.scrollTop + offset - barHeight - 8);
}

function scrollContainerOf(el) {
    for (let node = el.parentElement; node; node = node.parentElement) {
        const overflowY = getComputedStyle(node).overflowY;
        if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) return node;
    }
    return document.scrollingElement || null;
}
