"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * App-level inertial smooth scroll. Disabled when the user prefers reduced
 * motion so we never fight their accessibility setting.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      // Smooth-scroll in-page `#section` links (e.g. the landing nav). The
      // offset clears the fixed 64px header so section headings aren't hidden.
      anchors: { offset: -80 },
    });

    let frame = 0;
    function raf(time: number) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    }
    frame = requestAnimationFrame(raf);

    // Lenis drives scrolling from window `wheel` events, which sidesteps the
    // `overflow: hidden` body lock that Radix modals apply via
    // react-remove-scroll — so without this, scrolling inside an open dialog
    // (⌘K palette, sheets, …) still scrolls the page behind it. react-remove
    // -scroll-bar tags <body> with `data-scroll-locked` whenever a modal locks
    // scroll; mirror that by pausing Lenis so the modal's own scroll container
    // takes over, and resume once every modal has closed.
    const syncLenisWithScrollLock = () => {
      if (document.body.hasAttribute("data-scroll-locked")) {
        lenis.stop();
      } else {
        lenis.start();
      }
    };
    syncLenisWithScrollLock();
    const observer = new MutationObserver(syncLenisWithScrollLock);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-scroll-locked"],
    });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      lenis.destroy();
    };
  }, []);

  return null;
}
