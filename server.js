// ytbaixar — servidor local que baixa vídeos do YouTube e YouTube Music em MP4 usando yt-dlp + ffmpeg.
// Sem dependências: só Node. A interface (web/) é compilada pra web/dist e servida daqui.
//
//   node server.js          → http://localhost:8787 (só este PC)
//   node server.js --app    → abre numa janela de app (Edge/Chrome) e desliga sozinho quando a janela fecha
//
// Acesso pelo celular: ligado nos Ajustes do app. Abre uma segunda porta (8788) na rede Wi-Fi
// que só aceita quem tem a chave secreta (vem no link/QR code).

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

const PORT = Number(process.env.PORT) || 8787;
const LAN_PORT = PORT + 1;
const APP_MODE = process.argv.includes('--app');
const ROOT = __dirname;
const DIST = path.join(ROOT, 'web', 'dist');
const BIN_DIR = path.join(ROOT, 'bin');
const DATA_DIR = path.join(ROOT, 'data');
const CONFIG = path.join(DATA_DIR, 'config.json');
const YTDLP_LOCAL = path.join(BIN_DIR, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
const TMP = path.join(os.tmpdir(), 'ytbaixar');
const YTDLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/'
  + (process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
const FFMPEG_LOCAL = path.join(BIN_DIR, 'ffmpeg.exe');
// Sem ffmpeg no PC (instalação nova): baixa um ffmpeg pronto na primeira vez. O "essentials" é o menor.
const FFMPEG_URLS = [
  'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip',
  'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
];

const ALLOWED_HOSTS = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com',
  'tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com',
]);
// Capas passam pelo servidor pra página conseguir ler as cores (canvas sem CORS)
const THUMB_HOSTS = /^(i\d*\.ytimg\.com|lh\d\.googleusercontent\.com|yt\d\.ggpht\.com|[\w-]+\.tiktokcdn(-[a-z]+)?\.com)$/;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.woff': 'font/woff',
};

const jobs = new Map(); // id -> { status, percent, speed, eta, size, file, name, error, listeners, created, proc }

fs.mkdirSync(TMP, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

/* ---------- Configuração (acesso pela rede + chave) ---------- */
function loadConfig() {
  let c = {};
  try { c = JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch {}
  if (!c.token) c.token = crypto.randomBytes(12).toString('base64url');
  return { lan: !!c.lan, token: c.token };
}
const config = loadConfig();
const saveConfig = () => fs.writeFileSync(CONFIG, JSON.stringify(config, null, 2));
saveConfig();

function ytdlpPath() {
  return fs.existsSync(YTDLP_LOCAL) ? YTDLP_LOCAL : 'yt-dlp';
}

async function ensureYtdlp() {
  if (fs.existsSync(YTDLP_LOCAL)) return;
  console.log('Baixando yt-dlp de', YTDLP_URL, '...');
  fs.mkdirSync(BIN_DIR, { recursive: true });
  const res = await fetch(YTDLP_URL);
  if (!res.ok) throw new Error('Falha ao baixar yt-dlp: HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(YTDLP_LOCAL, buf, { mode: 0o755 });
  console.log('yt-dlp salvo em', YTDLP_LOCAL);
}

/* ---------- ffmpeg (junta vídeo + áudio) ---------- */
const ffmpeg = { state: 'checando', pct: 0, error: null };
let ffmpegReady = null;

function ffmpegInPath() {
  try { return spawnSync('ffmpeg', ['-version'], { windowsHide: true, timeout: 10000 }).status === 0; } catch { return false; }
}

async function downloadTo(url, file, onPct) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const total = +res.headers.get('content-length') || 0;
  const out = fs.createWriteStream(file);
  let got = 0;
  for await (const chunk of res.body) {
    got += chunk.length;
    if (total) onPct(Math.floor((got / total) * 100));
    if (!out.write(chunk)) await new Promise(r => out.once('drain', r));
  }
  await new Promise((r, j) => out.end(e => (e ? j(e) : r())));
}

function ensureFfmpeg() {
  if (ffmpegReady) return ffmpegReady;
  ffmpegReady = (async () => {
    if (fs.existsSync(FFMPEG_LOCAL) || ffmpegInPath()) { ffmpeg.state = 'ok'; return; }
    if (process.platform !== 'win32') { ffmpeg.state = 'erro'; ffmpeg.error = 'Instale o ffmpeg'; return; }
    ffmpeg.state = 'baixando';
    fs.mkdirSync(BIN_DIR, { recursive: true });
    const zip = path.join(TMP, 'ffmpeg.zip');
    // tar.exe do próprio Windows abre .zip (o do Git Bash não, por isso o caminho completo)
    const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
    for (const url of FFMPEG_URLS) {
      try {
        console.log('Baixando ffmpeg de', url);
        await downloadTo(url, zip, p => { ffmpeg.pct = p; });
        const r = spawnSync(tar, ['-xf', zip, '-C', BIN_DIR, '--strip-components', '2', '*/bin/ffmpeg.exe', '*/bin/ffprobe.exe'], { windowsHide: true });
        if (!fs.existsSync(FFMPEG_LOCAL)) throw new Error('não achei o ffmpeg.exe no zip ' + (r.stderr || ''));
        ffmpeg.state = 'ok'; ffmpeg.pct = 100; ffmpeg.error = null;
        console.log('ffmpeg pronto em', FFMPEG_LOCAL);
        return;
      } catch (e) {
        console.warn('Falhou:', e.message);
        ffmpeg.error = e.message;
      } finally {
        fs.rm(zip, { force: true }, () => {});
      }
    }
    ffmpeg.state = 'erro';
    ffmpegReady = null; // deixa tentar de novo no próximo download
  })();
  return ffmpegReady;
}

function checkUrl(raw) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch { return null; }
  if (!/^https?:$/.test(u.protocol) || !ALLOWED_HOSTS.has(u.hostname.toLowerCase())) return null;
  return u;
}

function sourceOf(u) {
  const h = u.hostname.toLowerCase();
  if (h.endsWith('tiktok.com')) return 'tiktok';
  return h === 'music.youtube.com' ? 'music' : 'youtube';
}

function run(args, onLine, onSpawn) {
  return new Promise((resolve, reject) => {
    const p = spawn(ytdlpPath(), args, { windowsHide: true });
    if (onSpawn) onSpawn(p);
    let out = '', err = '';
    p.stdout.setEncoding('utf8');
    p.stderr.setEncoding('utf8');
    // Com --print o yt-dlp fica em modo quieto e manda o progresso pro stderr, então lê os dois
    const splitter = () => {
      let pending = '';
      return d => {
        if (!onLine) return;
        pending += d;
        const lines = pending.split(/\r?\n/);
        pending = lines.pop();
        lines.forEach(onLine);
      };
    };
    const outLines = splitter(), errLines = splitter();
    p.stdout.on('data', d => { out += d; outLines(d); });
    p.stderr.on('data', d => { err += d; errLines(d); });
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve(out) : reject(new Error(lastError(err) || 'yt-dlp saiu com código ' + code)));
  });
}

function lastError(stderr) {
  const lines = stderr.split(/\r?\n/).filter(l => /ERROR/.test(l));
  return (lines.pop() || stderr.trim().split(/\r?\n/).pop() || '').replace(/^ERROR:\s*/, '');
}

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 1e5) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

const hasVideo = f => f.vcodec && f.vcodec !== 'none' && f.height;
const isH264 = f => /^(avc1|h264)/.test(f.vcodec || '');
// "Resolução" = o lado menor, igual ao campo res do yt-dlp: 1080p deitado e 1080p em pé (TikTok) contam igual
const resOf = f => Math.min(f.width || f.height, f.height);

// Tamanho aproximado do MP4 final pra cada resolução (melhor vídeo naquela resolução + melhor áudio m4a)
function sizesByRes(formats) {
  const size = f => f.filesize || f.filesize_approx || 0;
  const audio = formats.filter(f => f.vcodec === 'none' && f.acodec && f.acodec !== 'none');
  const bestAudio = audio.filter(f => f.ext === 'm4a').sort((a, b) => size(b) - size(a))[0] || audio[0];
  const audioSize = bestAudio ? size(bestAudio) : 0;
  const out = {};
  for (const f of formats) {
    if (!hasVideo(f) || !size(f)) continue;
    const r = resOf(f), avc = isH264(f), cur = out[r];
    // Mesma preferência do download: H.264 primeiro
    const hasAudio = f.acodec && f.acodec !== 'none';
    if (!cur || (avc && !cur.avc) || (avc === cur.avc && size(f) > cur.v)) out[r] = { v: size(f), avc, hasAudio };
  }
  const result = { audio: audioSize || null };
  // No TikTok o vídeo já vem com o áudio junto: não soma de novo
  for (const r in out) result[r] = out[r].v + (out[r].hasAudio ? 0 : audioSize);
  return result;
}

// TikTok: o título é a legenda inteira; tira as hashtags e o "..." do corte
function tiktokTitle(info) {
  const t = String(info.description || info.title || '').replace(/#[^\s#]+/g, '').replace(/\s*\.\.\.$/, '').replace(/\s+/g, ' ').trim();
  return t || `Vídeo de @${info.uploader || 'tiktok'}`;
}

async function handleInfo(req, res) {
  const { url } = await readBody(req);
  const u = checkUrl(url);
  if (!u) return json(res, 400, { error: 'Cole um link do YouTube, YouTube Music ou TikTok.' });
  try {
    const out = await run(['-J', '--no-playlist', '--no-warnings', u.href]);
    const info = JSON.parse(out);
    const source = sourceOf(u);
    const formats = info.formats || [];
    // TikTok: só oferece as resoluções em H.264 (o 720p costuma vir só em H.265, que muito player não abre)
    const video = formats.filter(hasVideo);
    const offered = source === 'tiktok' && video.some(isH264) ? video.filter(isH264) : video;
    const heights = [...new Set(offered.map(resOf))].sort((a, b) => b - a);
    json(res, 200, {
      id: info.id,
      url: u.href,
      webpage: info.webpage_url || u.href,
      source,
      title: source === 'tiktok' ? tiktokTitle(info) : (source === 'music' && info.track) || info.title,
      artist: source === 'tiktok'
        ? '@' + (info.uploader || info.channel || '')
        : info.artist || info.uploader || info.channel || '',
      vertical: video.some(f => f.width && f.height > f.width),
      channelUrl: info.channel_url || info.uploader_url || '',
      thumbnail: info.thumbnail,
      duration: info.duration || 0,
      views: info.view_count ?? null,
      likes: info.like_count ?? null,
      uploaded: info.upload_date || null,
      album: info.album || null,
      heights,
      sizes: sizesByRes(formats),
    });
  } catch (e) {
    json(res, 500, { error: e.message });
  }
}

function formatArgs(quality, source) {
  if (quality === 'audio') {
    // "/b": no TikTok não tem áudio separado bom, então extrai do vídeo
    return ['-f', 'ba[ext=m4a]/ba/b', '-x', '--audio-format', 'm4a'];
  }
  const h = parseInt(quality, 10);
  const res = h > 0 ? `res:${h}` : 'res';
  // Prefere H.264 + AAC (toca em qualquer lugar); cai pra VP9/AV1 só se for a única opção na resolução.
  // No TikTok o codec vem antes da resolução: melhor 540p que abre em tudo do que 720p em H.265.
  const sort = source === 'tiktok' ? `vcodec:avc1,${res},acodec:m4a` : `${res},vcodec:avc1,acodec:m4a`;
  return ['-S', sort, '-f', 'bv*+ba/b', '--merge-output-format', 'mp4', '--remux-video', 'mp4'];
}

function emit(job) {
  const data = `data: ${JSON.stringify(publicJob(job))}\n\n`;
  for (const r of job.listeners) r.write(data);
}

function publicJob(j) {
  return { status: j.status, percent: j.percent, speed: j.speed, eta: j.eta, size: j.size, part: j.part, name: j.name, error: j.error };
}

const na = s => { s = (s || '').trim(); return !s || s === 'NA' || /^Unknown/.test(s) ? '' : s; };

async function handleStart(req, res) {
  const { url, quality } = await readBody(req);
  const u = checkUrl(url);
  if (!u) return json(res, 400, { error: 'Link inválido.' });
  const id = crypto.randomBytes(8).toString('hex');
  const dir = path.join(TMP, id);
  fs.mkdirSync(dir, { recursive: true });
  const job = { status: 'iniciando', percent: 0, speed: '', eta: '', size: '', part: 0, listeners: new Set(), created: Date.now(), dir };
  jobs.set(id, job);
  json(res, 200, { id });

  // Primeira vez numa instalação nova: espera o ffmpeg terminar de baixar
  await ensureFfmpeg();
  if (job.status === 'cancelado') return;
  if (ffmpeg.state !== 'ok') {
    job.status = 'erro';
    job.error = 'Não consegui baixar o ffmpeg (' + (ffmpeg.error || 'sem internet?') + '). Tente de novo.';
    emit(job);
    for (const r of job.listeners) r.end();
    return;
  }
  job.status = 'baixando';
  emit(job);

  const args = [
    ...(fs.existsSync(FFMPEG_LOCAL) ? ['--ffmpeg-location', BIN_DIR] : []),
    '--no-playlist', '--no-warnings', '--newline', '--progress', '--no-part', '--restrict-filenames',
    '--progress-template',
    'download:PROG|%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(progress._total_bytes_str)s|%(progress._total_bytes_estimate_str)s',
    '--print', 'after_move:FILE|%(filepath)s',
    '-o', path.join(dir, '%(title).150B.%(ext)s'),
    // TikTok: o título é a legenda; tira hashtags e o "..." pra o nome do arquivo ficar limpo
    ...(sourceOf(u) === 'tiktok'
      ? ['--replace-in-metadata', 'title', '\\s*#\\S+', '', '--replace-in-metadata', 'title', '\\s*\\.{3}$', '']
      : []),
    ...formatArgs(quality, sourceOf(u)),
    u.href,
  ];
  // Vídeo e áudio vêm em downloads separados (part 1 e 2); quando um chega a 100% mostra "finalizando"
  // até o próximo começar (ou até o ffmpeg terminar de juntar).
  let lastPct = 0;
  const onLine = line => {
    if (line.startsWith('PROG|')) {
      const [, pct, speed, eta, total, estimate] = line.split('|');
      const p = parseFloat(pct) || 0;
      if (p + 30 < lastPct || job.part === 0) job.part++;
      lastPct = p;
      job.status = p >= 100 ? 'convertendo' : 'baixando';
      job.percent = p;
      job.speed = na(speed);
      job.eta = na(eta);
      job.size = na(total) || na(estimate);
      emit(job);
    } else if (line.startsWith('FILE|')) {
      job.file = line.slice(5).trim();
    }
  };
  try {
    await run(args, onLine, p => { job.proc = p; });
    if (job.status === 'cancelado') return;
    if (!job.file || !fs.existsSync(job.file)) {
      const f = fs.readdirSync(dir).map(n => path.join(dir, n)).sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
      job.file = f;
    }
    if (!job.file) throw new Error('Arquivo final não encontrado.');
    job.name = path.basename(job.file);
    job.bytes = fs.statSync(job.file).size;
    job.status = 'pronto';
    job.percent = 100;
  } catch (e) {
    if (job.status === 'cancelado') return;
    job.status = 'erro';
    job.error = e.message;
  }
  job.proc = null;
  emit(job);
  for (const r of job.listeners) r.end();
}

function handleCancel(id, res) {
  const job = jobs.get(id);
  if (!job) return json(res, 404, { error: 'Tarefa não encontrada.' });
  if (!['pronto', 'erro', 'cancelado'].includes(job.status)) {
    job.status = 'cancelado';
    // No Windows o yt-dlp abre o ffmpeg como filho; taskkill /T derruba a árvore toda
    if (job.proc && process.platform === 'win32') spawn('taskkill', ['/pid', String(job.proc.pid), '/T', '/F'], { windowsHide: true });
    else if (job.proc) job.proc.kill('SIGKILL');
    emit(job);
    for (const r of job.listeners) r.end();
  }
  // Espera o processo soltar os arquivos antes de apagar
  setTimeout(() => cleanup(id), 1500);
  json(res, 200, { ok: true });
}

function handleProgress(id, res) {
  const job = jobs.get(id);
  if (!job) return json(res, 404, { error: 'Tarefa não encontrada.' });
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.write(`data: ${JSON.stringify(publicJob(job))}\n\n`);
  if (['pronto', 'erro', 'cancelado'].includes(job.status)) return res.end();
  job.listeners.add(res);
  res.on('close', () => job.listeners.delete(res));
}

function handleFile(id, res) {
  const job = jobs.get(id);
  if (!job || job.status !== 'pronto') return json(res, 404, { error: 'Arquivo não disponível.' });
  const stat = fs.statSync(job.file);
  const ascii = job.name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  res.writeHead(200, {
    'Content-Type': job.name.endsWith('.m4a') ? 'audio/mp4' : 'video/mp4',
    'Content-Length': stat.size,
    'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(job.name)}`,
  });
  const s = fs.createReadStream(job.file);
  s.pipe(res);
  s.on('close', () => cleanup(id));
}

async function handleThumb(raw, res) {
  let u;
  try { u = new URL(raw); } catch { return json(res, 400, { error: 'URL inválida' }); }
  if (u.protocol !== 'https:' || !THUMB_HOSTS.test(u.hostname)) return json(res, 400, { error: 'Host não permitido' });
  const r = await fetch(u);
  if (!r.ok) return json(res, 502, { error: 'Capa indisponível' });
  res.writeHead(200, { 'Content-Type': r.headers.get('content-type') || 'image/jpeg', 'Cache-Control': 'max-age=86400' });
  res.end(Buffer.from(await r.arrayBuffer()));
}

function cleanup(id) {
  const job = jobs.get(id);
  if (!job) return;
  jobs.delete(id);
  fs.rm(job.dir, { recursive: true, force: true }, () => {});
}

// Apaga tarefas esquecidas depois de 1 hora
setInterval(() => {
  for (const [id, j] of jobs) if (Date.now() - j.created > 3600e3) cleanup(id);
}, 600e3).unref();

/* ---------- Rede local (celular) ---------- */
let lanServer = null;

function lanAddresses() {
  const ips = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) ips.push(a.address);
  }
  // Redes de casa (192.168.x / 10.x) primeiro; adaptadores virtuais costumam ser 172.x
  const rank = ip => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : 2);
  return ips.sort((a, b) => rank(a) - rank(b));
}

function netInfo(req) {
  return {
    local: isLocal(req),
    lan: {
      enabled: !!lanServer,
      urls: lanServer ? lanAddresses().map(ip => `http://${ip}:${LAN_PORT}/?k=${config.token}`) : [],
    },
  };
}

function startLan() {
  return new Promise((resolve, reject) => {
    if (lanServer) return resolve();
    const s = http.createServer(handler);
    s.once('error', reject);
    s.listen(LAN_PORT, '0.0.0.0', () => { lanServer = s; console.log(`Acesso pela rede: porta ${LAN_PORT}`); resolve(); });
  });
}

function stopLan() {
  if (!lanServer) return;
  lanServer.close();
  lanServer.closeAllConnections?.();
  lanServer = null;
}

async function handleLan(req, res) {
  if (!isLocal(req)) return json(res, 403, { error: 'Só dá pra mudar isso no próprio PC.' });
  const { enabled } = await readBody(req);
  try {
    if (enabled) await startLan(); else stopLan();
    config.lan = !!enabled;
    saveConfig();
    json(res, 200, netInfo(req));
  } catch (e) {
    json(res, 500, { error: 'Não consegui abrir a porta ' + LAN_PORT + ': ' + e.message });
  }
}

const isLocal = req => {
  const a = req.socket.remoteAddress || '';
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
};

function cookieToken(req) {
  const m = /(?:^|;\s*)ytb=([^;]+)/.exec(req.headers.cookie || '');
  return m ? m[1] : '';
}

// Quem vem pela rede precisa da chave: chega pelo link (?k=...) e fica guardada num cookie
function checkAccess(req, res, url) {
  if (isLocal(req)) return true;
  const k = url.searchParams.get('k');
  const ok = (t) => t && t.length === config.token.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(config.token));
  if (ok(k)) {
    url.searchParams.delete('k');
    res.writeHead(302, {
      'Set-Cookie': `ytb=${config.token}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Strict`,
      Location: url.pathname + (url.search || ''),
    });
    res.end();
    return false;
  }
  if (ok(cookieToken(req))) return true;
  res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<meta name=viewport content="width=device-width"><body style="font:16px system-ui;background:#0d0e11;color:#eee;padding:24px">' +
    '<h2>ytbaixar</h2><p>Abra pelo QR code que aparece em <b>Ajustes → Usar no celular</b>, no PC.</p>');
  return false;
}

/* ---------- App de PC: janela própria + desliga sozinho ---------- */
let lastPing = Date.now();

function openAppWindow(url) {
  const pf = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(Boolean);
  const candidates = [
    ...pf.map(p => path.join(p, 'Microsoft', 'Edge', 'Application', 'msedge.exe')),
    ...pf.map(p => path.join(p, 'Google', 'Chrome', 'Application', 'chrome.exe')),
  ];
  const exe = candidates.find(f => fs.existsSync(f));
  if (exe) spawn(exe, [`--app=${url}`, '--window-size=1280,820'], { detached: true, stdio: 'ignore' }).unref();
  else spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}

if (APP_MODE) {
  // Sem nenhuma janela avisando há 75 s e nada baixando → encerra (economiza memória)
  setInterval(() => {
    const busy = [...jobs.values()].some(j => j.proc);
    if (!busy && Date.now() - lastPing > 75e3) { console.log('Janela fechada, encerrando.'); process.exit(0); }
  }, 15e3).unref();
}

/* ---------- Arquivos da interface ---------- */
function serveStatic(pathname, res) {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('A interface ainda não foi compilada. Rode: pnpm build');
  }
  const rel = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html';
  let file = path.join(DIST, rel);
  if (!file.startsWith(DIST + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    // Rotas da interface caem no index.html; arquivos que não existem dão 404
    if (path.extname(rel)) return json(res, 404, { error: 'Não encontrado' });
    file = path.join(DIST, 'index.html');
  }
  const ext = path.extname(file);
  const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
  // Arquivos com hash no nome podem ficar em cache pra sempre; o resto sempre revalida
  headers['Cache-Control'] = rel.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
  if (rel === 'sw.js') headers['Service-Worker-Allowed'] = '/';
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
}

async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  const { pathname } = url;
  try {
    if (!checkAccess(req, res, url)) return;
    if (req.method === 'POST' && pathname === '/api/info') return await handleInfo(req, res);
    if (req.method === 'POST' && pathname === '/api/start') return await handleStart(req, res);
    if (req.method === 'POST' && pathname === '/api/ping') { lastPing = Date.now(); return json(res, 200, { ok: true }); }
    if (req.method === 'POST' && pathname === '/api/lan') return await handleLan(req, res);
    if (pathname === '/api/net') return json(res, 200, netInfo(req));
    if (pathname === '/api/status') return json(res, 200, { ffmpeg });
    if (pathname === '/api/thumb') return await handleThumb(url.searchParams.get('u'), res);
    let m;
    if ((m = pathname.match(/^\/api\/progress\/([a-f0-9]{16})$/))) return handleProgress(m[1], res);
    if ((m = pathname.match(/^\/api\/file\/([a-f0-9]{16})$/))) return handleFile(m[1], res);
    if (req.method === 'POST' && (m = pathname.match(/^\/api\/cancel\/([a-f0-9]{16})$/))) return handleCancel(m[1], res);
    if (req.method === 'GET' && !pathname.startsWith('/api/')) return serveStatic(pathname, res);
    json(res, 404, { error: 'Não encontrado' });
  } catch (e) {
    if (!res.headersSent) json(res, 500, { error: e.message });
  }
}

const server = http.createServer(handler);
const localUrl = `http://localhost:${PORT}`;

server.on('error', e => {
  // Já tem um ytbaixar rodando: no modo app só abre outra janela dele
  if (e.code === 'EADDRINUSE' && APP_MODE) { openAppWindow(localUrl); setTimeout(() => process.exit(0), 500); return; }
  console.error(e.message);
  process.exit(1);
});

ensureYtdlp()
  .catch(e => console.warn('Aviso:', e.message, '- vou tentar o yt-dlp do PATH.'))
  .then(() => server.listen(PORT, '127.0.0.1', async () => {
    console.log(`ytbaixar rodando em ${localUrl}`);
    ensureFfmpeg(); // em segundo plano: já vai baixando enquanto a pessoa cola o link
    if (config.lan) await startLan().catch(e => console.warn('Acesso pela rede indisponível:', e.message));
    if (APP_MODE) openAppWindow(localUrl);
  }));
