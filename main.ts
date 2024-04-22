import { serve } from "https://deno.land/std@0.140.0/http/server.ts";
import { decodeBase64Url } from "https://deno.land/std@0.223.0/encoding/base64url.ts";

const kv = await Deno.openKv();

serve((req) => {
  const url = new URL(req.url);

  const [leader, encodedRoomId, ...rest] = url.pathname.slice(1).split("/");

  if (
    leader !== "rooms" || typeof encodedRoomId !== "string" || rest.length > 0
  ) {
    return new Response("not found", {
      status: 404,
      headers: {
        "access-control-allow-origin": "*",
      },
    });
  }

  let roomId;

  try {
    roomId = decodeBase64Url(encodedRoomId);
  } catch {
    return new Response("invalid room id", {
      status: 400,
      headers: {
        "access-control-allow-origin": "*",
      },
    });
  }

  const upgrade = req.headers.get("upgrade") || "";

  if (upgrade.toLowerCase() != "websocket") {
    return new Response("request isn't trying to upgrade to websocket.");
  }

  const { socket, response } = Deno.upgradeWebSocket(req);

  socket.onopen = () => console.log(`${url.pathname}: Opened`);

  socket.onmessage = (e) => {
    if (!isArrayBuffer(e.data)) {
      socket.close();
    }

    console.log(`${url.pathname}: Message received`);

    const id = Date.now() + Math.random();

    kv.atomic()
      .set([roomId, "messages", id], e.data, { expireIn: 3_000 })
      .set([roomId, "lastUpdated"], id, { expireIn: 86_400_000 })
      .commit();
  };

  socket.onerror = (e) =>
    console.warn(`${url.pathname}: Errored: ${(e as ErrorEvent).message}`);

  let closed = false;

  socket.onclose = () => {
    closed = true;
    console.log(`${url.pathname}: Closed`);
  };

  (async () => {
    const deliveredIds = new Set<number>();

    for await (const _bump of kv.watch([[roomId, "lastUpdated"]])) {
      if (closed) {
        return;
      }

      for await (
        const entry of kv.list({
          prefix: [roomId, "messages"],
          start: [roomId, "messages", Date.now() - 10_000],
        })
      ) {
        if (closed) {
          return;
        }

        const [, , id] = entry.key;

        if (typeof id !== "number") {
          throw new Error("should be number");
        }

        if (!isArrayBuffer(entry.value)) {
          throw new Error("should be arraybuffer");
        }

        if (!deliveredIds.has(id)) {
          socket.send(entry.value);
          deliveredIds.add(id);
          console.log(`${url.pathname}: Message delivered`);
        }
      }

      const threshold = Date.now() - 10_000;

      for (const k of deliveredIds) {
        if (k < threshold) {
          deliveredIds.delete(k);
        }
      }
    }
  })();

  return response;
});

function isArrayBuffer(value: unknown): value is ArrayBuffer {
  try {
    return Object.getPrototypeOf(value).constructor === ArrayBuffer;
  } catch {
    return false;
  }
}
