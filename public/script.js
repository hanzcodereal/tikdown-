document.querySelectorAll('.faq-box .faq-question').forEach(function(question) {
  question.addEventListener('click', function() {
    var content = this.nextElementSibling;
    if (content.style.maxHeight && content.style.maxHeight !== '0px') {
      content.style.maxHeight = '0';
    } else {
      document.querySelectorAll('.faq-content').forEach(function(c) {
        c.style.maxHeight = '0';
      });
      content.style.maxHeight = content.scrollHeight + 'px';
    }
  });
});

var observer = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting) {
      entry.target.classList.add('aos-animate');
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('[data-aos]').forEach(function(el) {
  observer.observe(el);
});

function downloadFile(url, filename) {
  var link = document.createElement('a');
  link.href = url;
  link.download = filename || 'download';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

document.getElementById('downloadForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  var url = document.getElementById('tiktokUrl').value.trim();
  var container = document.getElementById('resultContainer');

  if (!url) {
    container.innerHTML = '<div class="text-red-400 text-center">Please paste a TikTok link</div>';
    return;
  }

  container.innerHTML = '<div class="text-gray-400 text-center">Processing...</div>';

  try {
    var response = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url })
    });

    var data = await response.json();

    if (data.success && data.data) {
      var result = data.data;
      var html = '<div class="bg-[252525] rounded-xl p-6 border border-gray-700 max-w-2xl mx-auto">';
      
      html += '<div class="flex items-center gap-4 mb-4">';
      if (result.profile_picture) {
        html += '<img src="' + result.profile_picture + '" alt="Profile" class="w-12 h-12 rounded-full object-cover border-2 border-accent" />';
      }
      if (result.username) {
        html += '<div><p class="text-accent font-bold text-lg">@' + result.username + '</p>';
        if (result.user_id) {
          html += '<p class="text-gray-500 text-xs">User ID: ' + result.user_id + '</p>';
        }
        html += '</div>';
      }
      html += '</div>';

      if (result.video_title && result.video_title !== result.username) {
        html += '<p class="text-white text-sm mb-2 font-medium">' + result.video_title + '</p>';
      }

      if (result.description) {
        html += '<p class="text-gray-300 text-sm mb-3">' + result.description + '</p>';
      }

      if (result.hashtags && result.hashtags.length > 0) {
        html += '<div class="flex flex-wrap gap-1 mb-3">';
        result.hashtags.forEach(function(tag) {
          html += '<span class="text-accent text-xs bg-[191919] px-2 py-0.5 rounded-full">' + tag + '</span>';
        });
        html += '</div>';
      }

      if (result.thumbnail) {
        html += '<div class="flex justify-center mb-4">';
        html += '<img src="' + result.thumbnail + '" alt="Thumbnail" class="rounded-lg max-h-64 w-auto object-cover border border-gray-700" />';
        html += '</div>';
      }

      if (result.views || result.likes || result.comments || result.shares) {
        html += '<div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">';
        if (result.views) {
          html += '<div class="bg-[191919] rounded-lg p-2 text-center"><p class="text-gray-400 text-xs">Views</p><p class="text-white text-sm font-semibold">' + result.views + '</p></div>';
        }
        if (result.likes) {
          html += '<div class="bg-[191919] rounded-lg p-2 text-center"><p class="text-gray-400 text-xs">Likes</p><p class="text-white text-sm font-semibold">' + result.likes + '</p></div>';
        }
        if (result.comments) {
          html += '<div class="bg-[191919] rounded-lg p-2 text-center"><p class="text-gray-400 text-xs">Comments</p><p class="text-white text-sm font-semibold">' + result.comments + '</p></div>';
        }
        if (result.shares) {
          html += '<div class="bg-[191919] rounded-lg p-2 text-center"><p class="text-gray-400 text-xs">Shares</p><p class="text-white text-sm font-semibold">' + result.shares + '</p></div>';
        }
        html += '</div>';
      }

      if (result.duration) {
        html += '<p class="text-gray-400 text-xs mb-3">⏱️ Duration: ' + result.duration + '</p>';
      }

      if (result.music_info) {
        html += '<p class="text-gray-400 text-xs mb-3">🎵 ' + result.music_info + '</p>';
      }

      html += '<div class="space-y-2">';

      if (result.type === 'photo') {
        if (result.slides && result.slides.length > 0) {
          html += '<p class="text-gray-400 text-xs mb-2">📸 Photo Slides (' + result.slides.length + ' images)</p>';
          html += '<div class="grid grid-cols-2 gap-2">';
          result.slides.forEach(function(slide) {
            var filename = 'slide_' + slide.index + '.jpg';
            html += '<button onclick="downloadFile(\'' + slide.url + '\', \'' + filename + '\')" class="bg-[191919] hover:bg-[2a2a2a] text-white px-3 py-2 rounded-lg transition border border-gray-700 text-sm flex items-center justify-center gap-2">';
            html += '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
            html += 'Image ' + slide.index;
            html += '</button>';
          });
          html += '</div>';
        }
      } else {
        if (result.downloads && result.downloads.nowm && result.downloads.nowm.length > 0) {
          result.downloads.nowm.forEach(function(link, index) {
            var filename = 'tiktok_no_watermark_' + (index + 1) + '.mp4';
            html += '<button onclick="downloadFile(\'' + link + '\', \'' + filename + '\')" class="block w-full text-center bg-accent hover:bg-accentHover text-white px-4 py-3 rounded-lg transition border border-gray-700 text-sm font-medium">';
            html += '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
            html += 'Download Video (No Watermark)';
            html += '</button>';
          });
        }
        if (result.downloads && result.downloads.wm && result.downloads.wm.length > 0) {
          result.downloads.wm.forEach(function(link, index) {
            var filename = 'tiktok_with_watermark_' + (index + 1) + '.mp4';
            html += '<button onclick="downloadFile(\'' + link + '\', \'' + filename + '\')" class="block w-full text-center bg-[191919] hover:bg-[2a2a2a] text-white px-4 py-3 rounded-lg transition border border-gray-700 text-sm">';
            html += '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
            html += 'Download Video (With Watermark)';
            html += '</button>';
          });
        }
        if (result.mp3 && result.mp3.length > 0) {
          result.mp3.forEach(function(link, index) {
            var filename = 'tiktok_audio_' + (index + 1) + '.mp3';
            html += '<button onclick="downloadFile(\'' + link + '\', \'' + filename + '\')" class="block w-full text-center bg-[191919] hover:bg-[2a2a2a] text-white px-4 py-3 rounded-lg transition border border-gray-700 text-sm">';
            html += '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
            html += 'Download Audio (MP3)';
            html += '</button>';
          });
        }
      }

      html += '</div></div>';
      container.innerHTML = html;
    } else {
      container.innerHTML = '<div class="text-red-400 text-center">' + (data.error || 'Failed to get download links. Make sure the video is public.') + '</div>';
    }
  } catch (err) {
    container.innerHTML = '<div class="text-red-400 text-center">Error: ' + err.message + '</div>';
  }
});