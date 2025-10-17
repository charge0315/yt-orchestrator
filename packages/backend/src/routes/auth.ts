import express, { Request, Response } from 'express';
import User from '../models/User.js';
import { generateToken, authenticate, AuthRequest } from '../middleware/auth.js';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';

const router = express.Router();

function getGoogleClient() {
  return new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
}

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback`
  );
}

// Register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create new user
    const user = new User({ email, password, name });
    await user.save();

    // Generate token
    const token = generateToken(user._id.toString());

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.status(201).json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      },
      token
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(user._id.toString());

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      },
      token
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

// Get current user (auto-login check)
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Google OAuth - Start authentication
router.get('/google', (req: Request, res: Response) => {
  const oauth2Client = getOAuth2Client();
  
  const scopes = [
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.force-ssl',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });

  res.redirect(url);
});

// Google OAuth - Handle callback
router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const oauth2Client = getOAuth2Client();
    const { code } = req.query;
    
    if (!code || typeof code !== 'string') {
      return res.redirect(`${process.env.FRONTEND_URL}?error=no_code`);
    }

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    if (!data.email) {
      return res.redirect(`${process.env.FRONTEND_URL}?error=no_email`);
    }

    let user = await User.findOne({ email: data.email });

    if (!user) {
      const randomPassword = Math.random().toString(36).slice(-8);
      user = new User({
        email: data.email,
        name: data.name || data.email.split('@')[0],
        password: randomPassword,
        googleId: data.id,
        picture: data.picture,
        youtubeAccessToken: tokens.access_token,
        youtubeRefreshToken: tokens.refresh_token
      });
    } else {
      user.youtubeAccessToken = tokens.access_token;
      if (tokens.refresh_token) {
        user.youtubeRefreshToken = tokens.refresh_token;
      }
    }
    
    await user.save();

    const token = generateToken(user._id.toString());

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173');
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}?error=auth_failed`);
  }
});

router.post('/google', async (req: Request, res: Response) => {
  try {
    const googleClient = getGoogleClient();
    const { credential, youtubeAccessToken, youtubeRefreshToken } = req.body;

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ error: 'Invalid Google token' });
    }

    const { email, name, picture } = payload;
    let user = await User.findOne({ email });

    if (!user) {
      const randomPassword = Math.random().toString(36).slice(-8);
      user = new User({
        email,
        name: name || email.split('@')[0],
        password: randomPassword,
        googleId: payload.sub,
        picture,
        youtubeAccessToken,
        youtubeRefreshToken
      });
    } else {
      user.youtubeAccessToken = youtubeAccessToken;
      user.youtubeRefreshToken = youtubeRefreshToken;
    }
    
    await user.save();

    const token = generateToken(user._id.toString());

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      },
      token
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Failed to authenticate with Google' });
  }
});

export default router;
