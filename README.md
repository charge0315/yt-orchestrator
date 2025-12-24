# 🎵 YouTube Orchestrator

YouTubeとYouTube Musicの体験を向上させるための包括的な管理ツールです。YouTube Data API v3と直接統合し、チャンネル、プレイリスト、最新動画などを一元的に表示・管理します。

## ✨ 主な機能

- **統合ダッシュボード (ホームページ)**
  - 登録チャンネルの最新動画を「最新情報」として表示
  - 「登録チャンネル」「アーティスト」「再生リスト」「YouTube Music プレイリスト」をセクションごとに一覧表示
  - 各セクションでのソート機能（登録順/名前順など）

- **カルーセル表示**
  - サムネイルを横スクロールで閲覧できます。

- **キャッシュシステム**
  - 取得したデータはMongoDBにキャッシュされ、2回目以降の表示を高速化します。
  - バックグラウンドで定期的に差分を更新し、APIクォータ消費を最小限に抑えます。
  - 起動時に全データを強制的に同期するオプションがあります。

- **データ判定**
  - チャンネルやプレイリストが音楽関連かどうかを、含まれる動画のカテゴリに基づいて自動で判定します。

- **認証**
  - Google OAuth 2.0による安全な認証。
  - アクセストークンは自動的に管理され、必要に応じて再発行されます。

## 🛠️ 技術スタック

- **バックエンド**: Node.js, Express, TypeScript
- **フロントエンド**: React, TypeScript, Vite
- **データベース**: MongoDB (Mongoose経由)
- **API**: YouTube Data API v3
- **その他**: `node-cron` (バックグラウンドジョブ), `axios`

## プロジェクト構造

```
yt-orchestrator/
├── packages/
│   ├── frontend/          # Reactフロントエンド
│   └── backend/           # Express.jsバックエンド
│       ├── src/
│       │   ├── routes/      # APIルート
│       │   ├── models/      # Mongooseモデル (User, CachedChannel, CachedPlaylist)
│       │   ├── jobs/        # キャッシュ更新ジョブ
│       │   └── index.ts     # エントリーポイント
│       └── .env.example     # 環境変数テンプレート
└── package.json           # ルートパッケージ
```

## 💿 セットアップ

### 1. 必要要件

- Node.js 18.0.0以上
- npm
- MongoDBサーバー

### 2. インストール

```bash
# リポジトリをクローン
git clone <repository-url>
cd yt-orchestrator

# 依存関係をインストール
npm install
```

## 🔐 秘匿情報の取り扱い

- OAuth のクライアントシークレットなどの秘匿情報は、リポジトリにコミットしないでください。
- 本リポジトリでは誤コミット防止のため、`client_secret*.json` を `.gitignore` で除外しています。
- 認証情報は基本的に `packages/backend/.env` の `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` で設定します。

### 3. 環境変数の設定

バックエンドとフロントエンドのそれぞれの `.env.example` ファイルをコピーして `.env` ファイルを作成します。

**`packages/backend/.env` の設定:**

```
# Google OAuth 2.0 の認証情報
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# OAuth Redirect URI（重要）
# Google Cloud Console の OAuth クライアントに「承認済みのリダイレクト URI」として登録する値と完全一致させてください。
# 例: http://localhost:3000/api/auth/google/callback
BACKEND_URL=http://localhost:3000
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# MongoDB接続URI
MONGODB_URI=mongodb://localhost:27017/yt-orchestrator

# セッション管理用の秘密鍵
SESSION_SECRET=your_random_secret_key_here

# フロントエンドのURL
FRONTEND_URL=http://localhost:5173

# キャッシュ更新ジョブの設定
# trueに設定すると、定期的にキャッシュが更新されます（YouTube API クォータを消費します）
ENABLE_CACHE_UPDATE_JOB=true
# 起動時の自動更新はクォータを消費しやすいので opt-in
RUN_CACHE_UPDATE_ON_STARTUP=false
# 起動時に実行する場合、強制モード（より重い）にするか
FORCE_CACHE_UPDATE_ON_STARTUP=false
CACHE_UPDATE_SCHEDULE=0 */30 * * * *
```

**`packages/frontend/.env` の設定:**

```
VITE_API_URL=http://localhost:3000/api
```

**重要:** 初回起動時やデータを完全に再同期したい場合は、必ず `ENABLE_CACHE_UPDATE_JOB=true` に設定してください。

### 4. `400: redirect_uri_mismatch` が出る場合

- Google Cloud Console → 対象の OAuth 2.0 クライアント → 「承認済みのリダイレクト URI」に `GOOGLE_REDIRECT_URI` を登録してください。
- ローカル開発の例: `http://localhost:3000/api/auth/google/callback`
- `FRONTEND_URL` は Vite の起動ログに表示される実際のURL（例: `http://localhost:5175`）と合わせてください。

### 5. 開発サーバーの起動

プロジェクトのルートディレクトリで以下のコマンドを実行します。

```bash
npm run dev
```

- フロントエンド: `http://localhost:5173`
- バックエンドAPI: `http://localhost:3000`

## 🧱 ビルド

ルートで以下を実行すると、フロントエンド（`tsc && vite build`）とバックエンド（`tsc`）をまとめてビルドします。

```bash
npm run build
```

## 🧰 便利スクリプト（任意）

MongoDB の状態確認や seed を手動実行したい場合は、`packages/backend/src/scripts/` 配下のスクリプトを利用できます。

- `seed.ts`: 初期データ投入
- `checkAllData.ts`: MongoDB のコレクション/データ概況を表示
- `checkCache.ts`: キャッシュチャンネルのサンプル/統計を表示
- `checkPlaylists.ts`: キャッシュプレイリストのサンプル/統計を表示

## 📖 APIエンドポイント

- `/api/auth/google`: Google OAuth認証を開始します。
- `/api/auth/me`: 現在のログインユーザー情報を取得します。
- `/api/artists`: アーティストチャンネルの一覧を取得します。
- `/api/artists/new-releases`: 全チャンネルの最新動画を取得します。
- `/api/channels`: 登録チャンネル（アーティスト以外）の一覧を取得します。
- `/api/playlists`: 動画プレイリスト（音楽以外）の一覧を取得します。
- `/api/ytmusic/playlists`: 音楽プレイリストの一覧を取得します。
- `/api/recommendations`: AIによるおすすめを取得します。