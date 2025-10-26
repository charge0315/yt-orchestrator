# 🎵 YouTube Orchestrator

YouTubeとYouTube Musicの体験を向上させるための包括的な管理ツールです。YouTube Data API v3と直接統合し、チャンネル、プレイリスト、最新動画などを一元的に表示・管理します。

## ✨ 主な機能

- **統合ダッシュボード (ホームページ)**
  - 登録チャンネルの最新動画を「最新情報」として表示
  - 「登録チャンネル」「アーティスト」「再生リスト」「YouTube Music プレイリスト」をセクションごとに一覧表示
  - 各セクションでのソート機能（登録順/名前順など）

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

### 3. 環境変数の設定

バックエンドとフロントエンドのそれぞれの `.env.example` ファイルをコピーして `.env` ファイルを作成します。

**`packages/backend/.env` の設定:**

```
# Google OAuth 2.0 の認証情報
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# MongoDB接続URI
MONGODB_URI=mongodb://localhost:27017/yt-orchestrator

# セッション管理用の秘密鍵
SESSION_SECRET=your_random_secret_key_here

# フロントエンドのURL
FRONTEND_URL=http://localhost:5173

# キャッシュ更新ジョブの設定
# trueに設定すると、起動時と定期的(30分毎)にキャッシュが更新されます
ENABLE_CACHE_UPDATE_JOB=true
CACHE_UPDATE_SCHEDULE=0 */30 * * * *
```

**`packages/frontend/.env` の設定:**

```
VITE_API_URL=http://localhost:3001/api
```

**重要:** 初回起動時やデータを完全に再同期したい場合は、必ず `ENABLE_CACHE_UPDATE_JOB=true` に設定してください。

### 4. 開発サーバーの起動

プロジェクトのルートディレクトリで以下のコマンドを実行します。

```bash
npm run dev
```

- フロントエンド: `http://localhost:5173`
- バックエンドAPI: `http://localhost:3001`

## 📖 APIエンドポイント

- `/api/auth/google`: Google OAuth認証を開始します。
- `/api/auth/me`: 現在のログインユーザー情報を取得します。
- `/api/artists`: アーティストチャンネルの一覧を取得します。
- `/api/artists/new-releases`: 全チャンネルの最新動画を取得します。
- `/api/channels`: 登録チャンネル（アーティスト以外）の一覧を取得します。
- `/api/playlists`: 動画プレイリスト（音楽以外）の一覧を取得します。
- `/api/ytmusic/playlists`: 音楽プレイリストの一覧を取得します。
- `/api/recommendations`: AIによるおすすめを取得します。