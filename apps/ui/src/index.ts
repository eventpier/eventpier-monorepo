import { createServer } from "node:http";

const PORT = 3000;

const server = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end(
    "eventpier-ui placeholder (spec 003) — sem UI real ainda (ver spec 009)\n",
  );
});

server.listen(PORT, () => {
  console.log(`eventpier-ui placeholder ouvindo na porta ${PORT}`);
});
