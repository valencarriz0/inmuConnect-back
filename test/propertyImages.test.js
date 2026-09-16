import "../test-support/environment.js";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import app from "../src/app.js";
import storageClient from "../src/integrations/supabase/storageClient.js";
import User from "../src/models/User.js";
import {
  deleteUnusedPropertyImages,
  uploadPropertyImages,
} from "../src/modules/property-images/propertyImage.service.js";
import { signAccessToken } from "../src/utils/jwt.js";

const publisherId = "15b5bc88-1a5c-4f61-86eb-f8c56fb70e30";
const interestedId = "2a85729c-24f1-4f01-b142-62e15ffb2a74";
const adminId = "97b55e08-ac69-48de-b8f4-032fc8695c33";
const objectIds = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
];

const bytes = {
  "image/jpeg": Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 2, 0, 0, 1, 0, 1, 0, 0]),
  "image/png": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]),
  "image/webp": Buffer.from("52494646100000005745425056503820", "hex"),
};

function file(mimetype, originalname = "nombre-local.exe", buffer = bytes[mimetype]) {
  return { mimetype, originalname, buffer };
}

function pathFor(id = objectIds[0], ownerId = publisherId, extension = "jpg") {
  return `properties/${ownerId}/${id}.${extension}`;
}

function fakeStorage(t, { failAt = 0 } = {}) {
  let uploads = 0;
  return {
    upload: t.mock.fn(async () => {
      uploads++;
      if (uploads === failAt) throw new Error("DO_NOT_EXPOSE");
    }),
    getPublicUrl: t.mock.fn((path) =>
      `https://project.test/storage/v1/object/public/property-images/${path}`),
    remove: t.mock.fn(async () => {}),
  };
}

function sequentialUuid() {
  let index = 0;
  return () => objectIds[index++];
}

async function withServer(callback) {
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    return await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function token(id) {
  return signAccessToken(id);
}

function multipart(files) {
  const body = new FormData();
  for (const image of files) {
    body.append("images", new Blob([image.buffer], { type: image.mimetype }), image.originalname);
  }
  return body;
}

async function request(baseUrl, method, body, userId = publisherId) {
  const options = {
    method,
    headers: { Authorization: `Bearer ${token(userId)}` },
  };
  if (body instanceof FormData) options.body = body;
  else if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${baseUrl}/api/publisher/property-images`, options);
  return {
    status: response.status,
    body: response.status === 204 ? null : await response.json(),
  };
}

test("upload exige publisher y no deja que interested o admin lleguen a Storage", async (t) => {
  t.mock.method(User, "findByPk", async (id) => ({
    id,
    role: id === publisherId ? "publisher" : id === adminId ? "admin" : "interested",
    accountStatus: "active",
  }));
  const upload = t.mock.method(storageClient, "upload", async () => {});
  await withServer(async (baseUrl) => {
    assert.equal((await fetch(`${baseUrl}/api/publisher/property-images`, { method: "POST" })).status, 401);
    assert.equal((await request(baseUrl, "POST", multipart([file("image/jpeg")]), interestedId)).status, 403);
    assert.equal((await request(baseUrl, "POST", multipart([file("image/jpeg")]), adminId)).status, 403);
  });
  assert.equal(upload.mock.callCount(), 0);
});

test("publisher sube un archivo y recibe URL y path en el mismo orden", async (t) => {
  t.mock.method(User, "findByPk", async (id) => ({ id, role: "publisher", accountStatus: "active" }));
  t.mock.method(storageClient, "upload", async () => {});
  t.mock.method(storageClient, "getPublicUrl", (path) => `https://project.test/public/${path}`);
  t.mock.method(storageClient, "remove", async () => {});

  await withServer(async (baseUrl) => {
    const result = await request(baseUrl, "POST", multipart([
      file("image/jpeg", "primera.exe"),
      file("image/png", "segunda.txt"),
    ]));
    assert.equal(result.status, 201);
    assert.match(result.body.images[0].path, new RegExp(`^properties/${publisherId}/[0-9a-f-]+\\.jpg$`));
    assert.match(result.body.images[1].path, new RegExp(`^properties/${publisherId}/[0-9a-f-]+\\.png$`));
    assert.equal(result.body.images[0].url, `https://project.test/public/${result.body.images[0].path}`);
    assert.equal(result.body.images[1].url, `https://project.test/public/${result.body.images[1].path}`);
  });
});

test("upload rechaza request sin archivos, más de cinco y archivos mayores a 5 MB", async (t) => {
  t.mock.method(User, "findByPk", async (id) => ({ id, role: "publisher", accountStatus: "active" }));
  await withServer(async (baseUrl) => {
    assert.equal((await request(baseUrl, "POST", new FormData())).status, 400);
    assert.equal((await request(baseUrl, "POST", multipart(Array.from({ length: 6 }, () => file("image/png"))))).status, 400);
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1);
    bytes["image/png"].copy(oversized);
    assert.equal((await request(baseUrl, "POST", multipart([file("image/png", "grande.png", oversized)]))).status, 400);
  });
});

test("valida JPEG, PNG y WebP por firma antes de subir y deriva la extensión", async (t) => {
  const storage = fakeStorage(t);
  const result = await uploadPropertyImages(publisherId, [
    file("image/jpeg"), file("image/png"), file("image/webp"),
  ], { storage, uuid: sequentialUuid() });
  assert.deepEqual(result.images.map(({ path }) => path), [
    pathFor(objectIds[0]),
    pathFor(objectIds[1], publisherId, "png"),
    pathFor(objectIds[2], publisherId, "webp"),
  ]);
  assert.deepEqual(storage.upload.mock.calls.map(({ arguments: args }) => args[2]), [
    "image/jpeg", "image/png", "image/webp",
  ]);
});

test("rechaza MIME falso y contenido no admitido antes de cualquier upload", async (t) => {
  for (const invalid of [
    file("image/jpeg", "falsa.jpg", bytes["image/png"]),
    file("image/jpeg", "texto.jpg", Buffer.from("contenido de texto")),
  ]) {
    const storage = fakeStorage(t);
    await assert.rejects(uploadPropertyImages(publisherId, [invalid], { storage }), { statusCode: 400 });
    assert.equal(storage.upload.mock.callCount(), 0);
  }
});

test("admite cinco, usa UUID, ignora nombres originales y configura upsert false en el adaptador", async (t) => {
  const storage = fakeStorage(t);
  const result = await uploadPropertyImages(
    publisherId,
    objectIds.map((id) => file("image/jpeg", `../../${id}.php`)),
    { storage, uuid: sequentialUuid() },
  );
  assert.equal(result.images.length, 5);
  assert.ok(result.images.every(({ path }, index) => path === pathFor(objectIds[index])));
  assert.ok(result.images.every(({ path }) => !path.includes("php") && !path.includes("..")));

  const source = await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("../src/integrations/supabase/storageClient.js", import.meta.url), "utf8"));
  assert.match(source, /upsert:\s*false/);
});

test("un fallo en el segundo upload elimina el primero y devuelve error seguro", async (t) => {
  const storage = fakeStorage(t, { failAt: 2 });
  await assert.rejects(
    uploadPropertyImages(publisherId, [file("image/jpeg"), file("image/png")], {
      storage,
      uuid: sequentialUuid(),
    }),
    { statusCode: 503, message: "El almacenamiento de imágenes no está disponible en este momento." },
  );
  assert.deepEqual(storage.remove.mock.calls[0].arguments[0], [pathFor(objectIds[0])]);
});

test("limpieza elimina paths propios y rechaza ajenos, URLs y traversal", async (t) => {
  const storage = fakeStorage(t);
  const paths = [pathFor(objectIds[0]), pathFor(objectIds[1], publisherId, "webp")];
  await deleteUnusedPropertyImages(publisherId, paths, { storage });
  assert.deepEqual(storage.remove.mock.calls[0].arguments[0], paths);

  for (const invalid of [
    pathFor(objectIds[0], interestedId),
    `properties/${publisherId}/../${objectIds[0]}.jpg`,
    `https://project.test/${pathFor(objectIds[0])}`,
    `other-bucket/${pathFor(objectIds[0])}`,
    "",
  ]) {
    await assert.rejects(deleteUnusedPropertyImages(publisherId, [invalid], { storage }), { statusCode: 400 });
  }
  assert.equal(storage.remove.mock.callCount(), 1);
});

test("endpoint DELETE valida y elimina un path propio", async (t) => {
  t.mock.method(User, "findByPk", async (id) => ({ id, role: "publisher", accountStatus: "active" }));
  const remove = t.mock.method(storageClient, "remove", async () => {});
  await withServer(async (baseUrl) => {
    assert.equal((await request(baseUrl, "DELETE", { paths: [pathFor()] })).status, 204);
    assert.equal((await request(baseUrl, "DELETE", { paths: [pathFor(objectIds[0], interestedId)] })).status, 400);
  });
  assert.equal(remove.mock.callCount(), 1);
});

test("error de Storage en el endpoint no expone su detalle", async (t) => {
  t.mock.method(User, "findByPk", async (id) => ({ id, role: "publisher", accountStatus: "active" }));
  t.mock.method(storageClient, "upload", async () => { throw new Error("DO_NOT_EXPOSE"); });
  t.mock.method(storageClient, "remove", async () => {});
  await withServer(async (baseUrl) => {
    const result = await request(baseUrl, "POST", multipart([file("image/jpeg")]));
    assert.equal(result.status, 503);
    assert.equal(result.body.error, "El almacenamiento de imágenes no está disponible en este momento.");
    assert.equal(JSON.stringify(result.body).includes("DO_NOT_EXPOSE"), false);
  });
});
