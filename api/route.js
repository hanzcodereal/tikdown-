const axios = require('axios');
const cheerio = require('cheerio');

const headers = {
  'Content-Type': 'application/x-www-form-urlencoded',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  Origin: 'https://savett.cc',
  Referer: 'https://savett.cc/en1/download',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36'
};

async function getCsrfAndCookie() {
  const res = await axios.get('https://savett.cc/en1/download');
  const csrf = res.data.match(/name="csrf_token" value="([^"]+)"/)?.[1];
  const cookie = res.headers['set-cookie']
    .map(v => v.split(';')[0])
    .join('; ');
  return { csrf, cookie };
}

async function postDownload(url, csrf, cookie) {
  const res = await axios.post(
    'https://savett.cc/en1/download',
    `csrf_token=${encodeURIComponent(csrf)}&url=${encodeURIComponent(url)}`,
    {
      headers: {
        ...headers,
        Cookie: cookie
      }
    }
  );
  return res.data;
}

function parseResult(html) {
  const $ = cheerio.load(html);

  const stats = [];
  $('#video-info .my-1 span').each((_, el) => {
    stats.push($(el).text().trim());
  });

  const metadata = {
    username: $('#video-info h3').first().text().trim() || null,
    views: stats[0] || null,
    likes: stats[1] || null,
    bookmarks: stats[2] || null,
    comments: stats[3] || null,
    shares: stats[4] || null,
    duration: $('#video-info p.text-muted')
      .first()
      .text()
      .replace(/Duration:/i, '')
      .trim() || null,
    type: null
  };

  const result = [];

  const slides = $('.carousel-item[data-data]');

  if (slides.length) {
    metadata.type = 'photo';
    slides.each((_, el) => {
      try {
        const json = JSON.parse(
          $(el).attr('data-data').replace(/&quot;/g, '"')
        );
        if (Array.isArray(json.URL)) {
          json.URL.forEach(url => {
            result.push({
              type: 'photo',
              label: 'Photo ' + (result.length + 1),
              url: url
            });
          });
        }
      } catch {}
    });
    return { metadata, result };
  }

  metadata.type = 'video';

  $('#formatselect option').each((_, el) => {
    const label = $(el).text().toLowerCase();
    const raw = $(el).attr('value');
    if (!raw) return;

    try {
      const json = JSON.parse(raw.replace(/&quot;/g, '"'));
      if (!json.URL) return;

      if (label.includes('mp4') && !label.includes('watermark')) {
        json.URL.forEach(url => {
          result.push({
            type: 'nowm',
            label: 'No Watermark',
            url: url
          });
        });
      }

      if (label.includes('watermark')) {
        json.URL.forEach(url => {
          result.push({
            type: 'wm',
            label: 'With Watermark',
            url: url
          });
        });
      }

      if (label.includes('mp3')) {
        json.URL.forEach(url => {
          result.push({
            type: 'audio',
            label: 'MP3 Audio',
            url: url
          });
        });
      }
    } catch {}
  });

  return { metadata, result };
}

async function savettDownloader(url) {
  try {
    const { csrf, cookie } = await getCsrfAndCookie();
    const html = await postDownload(url, csrf, cookie);
    const { metadata, result } = parseResult(html);
    return {
      Status: result.length > 0,
      Code: 200,
      Input: url,
      Metadata: metadata,
      Result: result
    };
  } catch (error) {
    return {
      Status: false,
      Code: 500,
      Input: url,
      Error: error.message
    };
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const result = await savettDownloader(url);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      Status: false,
      Code: 500,
      Input: url,
      Error: error.message
    });
  }
};
