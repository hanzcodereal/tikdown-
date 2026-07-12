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
  const res = await axios.post('https://savett.cc/en1/download', 
    formData,
    { 
      headers: { 
        ...headers, 
        Cookie: cookie,
        'Content-Length': String(formData.length)
      } 
    }
  );
  return res.data;
}

function parseHtml(html) {
  const $ = cheerio.load(html);
  
  const stats = [];
  $('#video-info .my-1 span').each(function(_, el) {
    const text = $(el).text().trim();
    if (text) stats.push(text);
  });

  const username = $('#video-info h3').first().text().trim();
  
  const description = $('#video-info p.text-muted')
    .filter(function(_, el) {
      return !$(el).text().toLowerCase().includes('duration');
    })
    .first()
    .text()
    .trim() || null;

  const postedAt = $('.text-muted small')
    .first()
    .text()
    .trim() || null;

  const data = {
    username: username || null,
    description: description,
    postedAt: postedAt,
    views: stats[0] || '0',
    likes: stats[1] || '0',
    bookmarks: stats[2] || '0',
    comments: stats[3] || '0',
    shares: stats[4] || '0',
    duration: $('#video-info p.text-muted')
      .filter(function(_, el) { return $(el).text().toLowerCase().includes('duration'); })
      .first()
      .text()
      .replace(/Duration:/i, '')
      .trim() || null,
    type: 'video',
    downloads: { 
      nowm: [], 
      wm: [] 
    },
    mp3: [],
    slides: [],
    thumbnail: null,
    music: null,
    music_author: null
  };

  const thumbnailImg = $('img[src*="tiktok"]').first().attr('src');
  if (thumbnailImg) {
    data.thumbnail = thumbnailImg;
  }

  const musicInfo = $('.music-info').first();
  if (musicInfo.length) {
    const musicText = musicInfo.text().trim();
    const musicParts = musicText.split(' - ');
    if (musicParts.length === 2) {
      data.music = musicParts[1]?.trim() || null;
      data.music_author = musicParts[0]?.trim() || null;
    }
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

  console.log('Method:', req.method);
  console.log('Body:', req.body);
  console.log('Query:', req.query);

  var url = req.body?.url || req.query?.url;

  if (!url) {
    console.log('URL not found in request');
    return res.status(400).json({ 
      success: false,
      error: 'URL is required',
      message: 'Please provide a TikTok video URL'
    });
  }

  url = url.trim();
  console.log('Processing URL:', url);

  if (!url.includes('tiktok.com') && !url.includes('vt.tiktok')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid URL',
      message: 'Please provide a valid TikTok URL'
    });
  }

  try {
    console.log('Fetching CSRF token...');
    const { csrf, cookie } = await getCsrf();
    
    if (!csrf) {
      throw new Error('Failed to get CSRF token');
    }
    console.log('CSRF token obtained');

    console.log('Posting URL to savett.cc...');
    const html = await postUrl(url, csrf, cookie);
    console.log('Response received, parsing HTML...');
    
    const result = parseHtml(html);
    console.log('Parsed result:', JSON.stringify(result, null, 2));
    
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

    console.log('Sending success response');
    res.status(200).json(response);
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    var statusCode = 500;
    var errorMessage = 'Failed to download video';
    
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
