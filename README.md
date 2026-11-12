# わんログ

愛犬の記録アプリ（モバイルファースト Web アプリ）。散歩・ごはん・体重・トイレ・健康・日記・写真を記録し、ちっちゃい愛犬エージェントが話し相手になって記録も代行します。

## 機能

- 記録：散歩（分）/ ごはん（g・朝昼夜おやつ）/ 体重（kg）/ トイレ / 健康（通院・投薬など）/ 日記、すべて写真付き可
- ホーム：今日の散歩・ごはん・トイレ・体重、日別タイムライン（スワイプ削除）
- グラフ：体重推移、7日間の散歩
- アルバム：写真だけをグリッド表示、拡大表示
- 複数頭の登録と切り替え
- AI（Workers AI）
  - **ちっちゃい愛犬エージェント**：画面に常駐する愛犬キャラ。話しかけると記録を見て答え、「散歩30分行ったよ」と報告すれば記録してくれる
  - **AI クイック入力**：「朝ごはん 80g」など自然文や音声から記録フォームを自動入力
  - **写真キャプション**：写真から日記文を生成
  - **AI まとめ**：直近14日の記録から気づきを3行で
- Google ログインのみ
- 全画面スケルトンローディング、リキッドグラス UI（茶色ベース、ライト/ダーク対応）

## 技術選定と理由

| 領域 | 採用 | 理由 |
| --- | --- | --- |
| 実行基盤 | **Cloudflare Workers**（Static Assets） | フロントと API を 1 つの Worker で配信でき、デプロイが `wrangler deploy` 一発。エッジ実行で日本からも低遅延、無料枠が大きい |
| API | **Hono** | Workers 向けに設計された軽量ルーター。型が効き、Cookie・エラーハンドリングなど必要なものが揃っていて依存が小さい |
| DB | **Cloudflare D1**（SQLite） | Workers からバインディングで直接使え、接続管理不要。記録データはリレーショナルなので SQL が素直。マイグレーションも wrangler で管理できる |
| 写真 | **Cloudflare KV** | R2 はダッシュボードでの有効化（支払い情報登録）が必要なため、追加設定なしで使える KV を採用。値は最大 25MB、無料枠 1GB で、クライアント側で WebP に縮小した写真なら数千枚入る。D1 に画像を入れるとサイズ制限に当たるため分離。キーをユーザー ID で名前空間化し、配信時に所有者チェック。容量が足りなくなったら R2 へ移行する |
| AI | **Workers AI** | 指定どおり。追加の API キー不要でバインディングから呼べる。会話・JSON 抽出は `llama-3.3-70b-instruct-fp8-fast`（日本語が比較的強く JSON Schema 出力に対応）、写真は画像入力対応の `llama-4-scout-17b-16e-instruct` |
| 認証 | **Google OAuth 2.0（Authorization Code + PKCE）を自前実装** | 要件が Google のみなので、認証ライブラリを入れるより fetch 数回で済む自前実装の方が依存も攻撃面も小さい。セッションは D1 に SHA-256 ハッシュで保存し、HttpOnly / Secure / SameSite=Lax Cookie。書き込み API は Origin を検証して CSRF 対策 |
| フロント | **React 19 + Vite + TypeScript** | エコシステムが最大で、アニメーションライブラリや Cloudflare 公式 Vite プラグインがそのまま使える。Vite で開発時も workerd 上で Worker を動かせる |
| アニメーション | **Motion**（旧 Framer Motion） | レイアウトアニメーション（`layoutId`）、ドラッグ、スプリング、`AnimatePresence` による出入りが宣言的に書ける。`reducedMotion="user"` で OS の視差効果を減らす設定に追従 |
| スタイル | **Tailwind CSS v4** + 自前 CSS | レイアウトは Tailwind で素早く、リキッドグラス（backdrop-filter・スペキュラハイライト・SVG 変位フィルタによる屈折）は自前 CSS で細かく制御 |
| データ取得 | **TanStack Query** | ローディング状態 → スケルトン表示、キャッシュ、楽観的削除、更新後の再取得を一貫して扱える |
| ルーティング | **React Router** | 定番で、ページ遷移アニメーションと組み合わせやすい |
| E2E テスト | **Playwright** | 実ブラウザ（Chromium・Pixel 7 エミュレーション）で全機能を操作して検証できる |

## 開発

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
LOCAL_ONLY=1 npm run dev   # AI をモックにしてオフライン起動（ログイン不要）
npm run dev                # Workers AI を実際に呼ぶ（wrangler login が必要）
```

ローカルでは `http://localhost:5173/auth/dev-login` でテストユーザーとしてログインできます（`DEV_LOGIN=1` かつ localhost のときだけ有効。本番では無効）。

### テスト

```bash
npx playwright install chromium
npm run test:e2e
```

## デプロイ

```bash
npx wrangler login
npx wrangler d1 create wanlog            # 出力された database_id を wrangler.jsonc に設定
npx wrangler kv namespace create wanlog-photos   # 出力された id を wrangler.jsonc に設定
npm run db:migrate:remote
npx wrangler secret put GOOGLE_CLIENT_SECRET
npm run deploy
```

Google Cloud Console で OAuth クライアント（ウェブアプリケーション）を作成し、
承認済みリダイレクト URI に `https://<デプロイ先>/auth/google/callback` を登録、
クライアント ID を `wrangler.jsonc` の `vars.GOOGLE_CLIENT_ID` に設定してください。
