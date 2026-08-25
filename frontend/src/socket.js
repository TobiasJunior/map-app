import { io } from "socket.io-client";

// URL do backend. Em desenvolvimento local aponta para localhost:4000.
// Em produção, define VITE_BACKEND_URL no ficheiro .env (ou nas
// variáveis de ambiente da plataforma de deploy) com o URL público
// do backend, ex: https://map-app-backend.onrender.com
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

export const socket = io(BACKEND_URL, {
  autoConnect: true,
  transports: ["websocket", "polling"],
});
