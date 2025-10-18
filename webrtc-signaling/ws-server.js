import "dotenv/config";
import { WebSocketServer } from "ws";

const port = process.env.PORT;
export const wss = new WebSocketServer({ port: port });

console.log(`Server running on wss://localhost:${port}`);
