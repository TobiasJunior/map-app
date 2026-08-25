import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { socket } from "./socket";
import "./App.css";

// Marcador circular "blip" (em vez do pin padrão do Leaflet), com um anel
// a pulsar — a linguagem visual de um radar/GPS em vez de um mapa de moradas.
function blipIcon(isSelf) {
  return L.divIcon({
    className: "",
    html: `<div class="map-blip${isSelf ? " self" : ""}">
             <div class="ring"></div>
             <div class="core"></div>
           </div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  });
}

const SELF_ICON = blipIcon(true);
const OTHER_ICON = blipIcon(false);

const DEFAULT_CENTER = [-25.9655, 32.5832]; // Maputo, ponto de partida por omissão

function formatCoord(n) {
  return n.toFixed(6);
}

function timeAgo(ts) {
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seconds < 2) return "agora";
  if (seconds < 60) return `há ${seconds}s`;
  const mins = Math.round(seconds / 60);
  return `há ${mins}min`;
}

export default function App() {
  const [myId, setMyId] = useState(null);
  const [myPosition, setMyPosition] = useState(null);
  const [users, setUsers] = useState([]);
  const [geoError, setGeoError] = useState(null);
  const [connected, setConnected] = useState(socket.connected);
  const [, forceTick] = useState(0); // re-render periódico para atualizar "há Xs"

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
      () => {
        setGeoError(
          "Não foi possível obter a sua localização — verifique as permissões do navegador."
        );
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Centra o mapa na posição do utilizador assim que ela é conhecida
  // pela primeira vez, sem voltar a "puxar" o mapa depois disso.
  useEffect(() => {
    if (myPosition && mapRef.current && !hasCentered.current) {
      mapRef.current.setView([myPosition.lat, myPosition.lng], 14);
      hasCentered.current = true;
    }
  }, [myPosition]);

  // Atualiza os textos "há Xs" a cada segundo, sem depender de novos dados.
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const otherUsers = users.filter((u) => u.id !== myId);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="eyebrow">
            <span className={`eyebrow-dot${connected ? "" : " offline"}`} />
            {connected ? "telemetria ao vivo" : "sem ligação"}
          </div>
          <h1>Map App</h1>
          <p>Posições de todos os utilizadores ligados, em tempo real.</p>
        </div>

        <div className="sidebar-scroll">
          <div className="section-label">A sua posição</div>

          {myPosition ? (
            <div className="self-card">
              <div className="self-card-head">
                <span className="blip-dot" />
                <span className="label">VOCÊ · {myId ? myId.slice(0, 6) : "…"}</span>
              </div>
              <div className="coord-grid">
                <div className="coord-field">
                  <div className="k">Latitude</div>
                  <div className="v pulse-update" key={`lat-${myPosition.lat}`}>
                    {formatCoord(myPosition.lat)}
                  </div>
                </div>
                <div className="coord-field">
                  <div className="k">Longitude</div>
                  <div className="v pulse-update" key={`lng-${myPosition.lng}`}>
                    {formatCoord(myPosition.lng)}
                  </div>
                </div>
              </div>
              {geoError && <div className="status-line error">{geoError}</div>}
            </div>
          ) : (
            <div className="pending">
              {geoError ? (
                <span className="status-line error">{geoError}</span>
              ) : (
                "A obter sinal de localização…"
              )}
            </div>
          )}

          <div className="section-label">
           Outros Utilizadores ligados
            <span className="count">{otherUsers.length}</span>
          </div>

          {otherUsers.length === 0 ? (
            <div className="empty-state">
              Ninguém mais está ligado neste momento.
              <br />
              Abra este link noutro dispositivo para ver aqui.
            </div>
          ) : (
            otherUsers.map((u) => (
              <div className="user-row" key={u.id}>
                <span className="blip-dot other" />
                <div className="user-row-body">
                  <div className="user-row-top">
                    <span className="user-id">{u.id.slice(0, 6)}</span>
                    {u.updatedAt && (
                      <span className="user-age">{timeAgo(u.updatedAt)}</span>
                    )}
                  </div>
                  <div
                    className="user-coords pulse-update"
                    key={`${u.id}-${u.lat}-${u.lng}`}
                  >
                    {formatCoord(u.lat)}, {formatCoord(u.lng)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      <main className="map-area">
        {!connected && (
          <div className="conn-banner">
            ⚠ ligação ao servidor perdida — a tentar reconectar…
          </div>
        )}

        <MapContainer
          center={DEFAULT_CENTER}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
          whenCreated={(map) => (mapRef.current = map)}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {myPosition && (
            <Marker position={[myPosition.lat, myPosition.lng]} icon={SELF_ICON}>
              <Popup>
                <div className="popup-inner">
                  <strong>Você</strong> · {myId ? myId.slice(0, 6) : "…"}
                  <br />
                  {formatCoord(myPosition.lat)}, {formatCoord(myPosition.lng)}
                </div>
              </Popup>
            </Marker>
          )}

          {otherUsers.map((u) => (
            <Marker key={u.id} position={[u.lat, u.lng]} icon={OTHER_ICON}>
              <Popup>
                <div className="popup-inner">
                  <strong>Utilizador</strong> · {u.id.slice(0, 6)}
                  <br />
                  {formatCoord(u.lat)}, {formatCoord(u.lng)}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        <div className="radar-sweep" aria-hidden="true" />
      </main>
    </div>
  );
}
