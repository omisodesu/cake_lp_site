declare function gtag(...args: any[]): void;

document.addEventListener('DOMContentLoaded', () => {
  // --- CTA クリックイベント ---
  document.querySelectorAll('[data-cta-location]').forEach((el) => {
    el.addEventListener('click', () => {
      if (typeof gtag !== 'function') return;
      const element = el as HTMLElement;
      gtag('event', 'cta_click', {
        cta_location: element.dataset.ctaLocation || '',
        cta_type: element.dataset.ctaType || '',
      });
    });
  });

  // --- 導入事例クリックイベント ---
  document.querySelectorAll('.testimonial-card__link').forEach((el) => {
    el.addEventListener('click', () => {
      if (typeof gtag !== 'function') return;
      const element = el as HTMLElement;
      gtag('event', 'case_study_click', {
        case_name: element.dataset.caseName || '',
      });
    });
  });

  // --- スクロール深度イベント（LPトップページのみ） ---
  if (window.location.pathname === '/') {
    const scrollThresholds = [25, 50, 75, 100];
    const firedThresholds = new Set<number>();
    let ticking = false;

    function checkScrollDepth() {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const percent = Math.round((window.scrollY / docHeight) * 100);

      for (const threshold of scrollThresholds) {
        if (percent >= threshold && !firedThresholds.has(threshold)) {
          firedThresholds.add(threshold);
          if (typeof gtag === 'function') {
            gtag('event', 'scroll_depth', { percent: threshold });
          }
        }
      }
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          checkScrollDepth();
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }
});
