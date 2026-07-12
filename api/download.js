const axios = require('axios');
const cheerio = require('cheerio');

const tiktokDL = async (url, retries = 5) => {
  if (!url?.trim()) return { success: false, result: 'URL kosong' };

  const req = async (opts) => {
    for (let i = 0; i < retries; i++) {
      try {
        const r = await axios({
          ...opts,
          timeout: 7000,
          maxRedirects: 5
        });
        return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
      } catch (e) {
        if (i === retries - 1) throw e;
        await new Promise(r => setTimeout(r, 2 ** i * 1000));
      }
    }
  };

  try {
    const { status, data, statusCode, msg } = await req({
      url: 'https://tikdownloader.cc/api/ajaxSearch',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36'
      },
      data: new URLSearchParams({ q: url }).toString()
    });

    if (statusCode === 326) return { success: false, result: msg || 'Link invalid' };
    if (status !== 'ok' || !data) return { success: false, result: 'Gagal ambil data' };

    const html = data.replace(/&(?:amp|lt|gt|quot|#x27|#39|#x2F|nbsp|#xA0|#160|#(\d+)|#x([0-9a-fA-F]+));/gi, 
      (_, dec, hex) => dec ? String.fromCharCode(dec) : hex ? String.fromCharCode(parseInt(hex, 16)) : 
      { '&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#x27;':"'",'&#39;':"'",'&#x2F;':'/','&nbsp;':' ','&#xA0;':' ','&#160;':' ' }[_] || _);

    const $ = s => (html.match(s) || [])[1]?.trim();
    const isPhoto = html.includes('photo-list');
    
    const downloads = isPhoto 
      ? [...html.matchAll(/href="([^"]+)"[^>]*btn-premium[^>]*>[\s\S]*?Download Image/g)].map((m, i) => ({ type: `Image ${i+1}`, url: m[1] }))
          .concat((html.match(/href="([^"]+dl\.snapcdn\.app[^"]+)".*?Download MP3/) || []).slice(1).map(u => ({ type: 'MP3', url: u })))
      : [...html.matchAll(/href="([^"]+)"[^>]*tik-button-dl[^>]*>([\s\S]*?)<\/a>/g)].map(m => ({ 
          type: m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), 
          url: m[1] 
        }));

    if (!downloads.length) return { success: false, result: 'Tidak ada link download' };

    return {
      success: true,
      result: {
        type: isPhoto ? 'photo' : 'video',
        title: $(/<h3[^>]*>([^<]+)<\/h3>/),
        thumbnail: $(/<img[^+]+src="([^"]+)"[^>]*(?:class="[^"]*image-tik[^"]*"|)/),
        downloads
      }
    };
  } catch (e) {
    return { success: false, result: e.message };
  }
};

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
    const result = await tiktokDL(url);

    if (!result.success) {
      throw new Error(result.result || 'Failed to download video');
    }

    const response = {
      success: true,
      data: {
        username: result.result.title || null,
        video_title: result.result.title || null,
        type: result.result.type,
        thumbnail: result.result.thumbnail || null,
        downloads: {
          nowm: [],
          wm: [],
          mp3: []
        }
      },
      metadata: {
        platform: 'TikTok',
        scraped_at: new Date().toISOString(),
        source: 'tikdownloader.cc',
        video_url: url
      }
    };

    if (result.result.downloads) {
      result.result.downloads.forEach(item => {
        if (item.type && item.type.toLowerCase().includes('no watermark')) {
          response.data.downloads.nowm.push(item.url);
        } else if (item.type && (item.type.toLowerCase().includes('watermark') || item.type.toLowerCase().includes('wm'))) {
          response.data.downloads.wm.push(item.url);
        } else if (item.type && (item.type.toLowerCase().includes('mp3') || item.type.toLowerCase().includes('audio'))) {
          response.data.downloads.mp3.push(item.url);
        } else if (item.type && item.type.toLowerCase().includes('image')) {
          if (!response.data.slides) response.data.slides = [];
          response.data.slides.push({
            index: response.data.slides.length + 1,
            url: item.url
          });
        }
      });
    }

    if (response.data.slides && response.data.slides.length > 0) {
      response.data.type = 'photo';
    }

    res.status(200).json(response);
  } catch (error) {
    let statusCode = 500;
    let errorMessage = 'Failed to download video';

    if (error.message.includes('invalid')) {
      statusCode = 404;
      errorMessage = 'Video not found or private';
    } else if (error.message.includes('rate limit')) {
      statusCode = 429;
      errorMessage = 'Rate limit exceeded. Please try again later';
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: error.message
    });
  }
};
