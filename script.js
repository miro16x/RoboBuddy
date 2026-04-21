// ── Navbar: scroll + hero-zone detection ──
const navbar = document.getElementById('navbar');
const heroEl = document.getElementById('hero');
function updateNav() {
  const inHero = window.scrollY < heroEl.offsetHeight - 80;
  navbar.classList.toggle('scrolled', window.scrollY > 20);
  navbar.classList.toggle('hero-zone', inHero && window.scrollY < 20);
}
window.addEventListener('scroll', updateNav, { passive: true });
updateNav();

// ── Mobile menu ──
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('mobileMenu').classList.toggle('open');
});
function closeMobile() { document.getElementById('mobileMenu').classList.remove('open'); }

// ── Hero mouse spotlight ──
const spotlightEl = document.getElementById('hero-spotlight');
heroEl.addEventListener('mousemove', (e) => {
  const r = heroEl.getBoundingClientRect();
  spotlightEl.style.background = `radial-gradient(600px circle at ${e.clientX - r.left}px ${e.clientY - r.top}px, rgba(124,58,237,0.18), transparent 40%)`;
  spotlightEl.style.opacity = '1';
}, { passive: true });
heroEl.addEventListener('mouseleave', () => { spotlightEl.style.opacity = '0'; });

// ── Scroll reveal ──
const revealEls = document.querySelectorAll('.reveal');
const ro = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); ro.unobserve(e.target); } });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
revealEls.forEach(el => ro.observe(el));

// ── Study Tools tab switching ──
function switchTool(name) {
  document.querySelectorAll('.tool-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tool-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`.tool-tab[onclick="switchTool('${name}')"]`).classList.add('active');
  document.getElementById('tp-' + name).classList.add('active');
}

// ── FAQ accordion ──
function toggleFaq(btn) {
  const item = btn.closest('.faq-item');
  const open = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
  if (!open) item.classList.add('open');
}

// ── Smooth anchor scroll with fixed nav offset ──
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    const t = document.querySelector(a.getAttribute('href'));
    if (t) { e.preventDefault(); window.scrollTo({ top: t.getBoundingClientRect().top + scrollY - 80, behavior: 'smooth' }); }
  });
});

// ══════════════════════════════════════════
//  RoboBuddy — Live AI Chat
// ══════════════════════════════════════════
(function () {
  const MODEL   = 'claude-haiku-4-5-20251001';
  const API_URL = 'https://api.anthropic.com/v1/messages';
  const SYSTEM  = `You are RoboBuddy, a friendly and encouraging AI study assistant.
Help students understand any subject — science, math, history, literature, coding, and more.
Keep answers clear and concise. Use **bold** for key terms. When asked to quiz, give one question at a time.
Be warm and supportive, but not over the top.`;

  let history   = [];
  let loading   = false;
  let apiKey    = localStorage.getItem('robobuddy_key') || '';

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function fmt(text) {
    return escHtml(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`\n]+)`/g, '<code style="background:#F1F5F9;padding:.1em .35em;border-radius:4px;font-size:.875em;font-family:monospace;">$1</code>')
      .replace(/\n/g, '<br>');
  }

  function updateUI() {
    const banner   = document.getElementById('api-key-banner');
    const inputRow = document.getElementById('chat-input-area');
    const changeLink = document.getElementById('change-key-link');
    if (!banner) return;
    const hasKey = !!apiKey;
    banner.style.display    = hasKey ? 'none'  : 'block';
    inputRow.style.display  = hasKey ? 'flex'  : 'none';
    if (changeLink) changeLink.style.display = hasKey ? 'inline' : 'none';
  }

  function appendMsg(role, html) {
    const log = document.getElementById('live-chat-log');
    if (!log) return null;
    const row = document.createElement('div');
    row.className = 'chat-row' + (role === 'user' ? ' user' : '');
    row.innerHTML = role === 'user'
      ? `<div class="chat-av me">You</div><div class="bubble user">${html}</div>`
      : `<div class="chat-av bot">🤖</div><div class="bubble bot">${html}</div>`;
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return row;
  }

  function welcome() {
    const log = document.getElementById('live-chat-log');
    if (log && log.children.length === 0) {
      appendMsg('bot', "Hey! I'm RoboBuddy 🤖 Your AI study buddy is live. Ask me to explain a concept, quiz you on a topic, help you understand something tricky, or plan your study session!");
    }
  }

  window.saveApiKey = function () {
    const inp = document.getElementById('api-key-input');
    const val = inp ? inp.value.trim() : '';
    if (!val) return;
    apiKey = val;
    localStorage.setItem('robobuddy_key', apiKey);
    updateUI();
    welcome();
    const msgInput = document.getElementById('user-message-input');
    if (msgInput) msgInput.focus();
  };

  window.resetApiKey = function () {
    localStorage.removeItem('robobuddy_key');
    apiKey = '';
    history = [];
    const log = document.getElementById('live-chat-log');
    if (log) log.innerHTML = '';
    updateUI();
  };

  window.sendMessage = async function () {
    if (loading || !apiKey) return;
    const inp    = document.getElementById('user-message-input');
    const btn    = document.getElementById('send-btn');
    const text   = inp ? inp.value.trim() : '';
    if (!text) return;

    inp.value = '';
    loading = true;
    if (btn) btn.disabled = true;

    appendMsg('user', escHtml(text));
    history.push({ role: 'user', content: text });

    const typingRow = appendMsg('bot', '<div class="typing-dots"><span></span><span></span><span></span></div>');
    const log = document.getElementById('live-chat-log');

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: MODEL, max_tokens: 1024, stream: true, system: SYSTEM + (window.notesText ? '\n\n--- STUDENT\'S UPLOADED NOTES (use as primary reference for answers) ---\n' + window.notesText.slice(0, 8000) + '\n---' : ''), messages: history })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }

      const bubble = typingRow ? typingRow.querySelector('.bubble') : null;
      if (bubble) bubble.innerHTML = '';

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      let buf  = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const p = JSON.parse(data);
            if (p.type === 'content_block_delta' && p.delta?.type === 'text_delta') {
              full += p.delta.text;
              if (bubble) { bubble.innerHTML = fmt(full); log.scrollTop = log.scrollHeight; }
            }
          } catch (_) {}
        }
      }
      history.push({ role: 'assistant', content: full });

    } catch (err) {
      const bubble = typingRow ? typingRow.querySelector('.bubble') : null;
      if (bubble) bubble.innerHTML = `<span style="color:#DC2626;">⚠️ ${escHtml(err.message || 'Connection error — check your API key.')}</span>`;
    } finally {
      loading = false;
      if (btn) btn.disabled = false;
      if (inp) inp.focus();
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    updateUI();
    if (apiKey) welcome();
  });
})();

// ══════════════════════════════════════════
//  RoboBuddy — File upload + Tools
// ══════════════════════════════════════════
(function () {

  window.notesText     = '';
  window.notesFileName = '';

  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  function setUploadState(s) {
    document.getElementById('upload-idle').style.display    = s === 'idle'    ? 'flex' : 'none';
    document.getElementById('upload-loading').style.display = s === 'loading' ? 'flex' : 'none';
    document.getElementById('upload-done').style.display    = s === 'done'    ? 'flex' : 'none';
  }

  window.handleFileSelect = function (e) {
    const f = e.target.files[0];
    if (f) processFile(f);
    e.target.value = '';
  };

  window.handleFileDrop = function (e) {
    e.preventDefault();
    document.getElementById('upload-zone').classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  };

  window.clearUpload = function () {
    window.notesText = window.notesFileName = '';
    setUploadState('idle');
    updateHint();
  };

  async function processFile(file) {
    setUploadState('loading');
    try {
      const text = await extractText(file);
      window.notesText     = text;
      window.notesFileName = file.name;
      document.getElementById('upload-filename').textContent = file.name;
      document.getElementById('upload-chars').textContent    =
        text.length.toLocaleString() + ' characters extracted';
      setUploadState('done');
      updateHint();
    } catch (err) {
      setUploadState('idle');
      alert('Could not read file: ' + (err.message || err));
    }
  }

  function updateHint() {
    const el = document.getElementById('fc-hint');
    if (el) el.textContent = window.notesText
      ? '✓ Using: ' + window.notesFileName
      : 'No file — topic input will be used';
  }

  async function extractText(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'pdf')  return extractPdf(file);
    if (ext === 'docx') return extractDocx(file);
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = e => res(e.target.result);
      r.onerror = rej;
      r.readAsText(file);
    });
  }

  async function extractPdf(file) {
    if (typeof pdfjsLib === 'undefined') throw new Error('PDF.js not loaded');
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    let out = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const c = await page.getTextContent();
      out += c.items.map(x => x.str).join(' ') + '\n';
    }
    return out.trim();
  }

  async function extractDocx(file) {
    if (typeof mammoth === 'undefined') throw new Error('mammoth.js not loaded');
    const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return r.value.trim();
  }

  async function stream({ system, messages, maxTokens = 2048, onChunk, onDone, onError }) {
    const key = localStorage.getItem('robobuddy_key') || '';
    if (!key) { onError('No API key — connect it in the Chat tab first.'); return; }
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: maxTokens, stream: true, system, messages
        })
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error?.message || 'HTTP ' + res.status);
      }
      const reader = res.body.getReader(), dec = new TextDecoder();
      let full = '', buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop();
        for (const ln of lines) {
          if (!ln.startsWith('data: ')) continue;
          const d = ln.slice(6).trim();
          if (d === '[DONE]') continue;
          try {
            const p = JSON.parse(d);
            if (p.type === 'content_block_delta' && p.delta?.type === 'text_delta') {
              full += p.delta.text;
              if (onChunk) onChunk(full);
            }
          } catch (_) {}
        }
      }
      if (onDone) onDone(full);
    } catch (err) { if (onError) onError(err.message || 'Connection error'); }
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Flashcard generator ──
  window.generateFlashcards = async function () {
    const btn    = document.getElementById('fc-btn');
    const output = document.getElementById('fc-output');
    const topic  = (document.getElementById('fc-topic').value || '').trim();
    if (!window.notesText && !topic) {
      output.innerHTML = '<p style="color:#DC2626;font-size:.875rem;">Upload a file or enter a topic first.</p>';
      return;
    }
    btn.disabled = true;
    output.innerHTML = '<div class="panel-loading"><div class="loader-ring" style="width:22px;height:22px;border-width:2px;"></div> Generating flashcards…</div>';

    const source = window.notesText
      ? 'Based on these notes:\n\n' + window.notesText.slice(0, 8000)
      : 'Based on the topic: ' + topic;

    await stream({
      system: 'You are a flashcard generator. Respond ONLY with a valid JSON array — no markdown, no prose. Format: [{"q":"...","a":"..."}]',
      messages: [{ role: 'user', content: 'Generate exactly 8 flashcard Q&A pairs. ' + source + '. Make questions specific, answers 1-2 sentences. Return only the JSON array.' }],
      onDone: (t) => {
        btn.disabled = false;
        try {
          const m = t.match(/\[[\s\S]*\]/);
          renderCards(JSON.parse(m ? m[0] : t), output);
        } catch (_) {
          output.innerHTML = '<p style="color:#DC2626;font-size:.875rem;">Couldn\'t parse response — try again.</p>';
        }
      },
      onError: (msg) => { btn.disabled = false; output.innerHTML = `<p style="color:#DC2626;font-size:.875rem;">⚠️ ${esc(msg)}</p>`; }
    });
  };

  function renderCards(cards, container) {
    if (!Array.isArray(cards) || !cards.length) {
      container.innerHTML = '<p style="color:#DC2626;font-size:.875rem;">No cards returned — try again.</p>';
      return;
    }
    container.innerHTML = `<p class="fc-hint">👇 Tap a card to flip (${cards.length} cards generated)</p><div class="fc-grid"></div>`;
    const grid = container.querySelector('.fc-grid');
    cards.forEach(c => {
      const d = document.createElement('div');
      d.className = 'fc';
      d.onclick = () => d.classList.toggle('flipped');
      d.innerHTML = `<span class="fc-q">${esc(c.q||'')}</span><span class="fc-a">${esc(c.a||'')}</span>`;
      grid.appendChild(d);
    });
  }

  // ── Study planner ──
  window.generatePlan = async function () {
    const btn     = document.getElementById('pl-btn');
    const output  = document.getElementById('pl-output');
    const subject = (document.getElementById('pl-subject').value || '').trim();
    const date    = document.getElementById('pl-date').value;
    const hours   = document.getElementById('pl-hours').value || '2';
    if (!subject || !date) {
      output.innerHTML = '<p style="color:#DC2626;font-size:.875rem;">Enter subject and exam date.</p>';
      return;
    }
    btn.disabled = true;
    output.innerHTML = '<div class="panel-loading"><div class="loader-ring" style="width:22px;height:22px;border-width:2px;"></div> Building your plan…</div>';

    const today   = new Date().toISOString().split('T')[0];
    const notes   = window.notesText ? '\n\nNotes context:\n' + window.notesText.slice(0, 4000) : '';

    await stream({
      system: 'You are a study planner. Output ONLY a JSON array of tasks — no prose, no markdown wrapper. Format: [{"date":"Apr 18","badge":"Today|Tomorrow|This Week|Upcoming","task":"..."}]',
      messages: [{ role: 'user', content: `Subject: ${subject}\nExam: ${date}\nToday: ${today}\nHours/day: ${hours}${notes}\n\nGenerate a day-by-day study plan from today to the exam. 2-3 tasks per day. Cover review, practice, and revision. Return only the JSON array.` }],
      maxTokens: 1500,
      onDone: (t) => {
        btn.disabled = false;
        try {
          const m = t.match(/\[[\s\S]*\]/);
          const tasks = JSON.parse(m ? m[0] : t);
          renderPlan(tasks, output);
        } catch (_) {
          output.innerHTML = `<div class="summary-block"><p style="font-size:.9rem;line-height:1.75;color:var(--text);">${esc(t).replace(/\n/g,'<br>')}</p></div>`;
        }
      },
      onError: (msg) => { btn.disabled = false; output.innerHTML = `<p style="color:#DC2626;font-size:.875rem;">⚠️ ${esc(msg)}</p>`; }
    });
  };

  function renderPlan(tasks, container) {
    const badgeMap = { 'Today':'b-now','Tomorrow':'b-tmrw','This Week':'b-soon','Upcoming':'b-soon' };
    container.innerHTML = '<div class="planner">' +
      tasks.map(t => `<div class="plan-row">
        <span class="plan-badge ${badgeMap[t.badge]||'b-soon'}">${esc(t.badge||'Upcoming')}</span>
        <span class="plan-task">${esc(t.task||'')}</span>
        <span class="plan-date">${esc(t.date||'')}</span>
      </div>`).join('') + '</div>';
  }

  // ── Summarizer ──
  window.generateSummary = async function () {
    const btn    = document.getElementById('sum-btn');
    const output = document.getElementById('sum-output');
    const paste  = (document.getElementById('sum-paste').value || '').trim();
    const content = window.notesText || paste;
    if (!content) {
      output.innerHTML = '<p style="color:#DC2626;font-size:.875rem;">Upload a file or paste text first.</p>';
      return;
    }
    btn.disabled = true;
    output.innerHTML = '<div class="panel-loading"><div class="loader-ring" style="width:22px;height:22px;border-width:2px;"></div> Summarizing…</div>';

    let el = null;
    await stream({
      system: 'You are a study assistant. Create structured summaries for students. Use **bold** for key terms. Structure: start with "## Key Topics" (comma-separated terms), then "## Core Concepts" (5-7 bullet points starting with -). Be concise.',
      messages: [{ role: 'user', content: 'Summarize this content for exam prep:\n\n' + content.slice(0, 10000) }],
      maxTokens: 1500,
      onChunk: (t) => {
        if (!el) {
          output.innerHTML = '<div class="summary-block" id="sum-stream"></div>';
          el = output.querySelector('#sum-stream');
        }
        if (el) el.innerHTML = fmtSummary(t);
      },
      onDone: () => { btn.disabled = false; },
      onError: (msg) => { btn.disabled = false; output.innerHTML = `<p style="color:#DC2626;font-size:.875rem;">⚠️ ${esc(msg)}</p>`; }
    });
  };

  function fmtSummary(text) {
    return esc(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^##\s+(.+)$/gm, '<h4 style="font-family:Nunito,sans-serif;font-weight:800;font-size:1rem;color:var(--text);margin:1rem 0 .5rem;">$1</h4>')
      .replace(/^-\s+(.+)$/gm, '<li style="display:flex;gap:.5rem;margin:.3rem 0 .3rem;font-size:.9375rem;"><span style="color:var(--primary);font-weight:700;flex-shrink:0;">→</span><span>$1</span></li>')
      .replace(/\n/g, '');
  }

  document.addEventListener('DOMContentLoaded', updateHint);
})();
