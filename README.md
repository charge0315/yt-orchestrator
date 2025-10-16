# YouTube Orchestrator

YouTubeとYouTube Musicのオーケストレータ - 音楽・動画管理をより便利にするWebアプリケーション

## 概要

YouTube Orchestratorは、YouTubeとYouTube Musicの体験を向上させるための包括的な管理ツールです。プレイリスト管理、AIによるおすすめ、アーティストの新曲追跡、チャンネル管理など、様々な機能を提供します。

## 機能

- **プレイリスト管理**
  - プレイリストの一覧表示
  - プレイリストの作成・削除
  - プレイリストへの曲の追加・削除

- **AIによるおすすめ**
  - ユーザーの音楽の好みに基づいたおすすめ曲の表示

- **アーティスト追跡**
  - 登録アーティストの新曲一覧表示
  - アーティストの登録・登録解除

- **チャンネル管理**
  - 登録チャンネルの一覧表示
  - チャンネルの登録・登録解除

## 技術スタック

### フロントエンド
- **React** - UIライブラリ
- **Vite** - ビルドツール
- **React Router** - ルーティング
- **TanStack Query** - データフェッチング・キャッシング
- **Axios** - HTTPクライアント
- **TypeScript** - 型安全性

### バックエンド
- **Express.js** - Webフレームワーク
- **MongoDB** - データベース
- **Mongoose** - ODM（Object Document Mapper）
- **TypeScript** - 型安全性
- **ytmusic-api** - YouTube Music API統合
- **OpenAI** - AIおすすめ機能

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
│       │   ├── models/      # データモデル
│       │   ├── routes/      # APIルート
│       │   └── index.ts     # エントリーポイント
│       └── package.json
└── package.json           # ルートパッケージ
```

## セットアップ

### 必要要件

- Node.js 18.0.0以上
- MongoDB（ローカルまたはMongoDB Atlas）
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

   c. 「APIとサービス」→「認証情報」に移動

   d. 「認証情報を作成」→「OAuth クライアント ID」を選択

   e. アプリケーションの種類: 「ウェブアプリケーション」

   f. 承認済みのJavaScript生成元に追加:
      - `http://localhost:5173`
      - `http://localhost:5174`

   g. 承認済みのリダイレクトURIに追加:
      - `http://localhost:5173`
      - `http://localhost:5174`

   h. クライアントIDをコピー

4. バックエンドの環境変数を設定：
```bash
cd packages/backend
cp .env.example .env
```

`.env`ファイルを編集して、必要な環境変数を設定してください：
```
PORT=3001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/yt-orchestrator
YOUTUBE_API_KEY=your_youtube_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
GOOGLE_CLIENT_ID=your_google_client_id_here
JWT_SECRET=your_random_secret_key_here
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

### プレイリスト
- `GET /api/playlists` - すべてのプレイリストを取得
- `GET /api/playlists/:id` - 特定のプレイリストを取得
- `POST /api/playlists` - プレイリストを作成
- `PUT /api/playlists/:id` - プレイリストを更新
- `DELETE /api/playlists/:id` - プレイリストを削除
- `POST /api/playlists/:id/songs` - プレイリストに曲を追加
- `DELETE /api/playlists/:id/songs/:videoId` - プレイリストから曲を削除

### アーティスト
- `GET /api/artists` - すべての登録アーティストを取得
- `POST /api/artists` - アーティストを登録
- `DELETE /api/artists/:id` - アーティストの登録を解除
- `GET /api/artists/new-releases` - 新曲一覧を取得

### チャンネル
- `GET /api/channels` - すべての登録チャンネルを取得
- `POST /api/channels` - チャンネルを登録
- `DELETE /api/channels/:id` - チャンネルの登録を解除

### おすすめ
- `GET /api/recommendations` - おすすめ曲を取得

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

## 今後の改善予定

- YouTube Music API との完全統合
- OpenAI APIを使用した高度なおすすめアルゴリズム
- ユーザー認証とマルチユーザー対応
- プレイリストのインポート/エクスポート機能
- 楽曲の検索機能の強化
- リアルタイム同期機能

## ライセンス

MIT

## 貢献

プルリクエストを歓迎します。大きな変更の場合は、まずissueを開いて変更内容を議論してください。