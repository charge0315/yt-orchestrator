import express, { Request, Response } from 'express';
import Artist from '../models/Artist.js';

const router = express.Router();

// Get all subscribed artists
router.get('/', async (req: Request, res: Response) => {
  try {
    const artists = await Artist.find().sort({ subscribedAt: -1 });
    res.json(artists);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch artists' });
  }
});

// Subscribe to an artist
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, artistId, thumbnail } = req.body;

    const existingArtist = await Artist.findOne({ artistId });
    if (existingArtist) {
      return res.status(400).json({ error: 'Already subscribed to this artist' });
    }

    const artist = new Artist({
      name,
      artistId,
      thumbnail,
      newReleases: []
    });

    await artist.save();
    res.status(201).json(artist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to subscribe to artist' });
  }
});

// Unsubscribe from an artist
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const artist = await Artist.findByIdAndDelete(req.params.id);
    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }
    res.json({ message: 'Unsubscribed from artist successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unsubscribe from artist' });
  }
});

// Get new releases from subscribed artists
router.get('/new-releases', async (req: Request, res: Response) => {
  try {
    const artists = await Artist.find();
    const allNewReleases = artists.flatMap(artist =>
      artist.newReleases.map(release => ({
        ...release.toObject(),
        artistName: artist.name,
        artistId: artist.artistId
      }))
    );

    // Sort by release date, newest first
    allNewReleases.sort((a, b) =>
      new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
    );

    res.json(allNewReleases);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch new releases' });
  }
});

export default router;
