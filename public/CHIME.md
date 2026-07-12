# chime.mp3 needed here

The alarm library (`src/lib/alarm.ts`) plays `/chime.mp3` when a study session
or break ends. **Drop a short, gentle audio file at `public/chime.mp3` before
shipping** — the app degrades silently if it's missing (browser notification
still fires; audio just doesn't play), but the experience is much nicer with
sound.

## What to look for

- **~1 second** long — anything longer is annoying
- **Soft / pleasant** — a wind-chime, a soft bell, a marimba note
- **Peaks well below 0 dBFS** so it doesn't startle
- **CC0 / public-domain licensed** so nothing licensed leaks into the repo

## Where to find one

- freesound.org — filter by license = CC0
- pixabay.com/sound-effects — most are CC0
- Anthropic-generated audio: OK, but avoid anything derivative of copyrighted material

Once you drop a file here, delete this note (or leave it — it's public but
harmless).
