import { serve } from "https://deno.land/std@0.140.0/http/server.ts";
import { decodeBase64Url } from "https://deno.land/std@0.223.0/encoding/base64url.ts";

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

  socket.onopen = () => console.log("socket opened", { roomId });

  socket.onmessage = (e) => {
    console.log("socket message:", e.data);
    socket.send(new Date().toString());
  };

  socket.onerror = (e) =>
    console.log("socket errored:", (e as ErrorEvent).message);

  socket.onclose = () => console.log("socket closed");

  return response;
});
