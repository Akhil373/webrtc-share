import "dotenv/config";
import { WebSocketServer } from "ws";

const port = process.env.PORT || 8080;
export const wss = new WebSocketServer({ port: port });

server.listen(port, "0.0.0.0", () => {
    console.log(`Listening on port ${port}`);
});
