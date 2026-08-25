#!/usr/bin/env node
// Valida os endpoints de storage (GET /api/v1/storage/buckets e
// GET /api/v1/storage/buckets/:bucket/objects) do provider AWS contra
// um MiniStack real, conforme specs/008-implementar-storage/data-model.md.
//
// Diferente dos demais scripts em scripts/: depende de um MiniStack
// real e acessível (ver .pipeline/quality-gates.md — rode
// `docker compose --profile managed-env up -d ministack` antes de
// rodar este script localmente). Cria seus próprios buckets/objetos de
// teste — nunca assume dado pré-existente.
//
// Pressupõe que @eventpier/contracts e @eventpier/provider-aws já
// foram buildados. Não builda implicitamente.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CreateBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROVIDER_DIST_ENTRY = join(ROOT, "providers/aws/dist/index.js");
const PROVIDER_URL = "http://localhost:4000";
const MINISTACK_ENDPOINT = process.env.MINISTACK_ENDPOINT ?? "http://localhost:4566";
const BUCKET = `eventpier-validate-${Date.now()}`;

const errors = [];

if (!existsSync(PROVIDER_DIST_ENTRY)) {
  console.error("FALHOU — validate-storage-endpoint.mjs:");
  console.error(`  - ${PROVIDER_DIST_ENTRY} não existe. Rode o build de @eventpier/provider-aws antes de validar.`);
  process.exit(1);
}

function runProvider(env) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [PROVIDER_DIST_ENTRY], {
      stdio: ["ignore", "pipe", "inherit"],
      env: { ...process.env, ...env },
    });
    const timeout = setTimeout(
      () => reject(new Error("Timeout esperando o provider subir")),
      5000,
    );
    child.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("ouvindo na porta")) {
        clearTimeout(timeout);
        resolve(child);
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Provider encerrou antes de subir (exit code ${code})`));
    });
  });
}

// Fixture: cria um bucket com uma pasta ("prefixo") contendo um
// objeto, e um objeto solto na raiz — com retry curto, já que o
// MiniStack pode levar um instante a mais para aceitar conexões após
// `docker compose up -d`.
async function seedFixture() {
  const s3 = new S3Client({
    region: "us-east-1",
    endpoint: MINISTACK_ENDPOINT,
    forcePathStyle: true,
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
  });

  const attempts = 10;
  for (let i = 1; i <= attempts; i++) {
    try {
      await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
      break;
    } catch (err) {
      if (i === attempts) {
        throw new Error(`Não foi possível criar o bucket de teste no MiniStack (${MINISTACK_ENDPOINT}): ${err}`);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: "raiz.txt", Body: "conteudo" }));
  await s3.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: "pasta/dentro.txt", Body: "conteudo aninhado" }),
  );
}

await seedFixture();

// Cenário 1: MiniStack real acessível — caminho feliz.
{
  const child = await runProvider({ MINISTACK_ENDPOINT, MINISTACK_MANAGED: "true" });

  try {
    const bucketsRes = await fetch(`${PROVIDER_URL}/api/v1/storage/buckets`);
    const bucketsBody = await bucketsRes.json();
    if (bucketsRes.status !== 200) {
      errors.push(`GET /api/v1/storage/buckets deveria retornar 200, retornou ${bucketsRes.status}`);
    }
    if (!Array.isArray(bucketsBody.items) || !bucketsBody.items.some((b) => b.name === BUCKET)) {
      errors.push(`GET /api/v1/storage/buckets deveria incluir o bucket de teste ${BUCKET}, encontrado ${JSON.stringify(bucketsBody.items)}`);
    }

    const rootRes = await fetch(`${PROVIDER_URL}/api/v1/storage/buckets/${BUCKET}/objects`);
    const rootBody = await rootRes.json();
    const rootFolder = rootBody.items?.find((i) => i.type === "folder" && i.prefix === "pasta/");
    const rootObject = rootBody.items?.find((i) => i.type === "object" && i.key === "raiz.txt");
    if (!rootFolder) {
      errors.push(`Listagem raiz deveria conter a pasta "pasta/", encontrado ${JSON.stringify(rootBody.items)}`);
    }
    if (!rootObject || typeof rootObject.size !== "number" || typeof rootObject.lastModified !== "string") {
      errors.push(`Listagem raiz deveria conter o objeto "raiz.txt" com size/lastModified, encontrado ${JSON.stringify(rootBody.items)}`);
    }

    const nestedRes = await fetch(
      `${PROVIDER_URL}/api/v1/storage/buckets/${BUCKET}/objects?prefix=${encodeURIComponent("pasta/")}`,
    );
    const nestedBody = await nestedRes.json();
    const nestedObject = nestedBody.items?.find((i) => i.type === "object" && i.key === "pasta/dentro.txt");
    const phantomFolder = nestedBody.items?.some((i) => i.type === "object" && i.key === "pasta/");
    if (!nestedObject) {
      errors.push(`Listagem de "pasta/" deveria conter "pasta/dentro.txt", encontrado ${JSON.stringify(nestedBody.items)}`);
    }
    if (phantomFolder) {
      errors.push(`Listagem de "pasta/" não deveria conter um objeto fantasma para o próprio prefixo, encontrado ${JSON.stringify(nestedBody.items)}`);
    }

    const notFoundRes = await fetch(`${PROVIDER_URL}/api/v1/storage/buckets/bucket-que-nao-existe/objects`);
    const notFoundBody = await notFoundRes.json();
    if (notFoundRes.status !== 404 || notFoundBody.code !== "RESOURCE_NOT_FOUND") {
      errors.push(`Bucket inexistente deveria retornar 404 RESOURCE_NOT_FOUND, encontrado status=${notFoundRes.status} body=${JSON.stringify(notFoundBody)}`);
    }

    const manifestRes = await fetch(`${PROVIDER_URL}/api/v1/manifest`);
    const manifestBody = await manifestRes.json();
    const storageCapability = manifestBody.capabilities?.find((c) => c.id === "storage");
    if (storageCapability?.status !== "available") {
      errors.push(`Manifesto deveria reportar storage available com MiniStack real acessível, encontrado ${JSON.stringify(storageCapability)}`);
    }
  } finally {
    child.kill();
  }
}

// Cenário 2: endpoint inalcançável — capability indisponível, sem
// derrubar o MiniStack real usado no Cenário 1.
{
  const child = await runProvider({
    MINISTACK_ENDPOINT: "http://localhost:1",
    MINISTACK_MANAGED: "false",
  });

  try {
    const res = await fetch(`${PROVIDER_URL}/api/v1/storage/buckets`);
    const body = await res.json();
    if (res.status !== 503 || body.code !== "CONNECTION_FAILED") {
      errors.push(`Endpoint inalcançável deveria retornar 503 CONNECTION_FAILED, encontrado status=${res.status} body=${JSON.stringify(body)}`);
    }

    const manifestRes = await fetch(`${PROVIDER_URL}/api/v1/manifest`);
    const manifestBody = await manifestRes.json();
    const storageCapability = manifestBody.capabilities?.find((c) => c.id === "storage");
    if (storageCapability?.status !== "unavailable" || typeof storageCapability?.reason !== "string") {
      errors.push(`Manifesto deveria reportar storage unavailable com reason, encontrado ${JSON.stringify(storageCapability)}`);
    }
  } finally {
    child.kill();
  }
}

if (errors.length > 0) {
  console.error("FALHOU — validate-storage-endpoint.mjs:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exitCode = 1;
} else {
  console.log("OK — endpoints de storage respondem conforme data-model.md, com MiniStack real");
}
