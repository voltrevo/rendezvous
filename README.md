# rendezvous

A rendezvous server for [deno](https://deno.com/) (and
[deno deploy](https://deno.com/deploy)).

Deployed at `https://rendezvous.deno.dev`.

## About

Sometimes, especially on the web, there is no direct/easy way for peers to
connect to each other. A rendezvous server facilitates these connections by
providing rooms into which anyone can broadcast messages.

The rooms are not discoverable (except by external methods). You need to provide
the same room identifier to connect to each other.

## Privacy

Privacy is not the rendezvous server's responsibility. If you publish messages
in plain text, assume the server operator can read them. If you use a short room
identifier or something like "hello-there-im-bob" then anyone will be able to
discover it.

With that said, the server is designed with the ability to create very strong
privacy in mind. It is up to the application to use encryption/etc to make this
happen.

## API

Connect a websocket to `/rooms/:roomId`. Room ids are binary internally - use
[base64url](https://base64.guru/standards/base64url) to encode it in the url.
Sending a message broadcasts it to all other connections in the same room.
