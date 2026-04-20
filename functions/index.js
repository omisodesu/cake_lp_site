/**
 * Firebase Cloud Functions v2
 * メール送信機能 (HTTPSトリガー) - ステップ2 バリデーション強化 & Lint修正
 */

// Firebase Functions v2 と パラメータ定義機能をインポート
const {onRequest} = require("firebase-functions/v2/https");
const {defineString, defineSecret} = require("firebase-functions/params");

// 必要なライブラリをインポート
const nodemailer = require("nodemailer");
const cors = require("cors")({origin: true}); // CORSミドルウェアを初期化
const validator = require("validator"); // validator ライブラリをインポート
const axios = require("axios");

// --- パラメータ定義 ---
// 環境変数 GMAIL_USER を参照 (functions/.env ファイルに記述)
const gmailUserParam = defineString("GMAIL_USER", {
  description: "Gmail account used for sending emails",
});
// Secret Manager の GMAIL_APP_PASSWORD を参照
const gmailPasswordParam = defineSecret("GMAIL_APP_PASSWORD");
// ★ Secret Manager の TURNSTILE_SECRET_KEY を参照
const turnstileSecretKeyParam = defineSecret("TURNSTILE_SECRET_KEY");

// --- 定数定義 ---
const ALLOWED_INQUIRY_TYPES = [ // 許可するお問い合わせ種別の値
  "request_documents",
  "request_case_study",
  "request_contact",
  "other",
];
const ALLOWED_LEAD_SOURCES = [ // 許可する流入元の値
  "google_search",
  "sns",
  "dm",
  "blog",
  "note",
  "referral",
  "trade_show",
  "other",
];
const INQUIRY_TYPE_LABELS = { // メール本文用の日本語ラベル
  "request_documents": "資料請求（サービス概要）",
  "request_case_study": "成功事例集請求（クリスマス事例）",
  "request_contact": "商品の説明が聞きたいので連絡が欲しい",
  "other": "その他",
};
const LEAD_SOURCE_LABELS = { // メール本文用の日本語ラベル
  "google_search": "Google検索",
  "sns": "SNS",
  "dm": "DM",
  "blog": "ブログ",
  "note": "note",
  "referral": "知人の紹介",
  "trade_show": "展示会",
  "other": "その他",
};
const OTHER_DETAILS_MAX_LENGTH = 200; // 「その他」詳細の最大文字数 (適宜調整)
const ALLOWED_HOSTNAMES = ["cake.lp.gadandan.co.jp"];

/**
 * 自動返信メールの本文を組み立てる
 * @param {object} params - メールパラメータ
 * @return {string} メール本文
 */
function buildAutoReplyBody({
  name, email, phone, inquiryType, otherDetails,
}) {
  const inquiryLabel =
      INQUIRY_TYPE_LABELS[inquiryType] || inquiryType;

  let body = `${name} 様\n\n` +
    "この度は「いつでもケーキ」に" +
    "お問い合わせいただき、\n" +
    "誠にありがとうございます。\n\n" +
    "以下の内容でお問い合わせを" +
    "受け付けいたしました。\n\n" +
    "─────────────────────────────────\n" +
    "■ お問い合わせ内容\n" +
    "─────────────────────────────────\n" +
    `お名前: ${name}\n` +
    `メールアドレス: ${email}\n` +
    `電話番号: ${phone || "未入力"}\n` +
    `お問い合わせ種別: ${inquiryLabel}\n`;

  if (inquiryType === "other" && otherDetails) {
    body += `内容（その他）:\n${otherDetails}\n`;
  }

  body += "─────────────────────────────────\n\n";

  if (inquiryType === "request_case_study") {
    body +=
      "成功事例集（A4・全6ページPDF）を、\n" +
      "担当者よりメールでお送りいたします。\n" +
      "通常1営業日以内にご返信いたしますので、\n" +
      "しばらくお待ちくださいませ。\n\n";
  } else if (inquiryType === "request_documents") {
    body +=
      "サービス資料を、担当者より\n" +
      "メールでお送りいたします。\n" +
      "通常1営業日以内にご返信いたしますので、\n" +
      "しばらくお待ちくださいませ。\n\n";
  } else {
    body +=
      "内容を確認のうえ、担当者より\n" +
      "折り返しご連絡いたします。\n" +
      "通常2営業日以内にご返信いたしますので、\n" +
      "しばらくお待ちくださいませ。\n\n";
  }

  body +=
    "※本メールは自動送信されています。\n" +
    "　このメールに直接ご返信いただいても\n" +
    "　お答えできない場合がございます。\n\n" +
    "──────────────────────────────\n" +
    "いつでもケーキ\n" +
    "がだんだん株式会社\n" +
    "メール: info@gadandan.co.jp\n" +
    "サイト: https://cake.lp.gadandan.co.jp\n" +
    "──────────────────────────────\n";

  return body;
}

// --- HTTPS 関数のエクスポート ---
exports.sendMail = onRequest(
    // 実行時オプション: 使用するシークレットを宣言
    {secrets: ["GMAIL_APP_PASSWORD", "TURNSTILE_SECRET_KEY"]},

    // リクエストハンドラ (非同期処理のため async)
    async (req, res) => {
      // --- ② HTTPメソッドの確認 ---
      if (req.method !== "POST") {
        console.warn(`WARN: Method Not Allowed: ${req.method}`);
        res.status(405).send("Method Not Allowed");
        return;
      }
      // CORSミドルウェアを適用
      cors(req, res, async () => {
        // CORSコールバックも非同期に

        const honeypotValue = req.body.website_url;
        if (honeypotValue) {
          console.log(
              "INFO: Honeypot field filled. Likely a bot. " +
            "Silently ignoring.",
          );
          return res.json({success: true, messageId: "honeypot-triggered"});
        }

        // --- Turnstile サーバー側検証 ---
        try {
          const turnstileToken =
              req.body && req.body["cf-turnstile-response"];

          const secretKey = turnstileSecretKeyParam.value();

          if (!turnstileToken) {
            console.warn("WARN: Missing Turnstile token.");
            return res.status(400).json({
              success: false,
              error: "Turnstile トークンが必要です。",
            });
          }
          if (!secretKey) {
            console.error(
                "ERROR: Missing Turnstile secret key configuration.",
            );
            return res.status(500).json({
              success: false,
              error: "サーバー設定エラー (Turnstile secret)",
            });
          }

          const verificationUrl =
              "https://challenges.cloudflare.com/turnstile/v0/siteverify";
          console.log("INFO: Verifying Turnstile token...");

          const verificationRes = await axios.post(
              verificationUrl,
              "secret=" + encodeURIComponent(secretKey) +
              "&response=" + encodeURIComponent(turnstileToken),
              {
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                timeout: 5000,
              },
          );
          if (!verificationRes.data.success) {
            console.warn(
                "WARN: Turnstile verification failed:",
                verificationRes.data["error-codes"],
            );
            return res.status(400).json({
              success: false,
              error: "セキュリティ検証に失敗しました。" +
                     "再度お試しください。",
            });
          }

          const responseHostname = verificationRes.data.hostname;
          if (!ALLOWED_HOSTNAMES.includes(responseHostname)) {
            console.warn(
                "WARN: Turnstile hostname mismatch:",
                responseHostname,
            );
            return res.status(400).json({
              success: false,
              error: "セキュリティ検証に失敗しました。" +
                     "再度お試しください。",
            });
          }
        } catch (turnstileError) {
          console.error(
              "ERROR during Turnstile verification:",
              turnstileError,
          );
          return res.status(500).json({
            success: false,
            error: "セキュリティ検証サーバーとの通信中に" +
                   "エラーが発生しました。",
          });
        }
        // --- Turnstile 検証 OK ---

        let transporter;

        // --- ① トランスポーターの初期化 ---
        try {
          const user = gmailUserParam.value();
          const password = gmailPasswordParam.value();
          if (!user || !password) {
            console.error("ERROR: Missing SMTP credentials.");
            return res.status(500).json({
              success: false,
              error: "Server configuration error (credentials missing).",
            });
          }
          transporter = nodemailer.createTransport({
            service: "Gmail",
            auth: {user: user, pass: password},
          });
          console.log("Nodemailer transporter created successfully.");
        } catch (error) {
          console.error("ERROR initializing transporter:", error);
          return res.status(500).json({
            success: false,
            error: "Server configuration error (init).",
          });
        }


        // --- ★★★ ステップ2: 入力値の取得とバリデーション (Lint修正含む) ★★★ ---
        try {
          console.log("INFO: Validating request body...");
          // リクエストボディからデータを取得
          const shopName = req.body["shop-name"] || "";
          const personInCharge = req.body["person-in-charge"] || "";
          const name = req.body.name || "";
          const email = req.body.email || "";
          const phone = req.body.phone || "";
          const inquiryType = req.body.inquiry_type || "";
          const otherDetails = req.body.other_inquiry_details || "";
          const leadSource = req.body.lead_source || "";
          const leadSourceOtherDetails =
              req.body.lead_source_other_details || "";

          // --- バリデーション実行 ---

          // 必須項目チェック (Line 84 max-len fix)
          if (!name || !email || !inquiryType) {
            console.warn("Validation failed: Missing required fields.");
            return res.status(400).json({
              success: false,
              error: "必須項目（お名前、メールアドレス、お問い合わせ種別）" +
                     "が入力されていません。",
            });
          }

          // お問い合わせ種別の値チェック (Line 89 max-len fix)
          if (!ALLOWED_INQUIRY_TYPES.includes(inquiryType)) {
            console.warn(
                "Validation failed: Invalid inquiry type:",
                inquiryType,
            );
            return res.status(400).json({
              success: false,
              error: "お問い合わせ種別が無効です。",
            });
          }

          // 「その他」の場合の追加チェック
          if (inquiryType === "other") {
            // (Line 90 max-len fix)
            if (!otherDetails) {
              console.warn(
                  "Validation failed: Missing other details " +
                  "when type is 'other'.",
              );
              // (Line 96 max-len fix)
              return res.status(400).json({
                success: false,
                error: "お問い合わせ種別で「その他」を選択した場合は、" +
                       "内容を入力してください。",
              });
            }
            // (Line 97 max-len fix)
            if (otherDetails.length > OTHER_DETAILS_MAX_LENGTH) {
              console.warn("Validation failed: Other details too long.");
              // (Line 101 max-len fix)
              const errorMsg = `お問い合わせ内容（その他）は` +
                             `${OTHER_DETAILS_MAX_LENGTH}文字以内で` +
                             `入力してください。`;
              return res.status(400).json({success: false, error: errorMsg});
            }
          }

          // 流入元の値チェック（任意項目だが、値がある場合は許可リストで検証）
          if (leadSource &&
              !ALLOWED_LEAD_SOURCES.includes(leadSource)) {
            console.warn(
                "Validation failed: Invalid lead source:",
                leadSource,
            );
            return res.status(400).json({
              success: false,
              error: "流入元の値が無効です。",
            });
          }

          // 流入元「その他」の場合の補足欄チェック
          if (leadSource === "other" &&
              leadSourceOtherDetails.length >
              OTHER_DETAILS_MAX_LENGTH) {
            console.warn(
                "Validation failed: Lead source other details too long.",
            );
            return res.status(400).json({
              success: false,
              error: `流入元（その他）は` +
                     `${OTHER_DETAILS_MAX_LENGTH}文字以内で` +
                     `入力してください。`,
            });
          }

          // メールアドレス形式チェック (Line 108 max-len fix)
          if (!validator.isEmail(email)) {
            console.warn("Validation failed: Invalid email format:", email);
            return res.status(400).json({
              success: false,
              error: "メールアドレスの形式が正しくありません。",
            });
          }

          // 名前の長さチェック (例) (Line 114 max-len fix)
          if (name.length > 100) {
            console.warn("Validation failed: Name too long.");
            return res.status(400).json({
              success: false,
              error: "お名前が長すぎます（100文字以内）。",
            });
          }

          // 電話番号の簡易チェック (Line 118 no-useless-escape fix)
          // (Line 121 max-len fix - Warning Log)
          // ハイフンは character class [] 内では通常エスケープ不要
          if (phone && !validator.matches(phone, /^[0-9-]{10,20}$/)) {
            console.warn(
                "Validation failed: Invalid phone format:",
                phone,
            );
            // エラーにはせず、ログだけ残すか、エラーにするか選択
            // return res.status(400).json({ success: false, error: +
            // "電話番号の形式が正しくありません。" });
          }

          console.log("INFO: Validation successful.");

          // --- メールの送信処理 ---

          // メール本文を構築
          let mailBody = "店舗名: " + shopName + "\n" +
                         (personInCharge ? `担当者名: ${personInCharge}\n` : "") +
                         "お名前: " + name + "\n" +
                         "メールアドレス: " + email + "\n" +
                         "電話番号: " + phone + "\n" +
                         "お問い合わせ種別: " +
                         (INQUIRY_TYPE_LABELS[inquiryType] ||
                          inquiryType);

          if (inquiryType === "other") {
            mailBody += "\n内容（その他）:\n" + otherDetails;
          }

          if (leadSource) {
            mailBody += "\n流入元: " +
                        (LEAD_SOURCE_LABELS[leadSource] ||
                         leadSource);
            if (leadSource === "other" && leadSourceOtherDetails) {
              mailBody += "\n流入元（その他）:\n" +
                          leadSourceOtherDetails;
            }
          }

          // メールオプションを設定
          const mailOptions = {
            from: `"${name}" <info@gadandan.co.jp>`,
            replyTo: email,
            to: "info@gadandan.co.jp",
            subject: `【いつでもケーキお問い合わせ】 ${name} 様から`,
            text: mailBody,
          };

          console.log("INFO: Calling transporter.sendMail...");
          const info = await transporter.sendMail(mailOptions);

          console.log(
              "OK: Admin notification sent:",
              info.response,
          );

          // --- 自動返信メール送信 ---
          try {
            const autoReplyBody = buildAutoReplyBody({
              name, email, phone, inquiryType, otherDetails,
            });

            const autoReplyOptions = {
              from: `"いつでもケーキ" <info@gadandan.co.jp>`,
              replyTo: "info@gadandan.co.jp",
              to: email,
              subject: "【いつでもケーキ】" +
                       "お問い合わせありがとうございます",
              text: autoReplyBody,
            };

            console.log(
                "INFO: Sending auto-reply to:",
                email,
            );
            const autoReplyInfo =
                await transporter.sendMail(autoReplyOptions);
            console.log(
                "OK: Auto-reply sent:",
                autoReplyInfo.response,
            );
          } catch (autoReplyError) {
            console.error(
                "ERROR: Failed to send auto-reply:",
                autoReplyError,
            );
          }

          res.json({success: true, messageId: info.messageId});
        } catch (error) {
          // バリデーションやメール送信中の予期せぬエラー
          console.error("ERROR processing request or sending email:", error);
          res.status(500).json({
            success: false,
            error: "An internal error occurred: " + error.toString(),
          });
        }
      }); // End cors() wrapper
    }, // End async request handler
); // End onRequest
