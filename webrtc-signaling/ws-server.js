import "dotenv/config";
import { WebSocketServer } from "ws";

const port = process.env.PORT || 8080;
const host = "0.0.0.0";

const wss = new WebSocketServer({ port, host });
wss.on("listening", () => {
    console.log(`WebSocket server listening on ${host}:${port}`);
});
