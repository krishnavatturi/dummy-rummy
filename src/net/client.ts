import { useCallback, useEffect, useRef, useState } from "react";
import type { GameAction } from "../game/actions";
import { hydrateGame, type WireGame } from "../game/net";
import type { GameState, TableConfig } from "../game/types";

export type RoomPlayer = { id: string; name: string; avatarHue: number };

export type RoomView = {
  code: string;
  table: TableConfig;
  hostId: string;
  youId: string;
  started: boolean;
  players: RoomPlayer[];
};

type ServerMsg =
  | { t: "hello"; playerId: string }
  | { t: "room"; room: RoomView }
  | { t: "state"; game: WireGame }
  | { t: "error"; message: string };

function wsUrl() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws`;
}

export function useOnline(name: string) {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const nameRef = useRef(name);
  nameRef.current = name;

  const send = useCallback((msg: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= 1) return;
    const ws = new WebSocket(wsUrl());
    wsRef.current = ws;
    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ t: "hello", name: nameRef.current }));
    };
    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
    };
    ws.onerror = () => setError("Could not reach the adda server.");
    ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data)) as ServerMsg;
      if (msg.t === "hello") setPlayerId(msg.playerId);
      if (msg.t === "room") {
        setRoom(msg.room);
        setError(null);
        if (!msg.room.started) setGame(null);
      }
      if (msg.t === "state") setGame(hydrateGame(msg.game));
      if (msg.t === "error") setError(msg.message);
    };
  }, []);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (connected) send({ t: "hello", name });
  }, [name, connected, send]);

  const whenOpen = useCallback(
    (fn: () => void) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        fn();
        return;
      }
      const t = window.setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          window.clearInterval(t);
          fn();
        }
      }, 50);
      window.setTimeout(() => window.clearInterval(t), 4000);
    },
    [],
  );

  const create = useCallback(
    (tableId: string) => {
      setError(null);
      connect();
      whenOpen(() => {
        send({ t: "hello", name: nameRef.current });
        send({ t: "create", tableId });
      });
    },
    [connect, send, whenOpen],
  );

  const join = useCallback(
    (code: string) => {
      setError(null);
      connect();
      whenOpen(() => {
        send({ t: "hello", name: nameRef.current });
        send({ t: "join", code: code.trim().toUpperCase() });
      });
    },
    [connect, send, whenOpen],
  );

  const start = useCallback(
    (fillBots = true) => send({ t: "start", fillBots }),
    [send],
  );

  const dispatch = useCallback(
    (action: GameAction) => send({ t: "action", action }),
    [send],
  );

  const leave = useCallback(() => {
    send({ t: "leave" });
    setRoom(null);
    setGame(null);
  }, [send]);

  return { playerId, room, game, error, connected, connect, create, join, start, dispatch, leave, setError };
}