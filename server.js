const http = require("node:http");
const { randomUUID } = require("node:crypto");
const { createReadStream } = require("node:fs");
const fs = require("node:fs/promises");
const path = require("node:path");

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const LEADS_FILE = path.join(DATA_DIR, "leads.json");

const STATIC_FILES = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/styles.css", "styles.css"],
  ["/script.js", "script.js"],
  ["/rockops-logo.png", "rockops-logo.png"],
]);

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
};

let writeQueue = Promise.resolve();

const sendJson = (res, statusCode, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": CONTENT_TYPES[".json"],
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
};

const ensureLeadStore = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(LEADS_FILE);
  } catch {
    await fs.writeFile(LEADS_FILE, "[]\n", "utf8");
  }
};

const readLeads = async () => {
  await ensureLeadStore();
  const raw = await fs.readFile(LEADS_FILE, "utf8");

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const queueLeadWrite = (task) => {
  writeQueue = writeQueue.then(task, task);
  return writeQueue;
};

const parseBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;

      if (size > 1024 * 1024) {
        const error = new Error("Payload muito grande.");
        error.statusCode = 413;
        reject(error);
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });

    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        const body = Buffer.concat(chunks).toString("utf8");
        resolve(JSON.parse(body));
      } catch {
        const error = new Error("Corpo da requisicao invalido.");
        error.statusCode = 400;
        reject(error);
      }
    });

    req.on("error", reject);
  });

const normalizeLead = (payload) => {
  const name = String(payload?.name || "").trim();
  const email = String(payload?.email || "").trim().toLowerCase();

  if (name.length < 2) {
    return { error: "Informe um nome valido." };
  }

  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!emailIsValid) {
    return { error: "Informe um e-mail valido." };
  }

  return {
    value: {
      id: randomUUID(),
      name,
      email,
      createdAt: new Date().toISOString(),
    },
  };
};

const serveStaticFile = async (req, res, pathname) => {
  const filename = STATIC_FILES.get(pathname);

  if (!filename) {
    return false;
  }

  const filePath = path.join(ROOT_DIR, filename);

  try {
    const stats = await fs.stat(filePath);
    const ext = path.extname(filename);
    const contentType = CONTENT_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": stats.size,
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
    });

    createReadStream(filePath).pipe(res);
    return true;
  } catch {
    sendJson(res, 404, { message: "Arquivo nao encontrado." });
    return true;
  }
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;
  const isReadRequest = req.method === "GET" || req.method === "HEAD";

  try {
    if (req.method === "GET" && pathname === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        service: "rockops-cloud-backend",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/leads") {
      const payload = await parseBody(req);
      const normalized = normalizeLead(payload);

      if (normalized.error) {
        sendJson(res, 400, { message: normalized.error });
        return;
      }

      const lead = normalized.value;

      await queueLeadWrite(async () => {
        const leads = await readLeads();
        leads.push(lead);
        await fs.writeFile(LEADS_FILE, `${JSON.stringify(leads, null, 2)}\n`, "utf8");
      });

      sendJson(res, 201, {
        message: "Diagnostico solicitado com sucesso. Nosso time entrara em contato em breve.",
        lead: {
          id: lead.id,
          createdAt: lead.createdAt,
        },
      });
      return;
    }

    if (pathname.startsWith("/api/")) {
      sendJson(res, 404, { message: "Endpoint nao encontrado." });
      return;
    }

    if (!isReadRequest) {
      sendJson(res, 404, { message: "Rota nao encontrada." });
      return;
    }

    const served = await serveStaticFile(req, res, pathname);

    if (served) {
      return;
    }

    const fallbackServed = await serveStaticFile(req, res, "/");

    if (!fallbackServed) {
      sendJson(res, 404, { message: "Pagina nao encontrada." });
    }
  } catch (error) {
    const message =
      error instanceof Error && error.message ? error.message : "Erro interno do servidor.";
    const statusCode =
      error && typeof error === "object" && "statusCode" in error ? error.statusCode : 500;

    sendJson(res, statusCode, { message });
  }
});

ensureLeadStore()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`RockOps backend online na porta ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Falha ao inicializar o backend:", error);
    process.exit(1);
  });
