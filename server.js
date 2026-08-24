/* Mini statični dev strežnik — brez odvisnosti. Zaženi z: npm run dev */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 5173;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  let file = path.join(ROOT, url === "/" ? "index.html" : url);

  // Ne pusti ven iz mape projekta.
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  fs.stat(file, (err, stat) => {
    if (!err && stat.isDirectory()) file = path.join(file, "index.html");

    fs.readFile(file, (err2, data) => {
      if (err2) {
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h1>404</h1><p>Ni najdeno: " + url + "</p>");
        console.log("404  " + url);
        return;
      }
      res.writeHead(200, {
        "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
      console.log("200  " + url);
    });
  });
});

server.listen(PORT, () => {
  console.log("\n  Pr'Tomsetu dev strežnik");
  console.log("  → http://localhost:" + PORT + "\n");
});
