 #Tikdown - TikTok Downloader

TikTok video downloader without watermark. Supports video, audio, and photo slides download.

## Features

- Download TikTok videos without watermark
- Download audio (MP3) from TikTok
- Download photo slides from TikTok
- No registration required
- Free to use
- Responsive design

## Tech Stack

- Node.js
- Axios
- Cheerio
- Vercel

## Project Structure

| File | Description |
|------|-------------|
| `package.json` | Contains project name, version, scripts, and dependencies (axios, cheerio) |
| `api/download.js` | Main API handler. Scrapes TikTok content from savett.cc, extracts video/audio/image links |
| `public/index.html` | Landing page with form input, FAQ section, and result container |
| `public/style.css` | Complete styling including responsive design, dark theme, animations, and scrollbar |
| `public/script.js` | Handles form submission, API calls, FAQ accordion, and scroll animations |

## Workflow

1. User opens `index.html`
2. User pastes TikTok link into the input field
3. Form submission triggers fetch request to `/api/download`
4. `download.js` scrapes data from savett.cc:
   - Gets CSRF token
   - Posts URL to get video data
   - Parses HTML with Cheerio
   - Extracts video, audio, and slide download links
5. Response is displayed in `#resultContainer`
6. User clicks download link to save content
