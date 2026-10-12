/**
 * Writes held back for a few seconds so that a person can take them back: the Undo of a change the server
 * cannot reverse. Declining a restaurant request is one: a declined request must never be revived into a
 * booking, so the server has no reverse for it, and the page sends the decline only once the Undo window has
 * passed, or at once when the page is left.
 *
 * `schedule(key, run, ms)` holds `run` for `ms`; `cancel(key)` drops it unsent (the Undo); `flush()` sends
 * everything still held, now (leaving the page). A key is held once: scheduling it again replaces the first.
 * `run` is called at most once; `onSend(key)` is told just before, so whatever offered its Undo can go with it.
 * What `run` returns (a promise) is handed to `onSettled(key, error)`.
 *
 * What it does not cover: a tab killed or a machine switched off inside the window loses the held write,
 * since nothing was sent; a write flushed while the page unloads may be cut off by the browser before it
 * reaches the server. Both leave the request undecided, never decided twice.
 */
export default class DeferredCommit {
    // The timers are called as plain functions: a browser's setTimeout called as a method of this object
    // throws "Illegal invocation" (seen in the browser suite on 2026-10-12; jsdom's does not).
    constructor({ onSend = () => {}, onSettled = () => {}, setTimer = (f, ms) => setTimeout(f, ms), clearTimer = t => clearTimeout(t) } = {}) {
        this.held = new Map();
        this.onSend = onSend;
        this.onSettled = onSettled;
        this.setTimer = setTimer;
        this.clearTimer = clearTimer;
    }

    schedule(key, run, ms) {
        this.cancel(key);
        const timer = this.setTimer(() => this.send(key), ms);
        this.held.set(key, { run, timer });
    }

    /** Whether `key` is still held: sent neither by expiry nor by a flush, nor cancelled. */
    pending(key) {
        return this.held.has(key);
    }

    /** Drops a held write unsent. True when there was one. */
    cancel(key) {
        const entry = this.held.get(key);
        if (!entry) return false;
        this.clearTimer(entry.timer);
        this.held.delete(key);
        return true;
    }

    /** Sends every held write now. */
    flush() {
        return Promise.all(Array.from(this.held.keys()).map(key => this.send(key)));
    }

    send(key) {
        const entry = this.held.get(key);
        if (!entry) return Promise.resolve();
        this.clearTimer(entry.timer);
        this.held.delete(key);
        this.onSend(key);
        return Promise.resolve().then(entry.run).then(() => this.onSettled(key, null), error => this.onSettled(key, error));
    }
}
