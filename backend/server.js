import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const PORT = process.env.PORT || 4000;

// Em produção, defina FRONTEND_URL nas variáveis de ambiente
// com o domínio onde o frontend fica publicado (ex: https://meu-map-app.vercel.app)
const FRONTEND_URL = process.env.FRONTEND_URL || "*";

const app = express();
app.use(cors({ origin: FRONTEND_URL }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
  },
});

/**
 * "Base de dados" dos utilizadores ligados neste momento.
 *
 * Optei por manter isto em memória (um Map simples), em vez de usar
 * um SGBD (Postgres/Mongo/etc.), porque:
 *  - os dados são efémeros por natureza — só interessa a posição
 *    "agora" de quem está ligado, não um histórico persistente;
 *  - o requisito é tempo real, não persistência entre reinícios;
 *  - com um único processo Node isto é suficiente. Se um dia for preciso
 *    escalar para vários servidores, trocava-se este Map por Redis
 *    (Redis Pub/Sub ou o adaptador oficial @socket.io/redis-adapter),
 *    que é o caminho natural para partilhar estado entre instâncias.
 *
 * Estrutura de cada entrada: { id, lat, lng, updatedAt }
 */
const connectedUsers = new Map();

function broadcastUsers() {
  const users = Array.from(connectedUsers.values());
  io.emit("users:update", users);
}

io.on("connection", (socket) => {
  console.log(`[+] Cliente ligado: ${socket.id}`);

  // Assim que alguém se liga, envia-lhe já a lista atual de utilizadores
  socket.emit("users:update", Array.from(connectedUsers.values()));

  // O cliente envia a sua posição (lat/lng) sempre que o navegador a atualiza
  socket.on("location:update", (coords) => {
    if (
      !coords ||
      typeof coords.lat !== "number" ||
      typeof coords.lng !== "number"
    ) {
      return; // ignora payloads inválidos
    }

    connectedUsers.set(socket.id, {
      id: socket.id,
      lat: coords.lat,
      lng: coords.lng,
      updatedAt: Date.now(),
    });

    broadcastUsers();
  });

  socket.on("disconnect", () => {
    console.log(`[-] Cliente desligado: ${socket.id}`);
    connectedUsers.delete(socket.id);
    broadcastUsers();
  });
});

app.get("/", (req, res) => {
  res.send("Map App backend está a correr. Socket.IO pronto para ligações.");
});

// Endpoint simples de healthcheck, útil para o Render/Railway/etc.
app.get("/health", (req, res) => {
  res.json({ status: "ok", connectedUsers: connectedUsers.size });
});

server.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});
