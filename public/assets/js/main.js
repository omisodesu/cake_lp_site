// いつでもケーキ LP JavaScript

document.addEventListener('DOMContentLoaded', function () {
    // --- FAQアコーディオン機能 ---
    const faqQuestions = document.querySelectorAll('.faq__question');
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            question.classList.toggle('active');
            const answer = question.nextElementSibling;
            if (answer) {
                answer.classList.toggle('active');
                const isExpanded = question.classList.contains('active');
                question.setAttribute('aria-expanded', isExpanded);
                answer.setAttribute('aria-hidden', !isExpanded);
            }
        });

        // 初期状態
        const answer = question.nextElementSibling;
        if (answer && !question.classList.contains('active')) {
            answer.classList.remove('active');
            answer.setAttribute('aria-hidden', 'true');
        }
        question.setAttribute('aria-expanded', 'false');
        question.setAttribute('role', 'button');
        if (answer) answer.setAttribute('role', 'region');
    });

    // --- スムーススクロール ---
    const scrollLinks = document.querySelectorAll('a[href^="#"]');
    scrollLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const headerOffset = 100;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
            }
        });
    });

    // --- お問い合わせフォーム関連 ---
    const contactForm = document.getElementById('contact-form');
    const inquiryTypeSelect = document.getElementById('inquiry-type');
    const otherDetailsGroup = document.getElementById('other-inquiry-details-group');
    const otherDetailsTextarea = document.getElementById('other-inquiry-details');
    const charCountElement = document.getElementById('char-count');
    const formResponseMessage = document.getElementById('form-response-message');

    // "Other" テキストエリアの表示・文字数カウント
    if (inquiryTypeSelect && otherDetailsGroup && otherDetailsTextarea && charCountElement) {
        const maxLength = otherDetailsTextarea.maxLength;
        charCountElement.textContent = `${otherDetailsTextarea.value.length} / ${maxLength}`;

        inquiryTypeSelect.addEventListener('change', () => {
            if (inquiryTypeSelect.value === 'other') {
                otherDetailsGroup.classList.remove('hidden');
                otherDetailsTextarea.required = true;
            } else {
                otherDetailsGroup.classList.add('hidden');
                otherDetailsTextarea.required = false;
                otherDetailsTextarea.value = '';
                charCountElement.textContent = `0 / ${maxLength}`;
            }
        });

        otherDetailsTextarea.addEventListener('input', () => {
            charCountElement.textContent = `${otherDetailsTextarea.value.length} / ${maxLength}`;
        });
    }

    // --- フォーム送信処理 (async/await + 早期リターンパターン) ---
    if (contactForm) {
        contactForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const submitButton = this.querySelector('button[type="submit"]');
            // 1) reCAPTCHA チェック
            const recaptchaResponse = (typeof grecaptcha !== 'undefined') ? grecaptcha.getResponse() : '';
            if (!recaptchaResponse) {
                if (formResponseMessage) {
                    formResponseMessage.textContent = 'エラー: reCAPTCHAをチェックしてください。';
                    formResponseMessage.style.color = 'red';
                } else {
                    alert('reCAPTCHAをチェックしてください。');
                }
                return; // ここで必ず処理を終了
            }

            // 2) 送信準備
            submitButton.disabled = true;
            submitButton.textContent = '送信中...';
            if (formResponseMessage) formResponseMessage.textContent = '';

            try {
                // フォームデータをURLSearchParamsに変換
                const formData = new FormData(contactForm);
                const params = new URLSearchParams();
                for (const [key, value] of formData.entries()) {
                    if (key !== 'website_url') {
                        params.append(key, value);
                    }
                }
                // person-in-charge（担当者名）が未送信の場合は追加
                if (!params.has('person-in-charge')) {
                    const personInCharge = document.getElementById('person-in-charge')?.value || '';
                    params.append('person-in-charge', personInCharge);
                }
                params.append('g-recaptcha-response', recaptchaResponse);

                const functionUrl = 'https://us-central1-fir-app-df757.cloudfunctions.net/sendMail';
                const response = await fetch(functionUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString(),
                });

                const responseBodyText = await response.text();

                if (!response.ok) {
                    let errorMsg = `HTTP error! status: ${response.status}`;
                    try {
                        const errData = JSON.parse(responseBodyText);
                        errorMsg = errData.error || errorMsg;
                    } catch { }
                    throw new Error(errorMsg);
                }

                const data = JSON.parse(responseBodyText);

                if (data.success) {
                    // GA4 イベント送信
                    if (typeof gtag === 'function') {
                        const inquiryTypeValue = inquiryTypeSelect?.value || 'unknown';
                        gtag('event', 'contact_form_submit', {
                            event_category: 'contact',
                            event_label: inquiryTypeValue,
                        });
                    }
                    // 成功メッセージ表示
                    if (formResponseMessage) {
                        formResponseMessage.textContent = 'お問い合わせありがとうございます。送信完了しました。';
                        formResponseMessage.style.color = 'green';
                    } else {
                        alert('お問い合わせありがとうございます。送信完了しました。');
                    }
                    contactForm.reset();
                    // "Other" 部分のリセット
                    if (otherDetailsGroup && otherDetailsTextarea && charCountElement) {
                        otherDetailsGroup.classList.add('hidden');
                        otherDetailsTextarea.required = false;
                        otherDetailsTextarea.value = '';
                        charCountElement.textContent = `0 / ${otherDetailsTextarea.maxLength}`;
                    }
                } else {
                    throw new Error(data.error || '送信に失敗しました。');
                }

            } catch (error) {
                console.error('Form submission error:', error);
                if (formResponseMessage) {
                    formResponseMessage.textContent = '送信中にエラーが発生しました。' + (error.message || '');
                    formResponseMessage.style.color = 'red';
                } else {
                    alert('送信中にエラーが発生しました。');
                }
            } finally {
                // reCAPTCHAリセット & ボタン復帰
                if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
                submitButton.disabled = false;
                submitButton.textContent = '送信する';
            }
        });
    }

    // --- 数字カウントアップアニメーション ---
    const resultNumbers = document.querySelectorAll('.result-card__number');
    if (resultNumbers.length > 0 && 'IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const target = entry.target;
                    const finalValue = parseInt(target.getAttribute('data-value'), 10);
                    if (isNaN(finalValue) || target.classList.contains('counted')) return;
                    target.classList.add('counted');

                    let currentValue = 0;
                    const duration = 2000;
                    const frameDuration = 16;
                    const totalFrames = Math.round(duration / frameDuration);
                    const increment = finalValue / totalFrames;
                    let currentFrame = 0;

                    const timer = setInterval(() => {
                        currentFrame++;
                        currentValue += increment;
                        if (currentFrame >= totalFrames) {
                            clearInterval(timer);
                            currentValue = finalValue;
                        }
                        target.textContent = Math.floor(currentValue).toLocaleString();
                    }, frameDuration);

                    obs.unobserve(target);
                }
            });
        }, { threshold: 0.5 });

        resultNumbers.forEach(number => observer.observe(number));
    } else if (resultNumbers.length > 0) {
        // IntersectionObserver非対応ブラウザ向けフォールバック
        resultNumbers.forEach(number => {
            const finalValue = parseInt(number.getAttribute('data-value'), 10);
            if (!isNaN(finalValue)) {
                number.textContent = finalValue.toLocaleString();
            }
        });
    }

}); // End DOMContentLoaded