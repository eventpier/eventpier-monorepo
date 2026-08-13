import { createServer } from "node:http";

const PORT = 4000;

const server = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end(
    "eventpier-aws placeholder (spec 003) — sem endpoint real ainda (ver spec 005)\n",
  );
});

server.listen(PORT, () => {
  console.log(`eventpier-aws placeholder ouvindo na porta ${PORT}`);
});
