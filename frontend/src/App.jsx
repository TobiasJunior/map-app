import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { socket } from "./socket";

// Os ícones padrão do Leaflet dependem de imagens que o bundler (Vite)
// não resolve automaticamente. Corrige-se apontando para o CDN.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Ícone diferente (vermelho) para destacar a posição do próprio utilizador
// no mapa, distinguindo-a das dos restantes utilizadores.
const meIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const DEFAULT_CENTER = [-25.9655, 32.5832]; // Maputo, como ponto de partida por omissão

export default function App() {
  const [myId, setMyId] = useState(null);
  const [myPosition, setMyPosition] = useState(null);
  const [users, setUsers] = useState([]);
  const [geoError, setGeoError] = useState(null);
  const [connected, setConnected] = useState(socket.connected);
  const mapRef = useRef(null);
  const hasCentered = useRef(false);

  // --- Ligação ao servidor Socket.IO ---
  useEffect(() => {
    function onConnect() {
      setConnected(true);
      setMyId(socket.id);
    }
    function onDisconnect() {
      setConnected(false);
    }
    function onUsersUpdate(list) {
      setUsers(list);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("users:update", onUsersUpdate);

    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("users:update", onUsersUpdate);
    };
  }, []);

  // --- Geolocalização do browser ---
  // Usa watchPosition (em vez de getCurrentPosition uma única vez) para que
  // a posição continue a ser enviada ao servidor sempre que o utilizador se
  // mover, mantendo o requisito de "tempo real".
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGeoError("Este navegador não suporta geolocalização.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setMyPosition(coords);
        setGeoError(null);
        socket.emit("location:update", coords);
      },
      (error) => {
        setGeoError(
          "Não foi possível obter a sua localização. Verifique as permissões do navegador."
        );
        console.error(error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Centra o mapa na posição do utilizador assim que ela é conhecida
  // pela primeira vez (só uma vez, para não "puxar" o mapa depois de o
  // utilizador o ter movido manualmente).
  useEffect(() => {
    if (myPosition && mapRef.current && !hasCentered.current) {
      mapRef.current.setView([myPosition.lat, myPosition.lng], 14);
      hasCentered.current = true;
    }
  }, [myPosition]);

  const otherUsers = users.filter((u) => u.id !== myId);

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif" }}>
      {/* Painel lateral: lista de coordenadas (não sobrepostas ao mapa) */}
      <aside
        style={{
          width: 320,
          padding: 16,
          overflowY: "auto",
          borderRight: "1px solid #ddd",
          boxSizing: "border-box",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Map App — Tempo Real</h2>

        <p style={{ fontSize: 13 }}>
          Estado da ligação:{" "}
          <strong style={{ color: connected ? "green" : "crimson" }}>
            {connected ? "ligado" : "desligado"}
          </strong>
        </p>

        {geoError && (
          <p style={{ color: "crimson", fontSize: 13 }}>{geoError}</p>
        )}

        <h3>A minha posição</h3>
        {myPosition ? (
          <p style={{ fontSize: 14 }}>
            Lat: {myPosition.lat.toFixed(6)} <br />
            Lng: {myPosition.lng.toFixed(6)}
          </p>
        ) : (
          <p style={{ fontSize: 13, color: "#666" }}>A obter localização…</p>
        )}

        <h3>Outros utilizadores ligados ({otherUsers.length})</h3>
        {otherUsers.length === 0 ? (
          <p style={{ fontSize: 13, color: "#666" }}>
            Ainda não há mais ninguém ligado.
          </p>
        ) : (
          <ul style={{ paddingLeft: 18, fontSize: 14 }}>
            {otherUsers.map((u) => (
              <li key={u.id} style={{ marginBottom: 8 }}>
                <code>{u.id.slice(0, 6)}</code>
                <br />
                Lat: {u.lat.toFixed(6)} / Lng: {u.lng.toFixed(6)}
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Mapa: mostra apenas marcadores, sem valores escritos sobre ele */}
      <main style={{ flex: 1 }}>
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
          whenCreated={(map) => (mapRef.current = map)}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {myPosition && (
            <Marker position={[myPosition.lat, myPosition.lng]} icon={meIcon}>
              <Popup>Você ({myId ? myId.slice(0, 6) : "…"})</Popup>
            </Marker>
          )}

          {otherUsers.map((u) => (
            <Marker key={u.id} position={[u.lat, u.lng]}>
              <Popup>Utilizador {u.id.slice(0, 6)}</Popup>
            </Marker>
          ))}
        </MapContainer>
      </main>
    </div>
  );
}
