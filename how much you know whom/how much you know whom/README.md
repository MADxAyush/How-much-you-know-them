# How Much You Know Them

This project is now a frontend-only quiz website.

## How it works

- The quiz creator answers 10 questions
- The site creates a shareable link with those answers inside the URL
- A friend opens the link and plays the quiz
- The friend sees their result after question 10
- The same device/browser will remember that result and reopen it directly

## Important limit

- Scores are only remembered on the same device/browser
- There is no backend, database, or cross-device leaderboard

## Main files

- `htmlfiles/` contains the quiz pages
- `imagesfile/` contains the images used in the boxes
- `style.css` contains the styling
- `script.js` contains the frontend quiz logic
- `index.html` redirects to `htmlfiles/index.html`

## To open it on other devices

- Upload this project to a free static host like GitHub Pages, Netlify, or Vercel
- Then open the hosted URL instead of the local folder path
- After that, other devices can open the site, play the quiz, and see their own result
