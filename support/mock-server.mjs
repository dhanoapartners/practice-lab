/**
 * @file Mock/proxy service for the Practice Lab LLM endpoint.
 *
 * The LLM-mode RAG test (specs/rag.spec.ts) needs POST /api/v1/help/ask with
 * `mode: 'llm'` to return a grounded, cited answer. The public lab has no
 * Workers AI model provisioned, so that call 500s. This server stands in:
 *
 *   - POST /api/v1/help/ask  with body.mode === 'llm'  -> a crafted mock answer
 *   - every other request                              -> proxied to the live lab
 *
 * Run it, then point the tests at it:
 *   node support/mock-server.mjs
 *   LAB_URL=http://localhost:8799 LAB_LLM=1 npx playwright test specs/rag.spec.ts
 *
 * Env:
 *   MOCK_PORT   port to listen on (default 8799)
 *   LAB_ORIGIN  upstream lab to proxy to (default https://www.dhanoapartners.com)
 */
import http from 'node:http';

const PORT = Number(process.env.MOCK_PORT || 8799);
const UPSTREAM = (process.env.LAB_ORIGIN || 'https://www.dhanoapartners.com').replace(/\/$/, '');

/**
 * The mocked LLM answer. Every meaningful word in `answer` also appears in the
 * citation `text`, so support/rag-checks.ts groundedness() scores it 1.0 and
 * ragIssues() returns []. The `[1]` marker satisfies the citation-marker check.
 */
const LLM_ANSWER = {
  answer: 'Yes, express shipping is available for the tent. [1]',
  citations: [
    {
      n: 1,
      docId: 'shipping',
      deprecated: false,
      text: 'Yes, express shipping is available for the tent and most in-stock items.',
      score: 0.94,
    },
  ],
  generator: 'llm',
  bug: 'none',
};

/** Reads the full request body as a Buffer. */
const readBody = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });

const server = http.createServer(async (req, res) => {
  const body = await readBody(req);

  // Intercept only the LLM-mode help call.
  if (req.method === 'POST' && req.url.startsWith('/api/v1/help/ask')) {
    let parsed = {};
    try {
      parsed = JSON.parse(body.toString() || '{}');
    } catch {
      /* fall through to proxy on unparseable body */
    }
    if (parsed.mode === 'llm') {
      const payload = JSON.stringify(LLM_ANSWER);
      res.writeHead(200, { 'content-type': 'application/json', 'x-mock': 'llm' });
      res.end(payload);
      console.log(`[mock] 200 llm answer  <-  POST ${req.url}`);
      return;
    }
  }

  // Everything else: transparently proxy to the live lab.
  const headers = { ...req.headers };
  delete headers.host;
  delete headers['content-length'];
  delete headers['accept-encoding']; // let fetch hand us a decoded body

  try {
    const upstream = await fetch(UPSTREAM + req.url, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
      redirect: 'manual',
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    const outHeaders = {};
    upstream.headers.forEach((v, k) => {
      if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(k)) {
        outHeaders[k] = v;
      }
    });
    res.writeHead(upstream.status, outHeaders);
    res.end(buf);
    console.log(`[proxy] ${upstream.status}  ${req.method} ${req.url}`);
  } catch (err) {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'proxy_failed', detail: String(err) }));
    console.error(`[proxy] 502  ${req.method} ${req.url}  ${err}`);
  }
});

server.listen(PORT, () => {
  console.log(`Mock service on http://localhost:${PORT}  ->  proxying ${UPSTREAM}`);
  console.log(`Run: LAB_URL=http://localhost:${PORT} LAB_LLM=1 npx playwright test specs/rag.spec.ts`);
});
