const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '..', 'packages', 'backend', '.env') });
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set');
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGODB_URI, { dbName: 'yt-orchestrator' });
  const User = require(path.resolve(__dirname, '..', 'packages', 'backend', 'dist', 'models', 'User.js')).User;
  const CachedChannel = require(path.resolve(__dirname, '..', 'packages', 'backend', 'dist', 'models', 'CachedChannel.js')).CachedChannel;

  const user = await User.findOne({ youtubeAccessToken: { $exists: true, $ne: null } }).lean();
  if (!user) {
    console.log('No user with youtubeAccessToken found');
    await mongoose.disconnect();
    return;
  }
  const userId = user.googleId;
  const cachedChannels = await CachedChannel.find({ userId }).sort({ cachedAt: -1 }).limit(200).lean();
  console.log('Cached channels:', cachedChannels.length);

  const OpenAI = require('openai').default || require('openai');
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey || openaiKey === 'DUMMY_OPENAI_API_KEY') {
    console.log('OPENAI_API_KEY not set or dummy; skipping OpenAI call');
    await mongoose.disconnect();
    return;
  }

  const OpenAIClient = new OpenAI({ apiKey: openaiKey });

  const channelHints = cachedChannels.slice(0, 40).map(ch => ({ title: ch.channelTitle, isArtist: ch.isArtist === true }));
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const prompt = `あなたはYouTubeのおすすめ生成アシスタントです。次の登録チャンネル（抜粋）を参考に、未登録の可能性が高い「検索キーワード/チャンネル名」を5件提案してください。出力は必ずJSON配列のみ。各要素は {"title": string, "channelTitle": string, "reason": string }。channelTitle は YouTube 検索に使う文字列にしてください。既に登録済みっぽい名前は避けてください。\n\n${JSON.stringify(channelHints)}`;

  try {
    console.log('Calling OpenAI...');
    const completion = await OpenAIClient.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: '必ず有効なJSON配列のみを返し、余計な文章は出力しない。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
    });
    const content = completion.choices?.[0]?.message?.content || '';
    console.log('OpenAI response content:', content);
    try {
      const parsed = JSON.parse(content);
      console.log('Parsed JSON:', JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.warn('Failed to parse JSON from OpenAI response');
    }
  } catch (e) {
    console.error('OpenAI call failed:', e?.message || e);
  }

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
