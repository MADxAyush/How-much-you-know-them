# Deployment Notes

This project is deployment-ready as a small Node web app.

## What is already prepared

- `server.js` serves both the website and the API.
- `app.js` uses same-origin API calls when the app is hosted publicly.
- `render.yaml` is ready for Render deployment with persistent storage.
- `DATA_DIR` can be set so quiz data is written to a persistent disk.
- `start-public.cmd` and `start-public.ps1` can expose the local app temporarily with a public tunnel.

## Important

This app stores quizzes and attempts on disk in `db.json`.

For a real public deployment, use a host that supports persistent storage. The included
`render.yaml` is configured to mount a persistent disk at `/var/data`.

The `public-url.txt` file is only for local temporary sharing through the tunnel flow.
When the app is hosted on a real domain, `app.js` ignores that file and uses the hosted domain automatically.

## Local run

```powershell
& 'C:\Program Files\nodejs\node.exe' server.js
```

Then open:

```text
http://localhost:3000/htmlfiles/index.html
```

## Temporary public sharing from your computer

1. Start the local server if it is not already running.
2. Run `start-public.cmd`.
3. Keep that tunnel window open while friends are using the site.
4. The live public base URL will be written into `public-url.txt`.
5. Open `http://localhost:3000/htmlfiles/index.html`, create a quiz, and copy the share link from `share.html`.

## Permanent hosting on Render

Estimated time once a Render account and code repo are ready: `15 to 25 minutes`

1. Put this project in a GitHub repository.
2. Create a new Render Web Service from that repository.
3. Let Render detect `render.yaml`.
4. Keep the service type as `web`.
5. Make sure the persistent disk is enabled at `/var/data`.
6. Deploy the service.
7. Open the live Render URL and create a fresh quiz there.
8. Test one creator flow and one player flow on the live domain.

## What “fully complete” means here

- Your app code is ready.
- Local backend storage is ready.
- Public leaderboard logic is ready.
- Permanent 24/7 availability still needs a real hosted service.

Without the hosting account connection, the final Render publish step cannot be completed from this machine alone.
