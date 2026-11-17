import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function animateHeroSequence(
  bgEl: HTMLElement | null,
  titleEl: HTMLElement | null,
  searchEl: HTMLElement | null
): (() => void) | undefined {
  if (typeof window === 'undefined') return undefined;

  const titleChildren = titleEl
    ? Array.from(titleEl.querySelectorAll<HTMLElement>('.cerim-hero-item'))
    : [];
  const titleTargets: HTMLElement[] =
    titleChildren.length > 0 ? titleChildren : titleEl ? [titleEl] : [];

  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: reduce)', () => {
    const allTargets = [bgEl, ...titleTargets, searchEl].filter(
      (el): el is HTMLElement => Boolean(el)
    );
    if (allTargets.length > 0) {
      gsap.set(allTargets, {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        clearProps: 'transform,opacity',
      });
    }
  });

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    if (bgEl) {
      tl.fromTo(
        bgEl,
        { opacity: 0, scale: 1.08 },
        {
          opacity: 1,
          scale: 1,
          duration: 1.0,
          clearProps: 'transform,opacity',
        },
        0
      );
    }

    if (titleTargets.length > 0) {
      tl.fromTo(
        titleTargets,
        { opacity: 0, y: 22 },
        {
          opacity: 1,
          y: 0,
          duration: 0.55,
          stagger: 0.09,
          clearProps: 'transform,opacity',
        },
        0.22
      );
    }

    if (searchEl) {
      tl.fromTo(
        searchEl,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.55,
          clearProps: 'transform,opacity',
        },
        0.54
      );
    }
  });

  return () => mm.revert();
}

export function animateCardsScroll(containerEl: HTMLElement | null): (() => void) | undefined {
  if (!containerEl || typeof window === 'undefined') return undefined;
  const cards = containerEl.querySelectorAll<HTMLElement>('.cerim-card-anim');
  if (!cards.length) return undefined;

  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: reduce)', () => {
    gsap.set(cards, { opacity: 1, y: 0, clearProps: 'transform,opacity' });
  });

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    gsap.fromTo(
      cards,
      { opacity: 0, y: 24 },
      {
        opacity: 1,
        y: 0,
        duration: 0.45,
        stagger: 0.08,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
        scrollTrigger: {
          trigger: containerEl,
          start: 'top 85%',
          once: true,
        },
      }
    );
  });

  return () => mm.revert();
}

