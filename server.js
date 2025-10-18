import { wss } from "./ws-server";
const broadcastClients = () => {
    const clientsList = [];
    wss.clients.forEach((client) => {
        if (client.name) {
            clientsList.push({ id: client.id, name: client.name });
        }
    });

    const message = JSON.stringify({
        type: "clientsList",
        content: clientsList,
    });

    wss.clients.forEach((client) => {
        client.send(message);
    });
};

wss.on("connection", function connection(ws) {
    ws.id = crypto.randomUUID();
    ws.send(JSON.stringify({ yourID: ws.id }));
    broadcastClients();

    ws.on("error", console.error);

    ws.on("message", function message(data) {
        const msg = JSON.parse(data);

        msg.from = ws.id;

        switch (msg.type) {
            case "register":
                ws.name = msg.name;
                broadcastClients();
                break;

            case "fileMeta":
            case "answer":
            case "ice-candidate":
            case "offer":
                wss.clients.forEach((client) => {
                    if (client.id === msg.to && client.readyState === 1) {
                        client.send(JSON.stringify(msg));
                    }
                });
                break;

            default:
                wss.clients.forEach((client) => {
                    if (client.readyState === 1) client.send(JSON.stringify(msg));
                });
                break;
        }
    });
});
