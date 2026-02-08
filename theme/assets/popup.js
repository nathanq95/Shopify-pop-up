import { Component } from '@theme/component';

const DEFAULTS = {
  trigger: 'delay', // 'delay' | 'scroll'
  delayMs: 3000,
  scrollPercent: 50,
  dismissHours: 0, // 0 = no persistence
};

const STORAGE_PREFIX = 'goodr_popup_dismissed_';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/**
 * Popup component with:
 * - Exclusive trigger (delay OR scroll)
 * - Persisted dismiss state (localStorage with TTL; dismissHours=0 disables)
 * - Accessible modal behavior (focus in, trap, ESC, restore focus)
 * - Scroll lock while open
 * - Integration stub logging
 *
 * Required markup refs:
 * - overlay
 * - dialog
 * - close
 * - cta
 * - secondary
 *
 * @typedef {object} Refs
 * @property {HTMLElement} overlay
 * @property {HTMLElement} dialog
 * @property {HTMLButtonElement} close
 * @property {HTMLElement} cta
 * @property {HTMLButtonElement} secondary
 *
 * @extends Component<Refs>
 */
class PopupComponent extends Component {
  requiredRefs = ['overlay', 'dialog', 'close', 'cta', 'secondary'];

  connectedCallback() {
    super.connectedCallback();

    this.#cfg = this.#readConfig();
    this.#storageKey =
      `${STORAGE_PREFIX}${this.getAttribute('data-section-id') || this.id || 'default'}`;

    this.refs.close.addEventListener('click', () => this.close('close'));
    this.refs.overlay.addEventListener('click', () => this.close('overlay'));
    this.refs.secondary.addEventListener('click', () => this.close('secondary'));
    this.refs.cta.addEventListener('click', () => this.close('cta'));

    document.addEventListener('keydown', this.#onKeyDown);

    if (!this.classList.contains('is-open')) {
      this.setAttribute('aria-hidden', 'true');
    }

    if (this.#isDismissed()) return;

    this.#attachTrigger();
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    document.removeEventListener('keydown', this.#onKeyDown);

    this.#detachTrigger?.();
    this.#detachTrigger = null;

    this.#unlockScroll?.();
    this.#unlockScroll = null;
  }

  /** @type {typeof DEFAULTS} */
  #cfg = { ...DEFAULTS };

  /** @type {string} */
  #storageKey = `${STORAGE_PREFIX}default`;

  /** @type {(() => void) | null} */
  #detachTrigger = null;

  /** @type {HTMLElement | null} */
  #lastActive = null;

  /** @type {(() => void) | null} */
  #unlockScroll = null;

  #readConfig() {
    const raw = this.getAttribute('data-config');
    if (!raw) return { ...DEFAULTS };

    try {
      const parsed = JSON.parse(raw);
      return {
        trigger: parsed.trigger === 'scroll' ? 'scroll' : 'delay',
        delayMs: Number(parsed.delayMs ?? DEFAULTS.delayMs),
        scrollPercent: Number(parsed.scrollPercent ?? DEFAULTS.scrollPercent),
        dismissHours: Number(parsed.dismissHours ?? DEFAULTS.dismissHours),
      };
    } catch {
      return { ...DEFAULTS };
    }
  }

  #attachTrigger() {
    if (this.#cfg.trigger === 'delay') {
      const ms = clamp(Number(this.#cfg.delayMs) || 0, 0, 120000);
      const t = window.setTimeout(() => this.open('delay'), ms);
      this.#detachTrigger = () => window.clearTimeout(t);
      return;
    }

    // ---- FIXED SCROLL TRIGGER ----
    const threshold = clamp(Number(this.#cfg.scrollPercent) || 0, 1, 95);

    const scrollingEl = /** @type {HTMLElement} */ (
      document.scrollingElement || document.documentElement
    );

    const getScrollPercent = () => {
      const max = Math.max(0, scrollingEl.scrollHeight - window.innerHeight);
      if (max === 0) return { pct: 0, max: 0 };
      return { pct: (scrollingEl.scrollTop / max) * 100, max };
    };

    const maybeOpen = () => {
      const { pct, max } = getScrollPercent();

      // If the page cannot scroll, a percent-based trigger can never be satisfied.
      // Fallback: open on first scroll intent (wheel/touch) OR after a short delay.
      if (max === 0) return;

      if (pct >= threshold) {
        cleanup();
        this.open('scroll');
      }
    };

    const onScroll = () => maybeOpen();

    const onScrollIntent = () => {
      // User tried to scroll but page may be too short. Open anyway (common in Theme Editor preview).
      const { max } = getScrollPercent();
      if (max === 0) {
        cleanup();
        this.open('scroll_intent_fallback');
      }
    };

    const cleanup = () => {
      window.removeEventListener('scroll', onScroll);
      scrollingEl.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', onScrollIntent);
      window.removeEventListener('touchmove', onScrollIntent);
    };

    // Listen on both. Some environments fire scroll on the scrolling element, not window.
    window.addEventListener('scroll', onScroll, { passive: true });
    scrollingEl.addEventListener('scroll', onScroll, { passive: true });

    // Intent fallbacks for non-scrollable pages
    window.addEventListener('wheel', onScrollIntent, { passive: true });
    window.addEventListener('touchmove', onScrollIntent, { passive: true });

    // Initial check after layout
    requestAnimationFrame(() => {
      maybeOpen();
    });

    this.#detachTrigger = cleanup;
  }

  open = (reason = 'manual') => {
    if (this.#isDismissed()) return;

    this.#lastActive = /** @type {HTMLElement | null} */ (document.activeElement);

    this.classList.add('is-open');
    this.setAttribute('aria-hidden', 'false');

    this.#detachTrigger?.();
    this.#detachTrigger = null;

    this.#unlockScroll?.();
    this.#unlockScroll = this.#lockScroll();
    this.#focusFirst();

    this.#track('popup_opened', { reason, trigger: this.#cfg.trigger });
  };

  close = (reason = 'close') => {
    this.classList.remove('is-open');
    this.setAttribute('aria-hidden', 'true');

    if ((Number(this.#cfg.dismissHours) || 0) > 0) {
      this.#markDismissed();
    }

    this.#unlockScroll?.();
    this.#unlockScroll = null;

    this.#track('popup_dismissed', { reason });

    this.#lastActive?.focus?.({ preventScroll: true });
    this.#lastActive = null;
  };

  #onKeyDown = (e) => {
    if (!this.classList.contains('is-open')) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      this.close('escape');
      return;
    }

    if (e.key !== 'Tab') return;

    const focusables = this.#focusables().filter((el) => el.offsetParent !== null);
    if (focusables.length === 0) {
      e.preventDefault();
      this.refs.dialog.focus?.({ preventScroll: true });
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = /** @type {HTMLElement | null} */ (document.activeElement);

    if (e.shiftKey) {
      if (active === first || active === this.refs.dialog) {
        e.preventDefault();
        last.focus?.({ preventScroll: true });
      }
    } else {
      if (active === last) {
        e.preventDefault();
        first.focus?.({ preventScroll: true });
      }
    }
  };

  #focusables() {
    return /** @type {HTMLElement[]} */ (
      Array.from(this.refs.dialog.querySelectorAll(FOCUSABLE))
    );
  }

  #focusFirst() {
    this.refs.close.focus({ preventScroll: true });
  }

  #lockScroll() {
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }

  #isDismissed() {
    const hours = Number(this.#cfg.dismissHours) || 0;
    if (hours <= 0) return false;

    try {
      const raw = localStorage.getItem(this.#storageKey);
      if (!raw) return false;

      const data = JSON.parse(raw);
      const dismissedAt = Number(data?.dismissedAt || 0);
      if (!dismissedAt) return false;

      const ttlMs = clamp(hours, 0, 24 * 30) * 60 * 60 * 1000;
      return Date.now() - dismissedAt < ttlMs;
    } catch {
      return false;
    }
  }

  #markDismissed() {
    try {
      localStorage.setItem(this.#storageKey, JSON.stringify({ dismissedAt: Date.now() }));
    } catch {
      // ignore
    }
  }

  #track(name, payload = {}) {
    // eslint-disable-next-line no-console
    console.log(`[goodr-popup] ${name}`, payload);
  }
}

if (!customElements.get('popup-component')) {
  customElements.define('popup-component', PopupComponent);
}