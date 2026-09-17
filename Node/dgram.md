# Dgram (UDP Sockets)

The `node:dgram` module implements UDP (User Datagram Protocol) sockets, giving Node.js programs a way to send and receive discrete packets of data ("datagrams") over the network without the connection setup, ordering guarantees, or reliability machinery that TCP (and by extension `node:net`/`node:http`, which are built on TCP) provides. UDP is connectionless: there's no handshake, no persistent connection state between sender and receiver, and no guarantee that a sent packet arrives at all, arrives only once, or arrives in the order it was sent. In exchange for giving up those guarantees, UDP has much lower overhead and latency, which is precisely why it's the right choice for certain workloads and the wrong choice for others.

`dgram.createSocket(type)` creates a socket, where `type` is `'udp4'` or `'udp6'` depending on the IP version. Unlike TCP sockets, a UDP socket isn't "connected" to a single peer by default — you call `socket.bind(port, address)` to have it listen for incoming datagrams on a given port/interface, and `socket.send(msg, port, address, callback)` to fire off a datagram to any destination, packet by packet, without first establishing a connection. Incoming data arrives via the `'message'` event, which hands you both the data buffer and an `rinfo` (remote info) object containing the sender's address and port — since there's no persistent connection, every single incoming packet carries its own sender info, because the next packet could, in principle, come from a completely different peer.

The classic use cases for UDP reflect its tradeoffs directly: DNS queries (a single small request/response where the overhead of a TCP handshake would dominate, and the client just retries if nothing comes back), real-time media streaming and VoIP (where a dropped or late packet is better handled by skipping it than by stalling everything waiting for TCP retransmission — nobody wants a video call to pause for a lost frame to be resent), online multiplayer game state updates (fresh position updates arriving 50ms later supersede stale ones anyway, so retransmitting old packets would be pointless), and service discovery/broadcast protocols (`socket.setBroadcast(true)` lets a single datagram be received by every host on a local network segment, which TCP's point-to-point model can't do). Node applications reach for `dgram` specifically when building this kind of protocol implementation, a custom telemetry/metrics emitter (e.g., StatsD-style fire-and-forget metrics), or a DNS-adjacent tool — for ordinary request/response APIs, HTTP over TCP remains the default because you generally do want reliability and ordering.

Because UDP provides no reliability, ordering, or congestion control, any of those properties your application needs (message acknowledgment, retries, reordering, flow control) have to be built by the application itself on top of raw `dgram` sockets — this is exactly what protocols like QUIC (which HTTP/3 is built on) do, layering their own reliability and congestion control over UDP rather than using it raw, in order to get UDP's lower connection-setup latency while still providing guarantees where needed.

## Examples

```js
// UDP server: binds to a port and logs every datagram received, with sender info
import dgram from 'node:dgram';

const server = dgram.createSocket('udp4');

server.on('message', (msg, rinfo) => {
  console.log(`Received "${msg}" from ${rinfo.address}:${rinfo.port}`);
});

server.on('listening', () => {
  const address = server.address();
  console.log(`UDP server listening on ${address.address}:${address.port}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  server.close();
});

server.bind(41234);
```

```js
// UDP client: sending a one-off datagram, no connection handshake needed
import dgram from 'node:dgram';

const client = dgram.createSocket('udp4');
const message = Buffer.from('Hello over UDP');

client.send(message, 41234, 'localhost', (err) => {
  if (err) console.error('Send failed:', err);
  else console.log('Datagram sent');
  client.close(); // no persistent connection to keep open — safe to close right after sending
});
```

```js
// Broadcasting a datagram to every host on the local network — something TCP cannot do
import dgram from 'node:dgram';

const socket = dgram.createSocket('udp4');

socket.bind(() => {
  socket.setBroadcast(true); // required before sending to a broadcast address

  const message = Buffer.from(JSON.stringify({ type: 'discover', service: 'my-app' }));
  socket.send(message, 41234, '255.255.255.255', (err) => {
    if (err) console.error(err);
    console.log('Broadcast sent — any listening host on the LAN can receive it');
    socket.close();
  });
});
```

## Common Pitfalls / Gotchas

- Assuming UDP guarantees delivery, order, or exactly-once semantics — none of that is provided; packets can be dropped, duplicated, or arrive out of order, and the application must handle that if it matters.
- Sending datagrams larger than the path MTU (typically ~1500 bytes on Ethernet, less after headers) without accounting for IP fragmentation — oversized UDP packets get fragmented at the IP layer and if even one fragment is lost, the entire datagram is lost; keep payloads small or handle chunking at the application layer.
- Forgetting to call `socket.setBroadcast(true)` before sending to a broadcast address — the send will fail without it.
- Not handling the `'error'` event on a UDP socket — errors like `EADDRINUSE` (port already bound) or `ECONNREFUSED` (for connected UDP sockets, when an ICMP "port unreachable" comes back) won't be surfaced any other way.
- Treating `rinfo.address`/`rinfo.port` on every incoming message as trustworthy authentication — UDP source addresses can be spoofed relatively easily (no handshake to prevent it), which is also why UDP-based protocols are common vectors for reflection/amplification DDoS attacks; don't use the sender info alone as an authentication mechanism.
- Building a request/response protocol over `dgram` without your own retry/timeout/acknowledgment logic and being surprised when packets silently vanish under network congestion.
- Choosing UDP by default for typical web API traffic — for anything needing reliable, ordered delivery (which is most web APIs), `net`/`http`/`https` (TCP-based) remain the correct default; `dgram` is a deliberate choice for a specific class of problems, not a general-purpose replacement.

## Interview Questions & Answers

**Q: What's the fundamental difference between UDP (`dgram`) and TCP (`net`/`http`) in Node.js?**
A: TCP is connection-oriented and reliable — it establishes a handshake, guarantees ordered and complete delivery of the byte stream (retransmitting lost packets), and provides congestion control; `net`/`http`/`https` are all built on it. UDP (`dgram`) is connectionless — there's no handshake, no delivery guarantee, no ordering guarantee, and no built-in congestion control. Each UDP `send()` fires off an independent packet that might be dropped, duplicated, or arrive out of order, with no automatic recovery. UDP trades reliability for lower latency and overhead.

**Q: Why would you choose UDP over TCP for something like a game server or video call?**
A: Because in those use cases, stale data is worse than missing data. If a position update or video frame is lost, retransmitting it under TCP would stall delivery of all subsequent, more current data waiting for that retransmission (head-of-line blocking) — but by the time a retransmitted frame arrives, a newer one has already superseded it anyway. It's better to just skip the lost packet and move on to the next one, which is exactly what UDP naturally allows and TCP's ordered-delivery guarantee does not.

**Q: How do you know who sent a UDP message in Node, since there's no persistent connection?**
A: The `'message'` event handler on a `dgram` socket receives two arguments: the data buffer and an `rinfo` object containing the sender's `address` and `port` for that specific packet. Because UDP is connectionless, this information is attached per-packet rather than being tied to a connection object, since in principle every incoming packet could come from a different sender.

**Q: If UDP doesn't guarantee delivery or ordering, how do protocols like QUIC/HTTP-3 use it and still provide reliability?**
A: They implement their own reliability layer on top of raw UDP at the application/protocol level — sequence numbers, acknowledgments, retransmission of lost packets, and congestion control — essentially reimplementing the reliability guarantees TCP provides natively, but with more flexibility (e.g., avoiding TCP head-of-line blocking across independent streams, and skipping TCP's fixed handshake overhead). This gets UDP's lower connection-setup latency while still providing guarantees where the application actually needs them.

## Related Topics

- [http.md](./http.md)
- [https.md](./https.md)
- [tls-ssl.md](./tls-ssl.md)
- [buffers.md](./buffers.md)
- [security.md](./security.md)
