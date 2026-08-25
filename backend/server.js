import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const PORT = process.env.PORT || 4000;

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const app = express();
app.use(cors({ origin: FRONTEND_URL }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
  },//2000 corresponde a 2s, estava com problema de desconexao apos saida de alguem
  pingInterval: 2000,
  pingTimeout: 2000,
});

/**
 * Mapa que guarda os utilizadores conectados.
 * Chave: socket.id (string)
 * Valor: { id, lat, lng, updatedAt }
 */
const connectedUsers = new Map();

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

/**
 * Valida se as coordenadas são números válidos dentro dos limites geográficos.
 *
 * @param {*} lat - Latitude a validar.
 * @param {*} lng - Longitude a validar.
 * @returns {boolean} `true` se as coordenadas forem válidas.
 */
function isValidCoords(lat, lng) {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

//Emite a lista atualizada de todos os utilizadores para todos os clientes.
function broadcastUsers() {
  const users = Array.from(connectedUsers.values());
  io.emit("users:update", users);
}

// EVENTOS SOCKET.IO
io.on("connection", (socket) => {
  console.log(`[+] Cliente ligado: ${socket.id}`);

  // Envia a lista atual de utilizadores para o novo cliente.
  socket.emit("users:update", Array.from(connectedUsers.values()));

  //Evento `location:update`: recebe as coordenadas do cliente e atualiza a sua posição no mapa de utilizadores.
  
  socket.on("location:update", (coords) => {
    if (!isValidCoords(coords?.lat, coords?.lng)) {
      console.warn(`[!] Coordenadas inválidas de ${socket.id}`);
      return;
    }

    connectedUsers.set(socket.id, {
      id: socket.id,
      lat: coords.lat,
      lng: coords.lng,
      updatedAt: Date.now(),
    });

    broadcastUsers();
  });

  //Evento `disconnect`: remove o utilizador do mapa e notifica todos.
  socket.on("disconnect", () => {
    console.log(`[-] Cliente desligado: ${socket.id}`);
    connectedUsers.delete(socket.id);
    broadcastUsers();
  });
});
 //Endpoint de healthcheck para monitorização 
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    connectedUsers: connectedUsers.size,
  });
});
// INICIALIZAÇÃO
server.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});