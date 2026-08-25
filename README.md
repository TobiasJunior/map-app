# Map App — Coordenadas em Tempo Real

Aplicação com um mapa que mostra, em tempo real, a sua posição (latitude/longitude)
e a de todos os outros utilizadores ligados no mesmo momento.

## Arquitetura e decisões técnicas

```
frontend (React + Vite + react-leaflet)  <—WebSocket (Socket.IO)—>  backend (Node.js + Express + Socket.IO)
```

**Frontend — React + Leaflet**
- `react-leaflet` renderiza o mapa com tiles do OpenStreetMap (gratuito, sem chave de API).
- `navigator.geolocation.watchPosition` obtém a localização do browser e volta a
  chamar o callback sempre que a posição muda — é o que dá o efeito "tempo real"
  do lado do utilizador (em vez de `getCurrentPosition`, que só lê uma vez).
- Cada atualização de posição é emitida ao servidor via `socket.emit("location:update", {lat, lng})`.
- O componente subscreve o evento `users:update`, que o servidor emite sempre que
  a lista de utilizados ligados muda (nova posição, nova ligação ou desconexão).
- As coordenadas aparecem numa barra lateral (lista), não escritas por cima do mapa —
  o mapa mostra só os marcadores, como pedido no desafio.

**Backend — Node.js + Express + Socket.IO**
- Usa WebSockets (via Socket.IO) em vez de fazer polling HTTP repetido, porque é o
  mecanismo correto para push em tempo real bidirecional com baixa latência.
- Mantém um `Map` em memória (`socket.id → {lat, lng, updatedAt}`) como "base de dados".
  Foi uma escolha deliberada: os dados são efémeros (só interessa "quem está ligado
  agora e onde está"), não há requisito de persistência entre reinícios do servidor,
  por isso um SGBD tradicional (Postgres/Mongo) traria complexidade sem benefício real.
  Se a aplicação precisasse de escalar para vários processos/servidores, o próximo
  passo natural seria substituir o `Map` por Redis (Pub/Sub ou o adaptador oficial
  `@socket.io/redis-adapter` do Socket.IO), para partilhar o estado entre instâncias.
- A cada atualização (posição nova, ligação nova, desconexão) o servidor faz
  `io.emit("users:update", listaCompleta)` — broadcast simples para todos os clientes.

## Correr localmente

### Backend
```bash
cd backend
npm install
npm start
# corre em http://localhost:4000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env   # ajuste VITE_BACKEND_URL se necessário
npm run dev
# corre em http://localhost:5173
```

Abra `http://localhost:5173` em duas abas/navegadores diferentes (ou peça a
outra pessoa para abrir o link) para ver os dois marcadores em tempo real.
Nota: o browser só partilha geolocalização em contexto seguro — `localhost`
funciona sem HTTPS, mas em produção o site tem de ser servido por HTTPS.

## Deploy

**Backend (ex: Render, Railway ou Fly.io)**
1. Publique a pasta `backend/` num repositório Git.
2. Crie um novo "Web Service" apontando para esse repositório.
3. Build command: `npm install` — Start command: `npm start`.
4. Defina a variável de ambiente `FRONTEND_URL` com o domínio final do frontend
   (para restringir o CORS), ex: `https://map-app.vercel.app`.
5. Guarde o URL público gerado (ex: `https://map-app-backend.onrender.com`).

**Frontend (ex: Vercel ou Netlify)**
1. Publique a pasta `frontend/` num repositório Git.
2. Framework preset: Vite. Build command: `npm run build`. Output dir: `dist`.
3. Defina a variável de ambiente `VITE_BACKEND_URL` com o URL do backend do passo anterior.
4. Deploy. Partilhe o link gerado.

## Estrutura de ficheiros

```
map-app/
├── backend/
│   ├── package.json
│   └── server.js        # Express + Socket.IO, estado em memória
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── .env.example
    └── src/
        ├── main.jsx
        ├── App.jsx       # mapa, geolocalização, lista de utilizadores
        └── socket.js     # ligação Socket.IO ao backend
```
