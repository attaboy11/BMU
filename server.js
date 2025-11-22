const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const {
  bmuModels,
  subsystems,
  symptoms,
  components,
  faultFlows,
  safetyNotes,
  jobs,
  findModel,
} = require('./data/store');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function sendNotFound(res) {
  sendJson(res, 404, { error: 'Not found' });
}

function matchStatic(req, res) {
  const parsedUrl = url.parse(req.url);
  let pathname = `${parsedUrl.pathname}`;
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.join(PUBLIC_DIR, pathname.replace('..', ''));
  if (filePath.startsWith(PUBLIC_DIR) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const mime = filePath.endsWith('.css')
      ? 'text/css'
      : filePath.endsWith('.js')
      ? 'application/javascript'
      : 'text/html';
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }
  return false;
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (err) {
        resolve({});
      }
    });
  });
}

function filterByModel(list, modelId) {
  if (!modelId) return list;
  return list.filter((item) => (item.modelId ? item.modelId === modelId : item.modelIds?.includes(modelId)));
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const { pathname, query } = parsedUrl;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  // API routes
  if (pathname === '/api/models' && req.method === 'GET') {
    return sendJson(res, 200, bmuModels);
  }

  if (pathname === '/api/subsystems' && req.method === 'GET') {
    const { modelId } = query;
    const filtered = modelId
      ? subsystems.filter((s) => s.modelIds.includes(modelId))
      : subsystems;
    return sendJson(res, 200, filtered);
  }

  if (pathname === '/api/symptoms' && req.method === 'GET') {
    const { subsystemId } = query;
    const filtered = subsystemId ? symptoms.filter((s) => s.subsystemId === subsystemId) : symptoms;
    return sendJson(res, 200, filtered);
  }

  if (pathname === '/api/fault-flow' && req.method === 'GET') {
    const { modelId, subsystemId, symptomId } = query;
    const flow = faultFlows.find(
      (f) => (!modelId || f.modelIds.includes(modelId)) && f.subsystemId === subsystemId && f.symptomId === symptomId,
    );
    if (!flow) return sendNotFound(res);
    const safety = flow.safety.map((id) => safetyNotes.find((n) => n.id === id)?.text).filter(Boolean);
    return sendJson(res, 200, { ...flow, safety });
  }

  if (pathname.startsWith('/api/components') && req.method === 'GET') {
    const parts = pathname.split('/');
    if (parts.length === 4 && parts[3]) {
      const comp = components.find((c) => c.id === parts[3]);
      if (!comp) return sendNotFound(res);
      return sendJson(res, 200, comp);
    }
    const { modelId, subsystemId, q } = query;
    let list = components;
    if (modelId) list = list.filter((c) => c.modelId === modelId);
    if (subsystemId) list = list.filter((c) => c.subsystemId === subsystemId);
    if (q) {
      const term = q.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          c.partNumber.toLowerCase().includes(term) ||
          c.location.toLowerCase().includes(term),
      );
    }
    return sendJson(res, 200, list);
  }

  if (pathname === '/api/jobs' && req.method === 'GET') {
    return sendJson(res, 200, jobs);
  }

  if (pathname === '/api/jobs' && req.method === 'POST') {
    const payload = await parseBody(req);
    const job = {
      id: `job-${Date.now()}`,
      ...payload,
      createdAt: new Date().toISOString(),
      model: findModel(payload.modelId || '') || null,
    };
    jobs.unshift(job);
    return sendJson(res, 201, job);
  }

  // Static assets
  if (matchStatic(req, res)) return;

  sendNotFound(res);
});

server.listen(PORT, () => {
  console.log(`BMU Fault Finder API running on http://localhost:${PORT}`);
});
