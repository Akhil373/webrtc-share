import "dotenv/config";
import http from "http";
import { WebSocketServer } from "ws";

const port = process.env.PORT || 8080;
const host = "0.0.0.0";

const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("WebSocket signaling server is running\n");
});

export const wss = new WebSocketServer({ server });

server.listen(port, host, () => {
    console.log(`WebSocket server listening on ${host}:${port}`);
});
