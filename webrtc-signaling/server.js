import { wss } from "./ws-server.js";
import { nanoid } from "nanoid";

const rooms = new Map();

function leaveRoom(ws) {
    if (!ws.roomId) return;

    const set = rooms.get(ws.roomId);
    if (set) {
        set.delete(ws);
        if (set.size === 0) rooms.delete(ws.roomId);
    }
    ws.roomId = null;
}

const broadcastClients = (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const list = Array.from(room)
        .filter((s) => s.name)
        .map((s) => ({ id: s.id, name: s.name }));

    const msg = JSON.stringify({ type: "clientsList", content: list });

    room.forEach((s) => {
        if (s.readyState === 1) s.send(msg);
    });
};

wss.on("connection", function connection(ws) {
    ws.id = nanoid(8);
    ws.send(JSON.stringify({ yourID: ws.id }));
    broadcastClients(ws.roomId);

    ws.on("message", function message(data) {
        const msg = JSON.parse(data);

        msg.from = ws.id;

        switch (msg.type) {
            case "register":
                ws.name = msg.name;
                broadcastClients(ws.roomId);
                break;

            case "fileMeta":
            case "answer":
            case "ice-candidate":
            case "offer":
                const room = rooms.get(ws.roomId);
                if (!room) return;
                room.forEach((client) => {
                    if (
                        client !== ws &&
                        client.readyState === 1 &&
                        (!msg.to || client.id === msg.to)
                    ) {
                        client.send(JSON.stringify(msg));
                    }
                });
                break;

            case "join-room":
                leaveRoom(ws);
                const { roomId } = msg;
                if (!rooms.has(roomId)) rooms.set(roomId, new Set());
                rooms.get(roomId).add(ws);
                ws.roomId = roomId;
                ws.send(JSON.stringify({ type: "joined", roomId }));
                break;

            case "leave-room":
                leaveRoom(ws);
                ws.send(JSON.stringify({ type: "left" }));

            default:
                wss.clients.forEach((client) => {
                    if (client.readyState === 1) client.send(JSON.stringify(msg));
                });
                break;
        }
    });
    ws.on("error", console.error);
    ws.on("close", () => {
        broadcastClients(ws.roomId);
        leaveRoom(ws);
    });
});
