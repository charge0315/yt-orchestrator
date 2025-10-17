# 🎵 YouTube Orchestrator

YouTubeとYouTube Musicのオーケストレータ - 音楽・動画管理をより便利にするWebアプリケーション 🎬

## 概要

YouTube Orchestratorは、YouTubeとYouTube Musicの体験を向上させるための包括的な管理ツールです。YouTube Data API v3と直接統合し、プレイリスト管理、AIによるおすすめ、アーティストの新曲追跡、チャンネル管理など、様々な機能を提供します。

## ✨ 機能

- **🏠 ホームページ**
  - 最新動画の横スクロール表示
  - YouTube（チャンネル・プレイリスト）セクション
  - YouTube Music（アーティスト・プレイリスト）セクション
  - AIによるおすすめセクション
  - 各セクションでソート機能（最新順/名前順）

- **📝 プレイリスト管理**
  - YouTube Data API v3と直接統合
  - YouTube Musicプレイリスト: サムネイル付き一覧表示
  - YouTube動画プレイリスト: サムネイル付き一覧表示
  - リアルタイムでYouTubeと同期
  - 音楽プレイリストと動画プレイリストの自動判定・分離

- **🤖 AIによるおすすめ**
  - OpenAI GPT-3.5を使用した高度なおすすめアルゴリズム
  - ユーザーの登録チャンネルに基づいた新しいチャンネル・アーティストの提案
  - おすすめ理由の表示
  - OpenAI APIキー未設定時のフォールバック処理（登録チャンネルの最新動画を表示）

- **🎤 アーティスト追跡**
  - YouTube Data API v3のチャンネル登録機能を使用
  - 登録アーティストの新曲一覧表示（7日以内にNEWバッジ表示）
  - アーティストの登録・登録解除
  - 各アーティストの最新5動画を一覧表示

- **📺 チャンネル管理**
  - YouTube Data API v3のチャンネル登録機能を使用
  - 登録チャンネルの一覧表示（最新動画サムネイル付き）
  - チャンネルの登録・登録解除
  - チャンネル検索機能

- **🔐 認証**
  - Google OAuth 2.0認証
  - YouTubeアクセストークンの自動管理
  - Cookieベースのセッション管理

## 🛠️ 技術スタック

### フロントエンド
- **⚛️ React** - UIライブラリ
- **⚡ Vite** - ビルドツール
- **🗺️ React Router** - ルーティング
- **🔄 TanStack Query** - データフェッチング・キャッシング
- **📡 Axios** - HTTPクライアント
- **📘 TypeScript** - 型安全性

### バックエンド
- **🚀 Express.js** - Webフレームワーク
- **🍪 Express Session** - セッション管理
- **📘 TypeScript** - 型安全性
- **📺 googleapis** - YouTube Data API v3統合
- **🎵 ytmusic-api** - YouTube Music API統合
- **🤖 OpenAI API** - AIおすすめ機能（GPT-3.5-turbo）

## プロジェクト構造

```
yt-orchestrator/
├── packages/
│   ├── frontend/          # Reactフロントエンド
│   │   ├── src/
│   │   │   ├── components/  # UIコンポーネント
│   │   │   ├── pages/       # ページコンポーネント
│   │   │   ├── api/         # APIクライアント
│   │   │   └── main.tsx     # エントリーポイント
│   │   └── package.json
│   └── backend/           # Express.jsバックエンド
│       ├── src/
│       │   ├── models/      # データモデル（User）
│       │   ├── routes/      # APIルート
│       │   ├── services/    # 外部APIサービス（YouTube API）
│       │   └── index.ts     # エントリーポイント
│       └── package.json
└── package.json           # ルートパッケージ
```

## セットアップ

### 必要要件

- Node.js 18.0.0以上
- npm または yarn

### インストール

1. リポジトリをクローン：
```bash
git clone <repository-url>
cd yt-orchestrator
```

2. 依存関係をインストール：
```bash
npm install
```

3. Google OAuth認証情報を取得：

   a. [Google Cloud Console](https://console.cloud.google.com/)にアクセス

   b. 新しいプロジェクトを作成（または既存のプロジェクトを選択）

   c. 「APIとサービス」→「ライブラリ」で以下のAPIを有効化:
      - YouTube Data API v3

   d. 「APIとサービス」→「認証情報」に移動

   e. 「認証情報を作成」→「OAuth クライアント ID」を選択

   f. アプリケーションの種類: 「ウェブアプリケーション」

   g. 承認済みのJavaScript生成元に追加:
      - `http://localhost:5173`
      - `http://localhost:5174`

   h. 承認済みのリダイレクトURIに追加:
      - `http://localhost:5173`
      - `http://localhost:5174`

   i. OAuth同意画面でスコープを追加:
      - `https://www.googleapis.com/auth/youtube`
      - `https://www.googleapis.com/auth/youtube.force-ssl`

   j. クライアントIDとクライアントシークレットをコピー

4. バックエンドの環境変数を設定：
```bash
cd packages/backend
cp .env.example .env
```

`.env`ファイルを編集して、必要な環境変数を設定してください：
```
PORT=3001
NODE_ENV=development
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
OPENAI_API_KEY=your_openai_api_key_here
SESSION_SECRET=your_random_secret_key_here
FRONTEND_URL=http://localhost:5173
```

5. フロントエンドの環境変数を設定：
```bash
cd packages/frontend
cp .env.example .env
```

`.env`ファイルを編集：
```
VITE_API_URL=http://localhost:3001/api
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
```

### 開発サーバーの起動

プロジェクトルートから以下のコマンドを実行：

```bash
npm run dev
```

これにより、フロントエンドとバックエンドの両方が同時に起動します：
- フロントエンド: http://localhost:5173
- バックエンドAPI: http://localhost:3001

個別に起動する場合：
```bash
# フロントエンドのみ
npm run dev:frontend

# バックエンドのみ
npm run dev:backend
```

## API エンドポイント

### 認証
- `POST /api/auth/google` - Google OAuth認証
- `GET /api/auth/me` - 現在のユーザー情報を取得

### プレイリスト（YouTube Data API v3）
- `GET /api/playlists` - YouTubeプレイリスト一覧を取得
- `GET /api/playlists/:id` - 特定のプレイリストを取得
- `POST /api/playlists` - YouTubeプレイリストを作成
- `PUT /api/playlists/:id` - YouTubeプレイリストを更新
- `DELETE /api/playlists/:id` - YouTubeプレイリストを削除
- `POST /api/playlists/:id/songs` - プレイリストに曲を追加
- `DELETE /api/playlists/:id/songs/:playlistItemId` - プレイリストから曲を削除

### アーティスト（YouTube Data API v3）
- `GET /api/artists` - YouTubeチャンネル登録一覧を取得
- `POST /api/artists` - チャンネルを登録（パラメータ: channelId）
- `DELETE /api/artists/:subscriptionId` - チャンネル登録を解除
- `GET /api/artists/new-releases` - 登録チャンネルの最新動画を取得

### チャンネル（YouTube Data API v3）
- `GET /api/channels` - YouTubeチャンネル登録一覧を取得
- `POST /api/channels` - チャンネルを登録（パラメータ: channelId）
- `DELETE /api/channels/:subscriptionId` - チャンネル登録を解除

### YouTube（動画）
- `GET /api/youtube/playlists` - YouTube動画プレイリスト一覧を取得
- `GET /api/youtube/search` - 動画を検索

### YouTube Music
- `GET /api/ytmusic/playlists` - YouTube Musicプレイリスト一覧を取得
- `GET /api/ytmusic/search` - 音楽を検索

### おすすめ（OpenAI）
- `GET /api/recommendations` - AIによるおすすめチャンネル・アーティストを取得

## ビルド

プロダクションビルドを作成：

```bash
npm run build
```

## テスト

テストを実行：

```bash
npm test
```

## 🏗️ アーキテクチャの特徴

### データ管理
- **セッション管理**: Express Sessionでメモリ内管理（Google OAuth）
- **プレイリスト・チャンネル**: YouTube Data API v3と直接統合
- **リアルタイム同期**: YouTubeと常に同期された状態を維持
- **キャッシング**: 30分間のメモリキャッシュでAPI呼び出しを大幅削減
- **クォータ最適化**: fieldsパラメータとmaxResults削減でクォータ節約

### AI機能
- OpenAI GPT-3.5-turboを使用
- ユーザーの登録チャンネルを分析
- 新しいチャンネル・アーティストを理由付きで提案
- APIキー未設定時の自動フォールバック機能

### コード品質
- **JSDocコメント**: すべてのメソッドに詳細なドキュメントを追加
- **エラーハンドリング**: 適切なログ出力（`console.error`, `console.log`）
- **型安全性**: TypeScriptによる厳格な型チェック
- **キャッシング**: レスポンス高速化のためのキャッシュ機能実装

## 🔄 最近の更新

### 2025年1月版
- ✅ **UI/UX改善**
  - プレイリストページ: YouTube Musicライブラリをサムネイル表示
  - 再生リストページ: YouTube動画プレイリストをサムネイル表示
  - チャンネルページ: 各チャンネルの最新動画サムネイルを表示
  - ホーム画面: 不要なログインボタンを削除

- ✅ **API最適化とクォータ節約**
  - キャッシュTTLを30分に延長（6倍長持ち）
  - `maxResults`を削減（検索: 20→10、チャンネル動画: 10→5）
  - `fields`パラメータで必要なデータのみ取得
  - クォータエラー時の適切なフォールバック処理

- ✅ **バックエンド改善**
  - `/api/youtube/playlists`エンドポイント追加
  - `/api/youtube/search`エンドポイント追加
  - YouTube動画プレイリストと音楽プレイリストの分離
  - エラーハンドリングの強化

- ✅ **認証フロー改善**
  - 不要なYouTube連携ボタンを削除
  - Google OAuthで自動的にYouTubeアクセス可能に
  - セッション管理の最適化

## ⚠️ 重要な注意事項

### YouTube Data API v3 クォータ制限
- 無料枠: 1日あたり10,000ユニット
- 検索: 1回あたり100ユニット
- プレイリスト取得: 1回あたり1ユニット
- **対策**: 30分間のキャッシュ、maxResults削減、fieldsパラメータ最適化
- **推奨**: Google Cloud Consoleで課金を有効化（無料枠超過分のみ課金）

## 📋 今後の改善予定

- 🔜 プレイリストのインポート/エクスポート機能
- 🔜 楽曲の検索機能の強化
- 🔜 動画再生機能の統合
- 🔜 プレイリストのソート・フィルター機能
- 🔜 オフラインキャッシュ機能

## ライセンス

MIT

## 貢献

プルリクエストを歓迎します。大きな変更の場合は、まずissueを開いて変更内容を議論してください。