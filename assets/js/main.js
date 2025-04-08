// いつでもケーキ LP JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // FAQアコーディオン機能
    const faqQuestions = document.querySelectorAll('.faq__question');
    
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            // 質問の状態を切り替え
            question.classList.toggle('active');
            
            // 対応する回答を取得
            const answer = question.nextElementSibling;
            answer.classList.toggle('active');
        });
    });

    // スムーススクロール
    const scrollLinks = document.querySelectorAll('a[href^="#"]');
    
    scrollLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 100,
                    behavior: 'smooth'
                });
            }
        });
    });

    // フォーム送信処理 (メール送信を mailto: で実装)
    const contactForm = document.getElementById('contact-form');

    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // フォームデータの取得
            const formData = new FormData(this);
            const storeName = formData.get('shop-name') || '';
            const name = formData.get('name') || '';
            const email = formData.get('email') || '';
            const phone = formData.get('phone') || '';
            const message = formData.get('message') || '';
            
            // mailto リンクの構築
            const subject = encodeURIComponent('いつでもケーキお問い合わせ');
            const body = encodeURIComponent(`店舗名: ${storeName}\nお名前: ${name}\nメールアドレス: ${email}\n電話番号: ${phone}\n内容: ${message}`);
            
            // mailto リンクにより既定のメールクライアントを起動
            window.location.href = `mailto:info@gadandan.co.jp?subject=${subject}&body=${body}`;
        });
    }

    // 数字カウントアップアニメーション
    const resultNumbers = document.querySelectorAll('.result-card__number');
    
    // Intersection Observerの設定
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = entry.target;
                const finalValue = parseInt(target.getAttribute('data-value'));
                
                // カウントアップアニメーション
                let currentValue = 0;
                const duration = 2000; // 2秒間
                const increment = finalValue / (duration / 16);
                
                const timer = setInterval(() => {
                    currentValue += increment;
                    
                    if (currentValue >= finalValue) {
                        clearInterval(timer);
                        currentValue = finalValue;
                    }
                    
                    target.textContent = Math.floor(currentValue).toLocaleString();
                }, 16);
                
                // 一度アニメーションしたら監視を解除
                observer.unobserve(target);
            }
        });
    }, { threshold: 0.5 });
    
    // 数字要素を監視
    resultNumbers.forEach(number => {
        observer.observe(number);
    });
});
