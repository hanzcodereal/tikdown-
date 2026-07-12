const axios = require('axios');
const cheerio = require('cheerio');

const headers = {
  'Content-Type': 'application/x-www-form-urlencoded',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  Origin: 'https://savett.cc',
  Referer: 'https://savett.cc/en1/download',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36'
};

async function getCsrf() {
  const res = await axios.get('https://savett.cc/en1/download', {
    headers: {
      'User-Agent': headers['User-Agent']
    }
  });

  return {
    csrf: res.data.match(/name="csrf_token" value="([^"]+)"/)?.[1],
    cookie: res.headers['set-cookie']
      ? res.headers['set-cookie'].map(function(v) { return v.split(';')[0]; }).join('; ')
      : ''
  };
}

async function postUrl(url, csrf, cookie) {
  const formData = 'csrf_token=' + encodeURIComponent(csrf) + '&url=' + encodeURIComponent(url);
  const res = await axios.post('https://savett.cc/en1/download', formData, {
    headers: {
      ...headers,
      Cookie: cookie,
      'Content-Length': String(formData.length)
    }
  });
  return res.data;
}

function parseHtml(html) {
  const $ = cheerio.load(html);

  const stats = [];
  $('#video-info .my-1 span').each(function(_, el) {
    const text = $(el).text().trim();
    if (text) stats.push(text);
  });

  const data = {
    username: $('#video-info h3').first().text().trim() || null,
    views: stats[0] || null,
    likes: stats[1] || null,
    bookmarks: stats[2] || null,
    comments: stats[3] || null,
    shares: stats[4] || null,
    duration: $('#video-info p.text-muted')
      .filter(function(_, el) {
        return $(el).text().toLowerCase().includes('duration');
      })
      .first()
      .text()
      .replace(/Duration:/i, '')
      .trim() || null,
    type: null,
    downloads: {
      nowm: [],
      wm: []
    },
    mp3: [],
    slides: [],
    thumbnail: null,
    description: null
  };

  const thumbnailImg = $('img[src*="tiktok"]').first().attr('src');
  if (thumbnailImg) {
    data.thumbnail = thumbnailImg;
  }

  const description = $('#video-info p.text-muted')
    .filter(function(_, el) {
      return !$(el).text().toLowerCase().includes('duration');
    })
    .first()
    .text()
    .trim();
  if (description) {
    data.description = description;
  }

  const slides = $('.carousel-item[data-data]');
  if (slides.length) {
    data.type = 'photo';
    slides.each(function(_, el) {
      try {
        const rawData = $(el).attr('data-data');
        if (!rawData) return;
        const json = JSON.parse(rawData.replace(/&quot;/g, '"'));
        if (Array.isArray(json.URL)) {
          json.URL.forEach(function(url) {
            data.slides.push({
              index: data.slides.length + 1,
              url: url
            });
          });
        }
      } catch (e) {}
    });
    return data;
  }

  data.type = 'video';

  $('#formatselect option').each(function(_, el) {
    const label = $(el).text().toLowerCase();
    const raw = $(el).attr('value');
    if (!raw) return;

    try {
      const json = JSON.parse(raw.replace(/&quot;/g, '"'));
      if (!json.URL) return;

      const urls = Array.isArray(json.URL) ? json.URL : [json.URL];

      if (label.includes('mp4') && !label.includes('watermark')) {
        data.downloads.nowm.push.apply(data.downloads.nowm, urls);
      }
      if (label.includes('watermark') || label.includes('wm')) {
        data.downloads.wm.push.apply(data.downloads.wm, urls);
      }
      if (label.includes('mp3') || label.includes('audio')) {
        data.mp3.push.apply(data.mp3, urls);
      }
    } catch (e) {}
  });

  if (data.downloads.nowm.length === 0 && data.downloads.wm.length === 0) {
    $('a[href*="tiktok"]').each(function(_, el) {
      const href = $(el).attr('href');
      if (href && href.includes('.mp4')) {
        if (href.includes('watermark')) {
          data.downloads.wm.push(href);
        } else {
          data.downloads.nowm.push(href);
        }
      }
    });
  }

  return data;
}

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const url = req.body?.url || req.query?.url;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'URL is required',
      message: 'Please provide a TikTok video URL'
    });
  }

  if (!url.includes('tiktok.com') && !url.includes('vt.tiktok')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid URL',
      message: 'Please provide a valid TikTok URL'
    });
  }

  try {
    const { csrf, cookie } = await getCsrf();

    if (!csrf) {
      throw new Error('Failed to get CSRF token');
    }

    const html = await postUrl(url, csrf, cookie);
    const result = parseHtml(html);

    if (!result.username && result.slides.length === 0) {
      throw new Error('Failed to parse content or video not found');
    }

    const response = {
      success: true,
      data: result,
      metadata: {
        platform: 'TikTok',
        scraped_at: new Date().toISOString(),
        source: 'savett.cc'
      }
    };

    res.status(200).json(response);
  } catch (error) {
    let statusCode = 500;
    let errorMessage = 'Failed to download video';

    if (error.response?.status === 404) {
      statusCode = 404;
      errorMessage = 'Video not found or private';
    } else if (error.response?.status === 429) {
      statusCode = 429;
      errorMessage = 'Rate limit exceeded. Please try again later';
    } else if (error.code === 'ECONNABORTED') {
      statusCode = 504;
      errorMessage = 'Request timeout';
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: error.message
    });
  }
};
