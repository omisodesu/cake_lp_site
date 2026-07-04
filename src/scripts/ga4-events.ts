declare function gtag(...args: any[]): void;

function init() {
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

  // --- ナビクリックイベント ---
  document.querySelectorAll('[data-nav-name]').forEach((el) => {
    el.addEventListener('click', () => {
      if (typeof gtag !== 'function') return;
      const element = el as HTMLElement;
      gtag('event', 'nav_click', {
        nav_name: element.dataset.navName || '',
      });
    });
  });

  // --- お知らせバー閉じるイベント ---
  document.querySelector('[data-announcement-close]')?.addEventListener('click', () => {
    if (typeof gtag !== 'function') return;
    gtag('event', 'announcement_bar_close');
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

  // --- 事例ページ関連リンククリックイベント ---
  document.querySelectorAll('[data-case-link-kind]').forEach((el) => {
    el.addEventListener('click', () => {
      if (typeof gtag !== 'function') return;
      const element = el as HTMLElement;
      gtag('event', 'case_related_click', {
        case_link_kind: element.dataset.caseLinkKind || '',
        case_name: element.dataset.caseName || '',
      });
    });
  });

  // --- セクション視認イベント（汎用） ---
  // 使い方: 計測したい要素に data-section-view="<セクションID>" を付与するだけでよい。
  // 50%以上可視になった初回のみ section_view を送信し、unobserve で同一セクションの重複発火を防ぐ。
  const sectionViewTargets = document.querySelectorAll('[data-section-view]');
  if (sectionViewTargets.length > 0 && 'IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        if (typeof gtag !== 'function') return;
        gtag('event', 'section_view', {
          section: (entry.target as HTMLElement).dataset.sectionView || '',
        });
      });
    }, { threshold: 0.5 });
    sectionViewTargets.forEach((el) => sectionObserver.observe(el));
  }

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
}

// モジュールスクリプトは実行時点で既にDOMContentLoadedが発火済みの場合があり、
// リスナー登録だけでは init が永遠に呼ばれない。readyState で分岐する（第3弾補修1）
if (document.readyState !== 'loading') {
  init();
} else {
  document.addEventListener('DOMContentLoaded', init);
}
