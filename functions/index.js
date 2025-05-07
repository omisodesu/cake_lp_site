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
/** const axios = require("axios"); // ★ axios をインポート*/

// --- パラメータ定義 ---
// 環境変数 GMAIL_USER を参照 (functions/.env ファイルに記述)
const gmailUserParam = defineString("GMAIL_USER", {
  description: "Gmail account used for sending emails",
});
// Secret Manager の GMAIL_APP_PASSWORD を参照 (Secret Managerに作成し、権限付与が必要)
const gmailPasswordParam = defineSecret("GMAIL_APP_PASSWORD");
// ★ Secret Manager の RECAPTCHA_SECRET_KEY を参照
/** const recaptchaSecretKeyParam = defineSecret("RECAPTCHA_SECRET_KEY");*/

// --- 定数定義 ---
const ALLOWED_INQUIRY_TYPES = [ // 許可するお問い合わせ種別の値
  "request_documents",
  "request_contact",
  "other",
];
const OTHER_DETAILS_MAX_LENGTH = 200; // 「その他」詳細の最大文字数 (適宜調整)

// --- HTTPS 関数のエクスポート ---
exports.sendMail = onRequest(
    // 実行時オプション: 使用するシークレットを宣言
    {secrets: ["GMAIL_APP_PASSWORD", "RECAPTCHA_SECRET_KEY"]},

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

        /**
        try {
          const recaptchaToken = req.body["g-recaptcha-response"];
          console.log("▶︎ BODY PAYLOAD:", req.body);
          console.log("▶︎ TOKEN FIELD:", req.body["g-recaptcha-response"]);

          // フロントエンドから送られたトークン
          const secretKey = recaptchaSecretKeyParam.value();
          // Secret Managerからキーを取得

          if (!recaptchaToken) {
            console.warn("WARN: Missing reCAPTCHA token.");
            return res.status(400).json({
              success: false, error: "reCAPTCHA トークンが必要です。",
            });
          }
          if (!secretKey) {
            console.error("ERROR: Missing reCAPTCHA secret key configuration.");
            return res.status(500).json({
              success: false, error: "サーバー設定エラー (reCAPTCHA secret)",
            });
          }

          const verificationUrl = "https://www.google.com/recaptcha/api/siteverify";
          console.log("INFO: Verifying reCAPTCHA token...");

          // GoogleのAPIに検証リクエストを送信
          const verificationRes = await axios.post(
              verificationUrl,
              // application/x-www-form-urlencoded 形式で送信
              "secret=" + encodeURIComponent(secretKey) +
            "&response=" + encodeURIComponent(recaptchaToken),
              {
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                timeout: 5000, // タイムアウトを5秒に設定 (任意)
              },
          );

          // 検証結果を確認
          if (!verificationRes.data.success) {
            console.warn(
                "WARN: reCAPTCHA verification failed:",
                verificationRes.data["error-codes"],
            );
            return res.status(400).json({
              success: false, error: "reCAPTCHA の認証に失敗しました。",
            });
          }
          console.log("INFO: reCAPTCHA verification successful.");
        } catch (recaptchaError) {
          console.error(
              "ERROR during reCAPTCHA verification request:", recaptchaError,
          );
          // axios のタイムアウトなどもここで捕捉される
          return res.status(500).json({
            success: false, error: "reCAPTCHA サーバーとの通信中にエラーが発生しました。",
          });
        }
        // --- reCAPTCHA 検証 OK ---
*/
        let transporter;

        // --- ① トランスポーターの初期化 ---
        try {
          const user = gmailUserParam.value();
          const password = gmailPasswordParam.value();
          if (!user || !password) {
            // エラーログは簡潔に
            console.error("ERROR: Missing Gmail credentials.");
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
          const name = req.body.name || "";
          const email = req.body.email || "";
          const phone = req.body.phone || "";
          const inquiryType = req.body.inquiry_type || "";
          const otherDetails = req.body.other_inquiry_details || "";

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
                         "お名前: " + name + "\n" +
                         "メールアドレス: " + email + "\n" +
                         "電話番号: " + phone + "\n" +
                         "お問い合わせ種別: " + inquiryType;

          if (inquiryType === "other") {
            mailBody += "\n内容（その他）:\n" + otherDetails;
          }

          // メールオプションを設定
          const mailOptions = {
            from: `"${name}" <${gmailUserParam.value()}>`,
            replyTo: email,
            to: "info@gadandan.co.jp",
            subject: `【いつでもケーキお問い合わせ】 ${name} 様から`,
            text: mailBody,
          };

          console.log("INFO: Calling transporter.sendMail...");
          const info = await transporter.sendMail(mailOptions);

          console.log("OK: Email sent successfully:", info.response);
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
