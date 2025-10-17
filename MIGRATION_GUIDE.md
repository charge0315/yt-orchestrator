# MongoDB → YouTube Data API v3 移行ガイド

## 変更概要

MongoDBでの独自データ管理から、YouTube Data API v3を直接使用する方式に変更しました。

## 主な変更点

### 1. プレイリスト管理
- **変更前**: MongoDBにプレイリストと曲情報を保存
- **変更後**: YouTube Data API v3のプレイリスト機能を直接使用

### 2. アーティスト/チャンネル管理
- **変更前**: MongoDBにアーティスト/チャンネル情報を保存
- **変更後**: YouTube Data API v3のチャンネル登録機能を使用

### 3. ユーザー認証
- **変更なし**: MongoDBでユーザー情報を管理（YouTube APIにはユーザー管理機能がないため）
- **追加**: YouTubeアクセストークンをユーザーモデルに保存

## 影響を受けるファイル

### バックエンド

#### 新規作成
- `packages/backend/src/services/youtubeApi.ts` - YouTube Data API v3サービス

#### 変更
- `packages/backend/src/routes/playlists.ts` - YouTube APIを使用
- `packages/backend/src/routes/artists.ts` - YouTube APIを使用
- `packages/backend/src/routes/channels.ts` - YouTube APIを使用
- `packages/backend/src/routes/auth.ts` - YouTubeトークン保存を追加

#### 不要になったモデル（削除可能）
- `packages/backend/src/models/Playlist.ts`
- `packages/backend/src/models/Artist.ts`
- `packages/backend/src/models/Channel.ts`

### API エンドポイントの変更

#### プレイリスト
- `GET /api/playlists` - YouTube APIから取得
- `POST /api/playlists` - YouTube APIで作成
- `PUT /api/playlists/:id` - YouTube APIで更新
- `DELETE /api/playlists/:id` - YouTube APIで削除
- `POST /api/playlists/:id/songs` - YouTube APIで追加
- `DELETE /api/playlists/:id/songs/:playlistItemId` - パラメータが`videoId`から`playlistItemId`に変更

#### アーティスト/チャンネル
- `GET /api/artists` - YouTube APIのチャンネル登録一覧を取得
- `POST /api/artists` - `channelId`パラメータが必要
- `DELETE /api/artists/:id` - `:id`はYouTubeのsubscriptionId
- `GET /api/artists/new-releases` - 登録チャンネルの最新動画を取得

## 必要な設定

### 環境変数
```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### Google Cloud Console設定
1. YouTube Data API v3を有効化
2. OAuth 2.0スコープに以下を追加:
   - `https://www.googleapis.com/auth/youtube`
   - `https://www.googleapis.com/auth/youtube.force-ssl`

## フロントエンドの変更が必要な箇所

### 認証フロー
Google OAuth時にYouTubeアクセストークンを取得し、バックエンドに送信する必要があります。

### プレイリスト曲削除
`videoId`ではなく`playlistItemId`を使用する必要があります。

## 利点

1. **データ同期不要**: YouTubeと常に同期
2. **ストレージ削減**: MongoDBのストレージ使用量削減
3. **公式機能**: YouTube公式のプレイリスト/チャンネル登録機能を使用

## 注意点

1. **API制限**: YouTube Data API v3のクォータ制限に注意
2. **認証必須**: すべての操作にYouTubeアクセストークンが必要
3. **データ移行**: 既存のMongoDBデータは手動で移行が必要
