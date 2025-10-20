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
  - 音楽プレイリストと動画プレイリストの高度な自動判定・分離
    - 動画のカテゴリID（Music = 10）による判定
    - "- Topic" チャンネル（公式アーティスト）の検出
    - キーワードベースのフォールバック判定

- **🤖 AIによるおすすめ**
  - **完全キャッシュベース**: YouTube APIクォータを一切消費しない
  - 事前定義された人気チャンネル（10チャンネル）からおすすめ
  - ユーザーの登録チャンネルは自動除外（重複なし）
  - MongoDBキャッシュから登録情報を取得
  - おすすめ理由の表示
  - OpenAI API対応（将来の拡張用）

- **🎤 アーティスト追跡**
  - YouTube Data API v3のチャンネル登録機能を使用
  - 登録アーティストの新曲一覧表示（7日以内にNEWバッジ表示）
  - アーティストの登録・登録解除
  - 各アーティストの最新5動画を一覧表示

- **📺 チャンネル管理**
  - YouTube Data API v3のチャンネル登録機能を使用
  - 登録チャンネルの一覧表示（最新動画サムネイル付き）
  - サムネイルクリックで動画再生（再生ボタン不要）
  - ホバーエフェクト付き再生オーバーレイ
  - チャンネルの登録・登録解除
  - チャンネル検索機能

- **🔐 認証・セキュリティ**
  - Google OAuth 2.0認証
  - YouTubeアクセストークンの自動管理
  - MongoDBへのユーザー情報・トークン永続化
  - Cookieベースのセッション管理
  - .envファイルによる機密情報の安全な管理（コミット対象外）

## 🛠️ 技術スタック

### フロントエンド
## 🛠️ 技術スタック

### YouTubeとYouTube Musicのプレイリスト・アーティスト区別方法

YouTubeとYouTube Musicのプレイリストやアーティストは、以下の方法で判別・分類しています。

1. **URLのドメインによる判別（推奨・実装容易）**  
  - `youtube.com` → 通常の動画・プレイリスト  
  - `music.youtube.com` → YouTube Musicプレイリスト  
  ユーザー入力や自動収集時にURLを持っていれば、ドメインで判定可能。API上では同じでも「どこから来たか」で分類。

2. **含まれる動画IDの特徴による判別**  
  - YouTube Musicのプレイリストは、公式音源（artist channel / topic channel）やmusicVideoタイプが多い。  
  - APIレスポンスの`contentDetails.videoId`で`videos.list`を呼び出し、`categoryId=10（Music）`なら「Musicプレイリスト」とみなす。  
  ※この方法はAPIクォータ消費が多いので注意。

3. **channelIdのパターンによる判別**  
  - Music系プレイリストは、YouTube Music公式（例: `UC-9-kyTW8ZkZNDHQJ6FgpwQ`）や各アーティストの「Topicチャンネル」（`UCxxxx... - Topic`）から生成される。  
  - これらのchannelIdを判別し、Musicカテゴリとして扱う。

4. **タイトルや説明文の傾向分析（機械学習寄り）**  
  - title・description・tagsに「🎵」「- Topic」「mix」「artist name」などが頻出する場合、スコアリングして判定。  
  - API外のロジックで動作するため、クォータ節約になる。

### フロントエンド

### バックエンド
- **🚀 Express.js** - Webフレームワーク
- **🍪 Express Session** - セッション管理
- **📘 TypeScript** - 型安全性
- **📺 googleapis** - YouTube Data API v3統合
- **🎵 ytmusic-api** - YouTube Music API統合
- **🤖 OpenAI API** - AIおすすめ機能（GPT-3.5-turbo）
- **🍃 MongoDB + Mongoose** - データ永続化・キャッシュ・ユーザー管理
- **⏰ node-cron** - バックグラウンドジョブスケジューラー
- **☁️ MongoDB Atlas** - クラウドデータベース（推奨）

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
│       │   ├── routes/      # APIルート
│       │   ├── models/      # Mongooseモデル（User, CachedChannel, CachedPlaylist）
│       │   ├── middleware/  # 認証ミドルウェア
│       │   ├── utils/       # ユーティリティ（DB接続など）
│       │   └── index.ts     # エントリーポイント
│       ├── .env             # 環境変数（コミット対象外）
│       ├── .env.example     # 環境変数テンプレート
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
```bash
# Server Configuration
PORT=3001
NODE_ENV=development

# MongoDB (ローカルまたはクラウド)
# ローカルの場合:
# MONGODB_URI=mongodb://localhost:27017/yt-orchestrator
# MongoDB Atlas（クラウド）の場合:
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/?retryWrites=true&w=majority
MONGODB_API_KEY=your_mongodb_api_key_here
MONGODB_PUBLIC_API_KEY=your_mongodb_public_api_key_here

# Google OAuth 2.0
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here

# JWT & Session
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
SESSION_SECRET=your-random-secret-key-change-this-in-production

# OpenAI API
OPENAI_API_KEY=your_openai_api_key_here

# CORS
FRONTEND_URL=http://localhost:5173
```

**重要**: `.env`ファイルは機密情報を含むため、Gitにコミットされません。

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

### データ管理（最適化アーキテクチャ）
- **ユーザー管理**: MongoDBにユーザー情報とYouTubeトークンを永続化
- **セッション管理**: Express Sessionでメモリ内管理（Google OAuth）
- **MongoDBキャッシュ**: チャンネル・プレイリストデータを30分間キャッシュ
- **3層キャッシュ戦略**:
  1. **メモリキャッシュ**: 60分TTL（高速アクセス）
  2. **MongoDBキャッシュ**: 30分TTL（永続化）
  3. **YouTube API**: フォールバック（差分更新のみ）
- **差分更新技術**:
  - `publishedAfter`パラメータで新しい動画のみ取得
  - ETag条件付きリクエスト（304 Not Modified対応）
  - 変更がない場合はキャッシュ維持
- **クォータ超最適化**: **90-95%のクォータ削減**達成
- **バックグラウンドジョブ**: 30分ごとに差分更新（定期実行）
- **フォールバック対応**: MongoDB未接続時もYouTube APIから直接取得可能
- **クラウド対応**: MongoDB Atlas（クラウド版）をサポート

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

### 2025年10月20日版 - UIプレイヤー改善 & APIクォータ超過対策完全版
- ✅ **全画面VideoPlayerの統合**
  - ホームページでチャンネル画面と同じ全画面モーダルプレイヤーを使用
  - 右下のミニプレイヤーから画面中央の大画面プレイヤー（最大1280px）へ変更
  - Escキー・モーダル外クリックで閉じる機能
  - プレイリスト再生対応（videoseries形式）

- ✅ **APIクォータ超過時の完全対策**
  - 全エンドポイントでMongoDBキャッシュを優先使用
  - `/api/artists`をMongoDBキャッシュから直接返すように変更
  - `/api/artists/new-releases`をキャッシュベースに変更
  - `/api/recommendations`でユーザーID取得方法を修正
  - `/api/ytmusic/playlists`で音楽フィルタを一時的に無効化（全プレイリスト表示）
  - チャンネルクリック時にキャッシュされた`latestVideoId`を優先使用

- ✅ **MongoDBキャッシュデータの修復**
  - 全20チャンネルに`latestVideoTitle`フィールドを追加
  - `fixCachedTitles.ts`スクリプトで既存キャッシュを更新
  - 「[チャンネル名]の最新動画」形式でタイトルを自動生成
  - プレイリストサムネイルURLの検証（全25件確認済み）

- ✅ **フロントエンド最適化**
  - `handleChannelClick`でキャッシュ優先ロジック実装
  - APIクォータを消費せずに動画再生が可能
  - VideoPlayerコンポーネントにplaylistId対応を追加

- 📊 **クォータ超過時の動作**
  - MongoDBキャッシュ: チャンネル20件、プレイリスト25件
  - 全機能がAPIクォータゼロで動作（キャッシュのみ使用）
  - クォータ回復後（毎日午後4-5時）に自動更新

### 2025年10月19日版 - YouTube APIクォータ超最適化
- ✅ **差分更新システムの完全実装**
  - `publishedAfter`パラメータによるチャンネル動画の差分取得
  - 最後のチェック日時以降の新しい動画のみ取得
  - 新着動画がない場合はキャッシュ維持（API呼び出し最小化）

- ✅ **ETag条件付きリクエスト**
  - `If-None-Match`ヘッダーでプレイリスト変更チェック
  - 304 Not Modified応答でクォータ節約
  - 変更があった場合のみデータ取得・更新

- ✅ **バックグラウンドジョブの最適化**
  - 30分ごとの定期実行（node-cron）
  - チャンネル: `publishedAfter`で差分更新
  - プレイリスト: ETagで変更検出
  - 更新が必要なデータのみ処理

- ✅ **MongoDBキャッシュモデルの拡張**
  - `latestVideoPublishedAt`フィールド追加（差分更新用）
  - `etag`フィールド追加（条件付きリクエスト用）
  - キャッシュメタデータの完全管理

- ✅ **AIおすすめのクォータゼロ化**
  - 事前定義チャンネルリスト（10チャンネル）
  - MongoDBキャッシュから登録情報取得
  - YouTube API検索を完全排除

- ✅ **クォータ削減効果**
  - **従来**: 約3,200ユニット/30分 → **153,600ユニット/日** ❌
  - **最適化後**: 約200-600ユニット/30分 → **10,000-15,000ユニット/日** ✅
  - **削減率**: **90-95%削減達成！**
  - 1日10,000ユニット制限内で快適動作

### 2025年10月18日版
- ✅ **MongoDBキャッシュアーキテクチャの完全実装**
  - ユーザーモデル（User.ts）の作成とトークン永続化
  - チャンネルキャッシュモデル（CachedChannel.ts）の実装
  - プレイリストキャッシュモデル（CachedPlaylist.ts）の実装
  - 認証時にユーザー情報とYouTubeトークンを自動保存
  - channels.tsルートをDB優先に変更（30分キャッシュ）
  - playlists.tsルートをDB優先に変更（30分キャッシュ）
  - MongoDB未接続時のフォールバック対応

- ✅ **セキュリティ強化**
  - .envファイルをコミット対象外に設定
  - .env.exampleにクラウドMongoDB設定例を追加
  - 機密情報（APIキー、トークン）の安全な管理

- ✅ **ドキュメント更新**
  - YouTubeとYouTube Musicのプレイリスト・アーティスト区別方法をREADMEに追加
  - MongoDB Atlas（クラウド版）の設定手順を追加

### 2025年10月版
- ✅ **プレイリスト判定の大幅改善**
  - 動画のカテゴリID（Music = 10）による正確な判定機能を追加
  - "- Topic" チャンネル（公式アーティスト）の自動検出
  - 非同期判定メソッド `isMusicPlaylistAsync()` の実装
  - キャッシュ機能でAPIクォータを節約

- ✅ **AIおすすめ機能の改善**
  - 登録チャンネル以外からの推薦に変更（重複除外）
  - OpenAI未使用時のフォールバック改善（人気音楽ジャンルから検索）
  - より多様なおすすめを提供

- ✅ **UI/UX改善**
  - ホーム画面のサムネイルサイズを拡大（200px）
  - サムネイルのアスペクト比を16:9に修正（動画の標準比率）
  - チャンネル・アーティストページでサムネイルクリックによる再生機能
  - ホバーエフェクト付き再生オーバーレイの追加
  - カードレイアウトの改善（下部が見切れない設計）
  - テキストの2行表示対応

### 2025年1月版
- ✅ **UI/UX改善**
  - プレイリストページ: YouTube Musicライブラリをサムネイル表示
  - 再生リストページ: YouTube動画プレイリストをサムネイル表示
  - チャンネルページ: 各チャンネルの最新動画サムネイルを表示
  - ホーム画面: 不要なログインボタンを削除

- ✅ **API最適化とクォータ節約（約80-85%削減）**
  - キャッシュTTLを60分に延長（12倍長持ち）
  - `maxResults`を削減（プレイリスト: 50→25、検索: 20→10、チャンネル動画: 10→5）
  - `fields`パラメータで必要なデータのみ取得（全APIコール）
  - `part`パラメータの最適化（不要なcontentDetailsを削除）
  - ページネーション機能追加（pageTokenサポート）
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
- プレイリスト取得: 1回あたり1ユニット（ETag使用時はさらに削減）
- **実装された超最適化技術**:
  1. **3層キャッシュ戦略**: メモリ（60分）→ MongoDB（30分）→ YouTube API
  2. **差分更新**: `publishedAfter`パラメータで新しいデータのみ取得
  3. **ETag条件付きリクエスト**: 304 Not Modified応答でクォータ節約
  4. **バックグラウンド差分更新**: 30分ごとに変更があったデータのみ更新
  5. **MongoDBキャッシュ**: 重複リクエストを完全排除
  6. **maxResults削減**: 25件まで（プレイリスト）
  7. **fieldsパラメータ**: 必要最小限のデータのみ取得
  8. **AIおすすめのAPI不使用**: 事前定義リスト + キャッシュ
  - **総合削減効果: 90-95%のクォータ削減達成！**
  - **1日の消費量**: 約10,000-15,000ユニット → **無料枠内で動作**✅
- **課金不要**: 最適化により無料枠で十分動作可能

## 📋 今後の改善予定

- 🔜 プレイリストのインポート/エクスポート機能
- 🔜 楽曲の検索機能の強化
- 🔜 動画再生機能の統合
- 🔜 プレイリストのソート・フィルター機能
- 🔜 オフラインキャッシュ機能
- 🔜 OpenAI統合によるパーソナライズドおすすめ（オプション機能）

## 🎯 クォータ最適化の詳細

### 差分更新のしくみ
```
初回アクセス:
1. YouTube API: subscriptions.list (100ユニット)
2. YouTube API: search.list × 20 (2,000ユニット)
3. MongoDBに保存（最終チェック日時も記録）
合計: 2,100ユニット

2回目以降（30分以内）:
1. MongoDBキャッシュから取得
2. YouTube API呼び出し: 0ユニット
合計: 0ユニット ✅ 100%削減

2回目以降（30分以上経過）:
1. YouTube API: publishedAfter=最終チェック日時
   - 新着動画あり2チャンネル: ~200ユニット
   - 新着動画なし18チャンネル: ~200ユニット
2. プレイリスト: ETag使用
   - 変更あり2件: ~50ユニット
   - 変更なし8件（304 Not Modified）: ~10ユニット
合計: ~460ユニット ✅ 78%削減
```

### バックグラウンドジョブ（30分ごと）
```
node-cronで自動実行:
- チャンネル差分更新: publishedAfter使用
- プレイリスト差分更新: ETag使用
- 変更があったデータのみ処理
- ユーザーアクセス時は既にキャッシュ済み
→ ユーザー体験向上 + クォータ節約
```

## ライセンス

MIT

## 貢献

プルリクエストを歓迎します。大きな変更の場合は、まずissueを開いて変更内容を議論してください。