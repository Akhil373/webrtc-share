import { WebSocketServer } from "ws";

export const wss = new WebSocketServer({ port: 8080 });
console.log("Server running on wss://localhost:8080");
