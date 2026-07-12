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

function renderResult(data) {
    var html = '<div class="result-card">';

    if (data.username) {
        html += '<div class="user">@' + data.username + '</div>';
    }

    if (data.description) {
        html += '<div class="desc">' + data.description.substring(0, 150) + (data.description.length > 150 ? '...' : '') + '</div>';
    }

    if (data.thumbnail) {
        html += '<img src="' + data.thumbnail + '" alt="Thumbnail" class="thumb" />';
    }

    var stats = [];
    if (data.views) stats.push('Views ' + data.views);
    if (data.likes) stats.push('Likes ' + data.likes);
    if (data.comments) stats.push('Comments ' + data.comments);
    if (data.shares) stats.push('Shares ' + data.shares);

    if (stats.length) {
        html += '<div class="stats-grid">';
        stats.forEach(function(s) {
            html += '<span>' + s + '</span>';
        });
        html += '</div>';
    }

    html += '<div class="btn-group">';

    if (data.type === 'photo') {
        if (data.slides && data.slides.length > 0) {
            html += '<div class="slide-label">Photo Slides (' + data.slides.length + ' images)</div>';
            data.slides.forEach(function(slide) {
                var filename = 'slide_' + slide.index + '.jpg';
                html += '<button onclick="downloadFile(\'' + slide.url + '\', \'' + filename + '\')" class="btn">Download Image ' + slide.index + '</button>';
            });
        }
    } else {
        if (data.downloads && data.downloads.nowm && data.downloads.nowm.length > 0) {
            data.downloads.nowm.forEach(function(link, index) {
                var filename = 'tiktok_nowm_' + (index + 1) + '.mp4';
                html += '<button onclick="downloadFile(\'' + link + '\', \'' + filename + '\')" class="btn btn-primary">Download No Watermark</button>';
            });
        }
        if (data.downloads && data.downloads.wm && data.downloads.wm.length > 0) {
            data.downloads.wm.forEach(function(link, index) {
                var filename = 'tiktok_wm_' + (index + 1) + '.mp4';
                html += '<button onclick="downloadFile(\'' + link + '\', \'' + filename + '\')" class="btn">Download With Watermark</button>';
            });
        }
        if (data.mp3 && data.mp3.length > 0) {
            data.mp3.forEach(function(link, index) {
                var filename = 'tiktok_audio_' + (index + 1) + '.mp3';
                html += '<button onclick="downloadFile(\'' + link + '\', \'' + filename + '\')" class="btn">Download Audio MP3</button>';
            });
        }
    }

    html += '</div></div>';
    return html;
}

document.getElementById('downloadForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    var url = document.getElementById('tiktokUrl').value.trim();
    var container = document.getElementById('resultContainer');

    if (!url) {
        container.innerHTML = '<div class="text-red-400">Please paste a TikTok link</div>';
        return;
    }

    container.innerHTML = '<div class="text-gray-400">Processing...</div>';

    try {
        var response = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url })
        });

        var data = await response.json();

        if (data.success && data.data) {
            container.innerHTML = renderResult(data.data);
        } else {
            container.innerHTML = '<div class="text-red-400">' + (data.error || 'Failed to get download links. Make sure the video is public.') + '</div>';
        }
    } catch (err) {
        container.innerHTML = '<div class="text-red-400">Error: ' + err.message + '</div>';
    }
});
