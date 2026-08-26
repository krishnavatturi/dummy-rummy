import { useEffect, useMemo, useState } from "react";
import { BOT_NAMES, PRACTICE_START_CHIPS } from "./game/lobby";
import { createMatch } from "./game/engine";
import type { GameState, TableConfig, TableSeat } from "./game/types";
import { useOnline } from "./net/client";
import { HowToPlay } from "./ui/HowToPlay";
import { Landing } from "./ui/Landing";
import { Lobby } from "./ui/Lobby";
import { Room } from "./ui/Room";
import { Table } from "./ui/Table";

const KEY = "adda-rummy-profile";

type Profile = { name: string; chips: number };
type Screen = "landing" | "lobby" | "table";

function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Profile;
      if (p.name && typeof p.chips === "number") return p;
    }
  } catch {
    /* ignore */
  }
  return { name: "Player", chips: PRACTICE_START_CHIPS };
}

function saveProfile(p: Profile) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

function fillSeats(table: TableConfig, you: TableSeat): TableSeat[] {
  const seats: TableSeat[] = [you];
  const names = BOT_NAMES.filter((n) => n.toLowerCase() !== you.name.toLowerCase());
  for (let i = 0; seats.length < table.seats; i++) {
    seats.push({
      id: `bot-${i}`,
      name: names[i % names.length]!,
      isBot: true,
      avatarHue: (28 + i * 47) % 360,
    });
  }
  return seats;
}

export default function App() {
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [screen, setScreen] = useState<Screen>("landing");
  const [game, setGame] = useState<GameState | null>(null);
  const [howTo, setHowTo] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const youId = "you";
  const online = useOnline(profile.name.trim() || "Player");

  const you = useMemo<TableSeat>(
    () => ({
      id: youId,
      name: profile.name.trim() || "Player",
      isBot: false,
      avatarHue: 8,
    }),
    [profile.name],
  );

  function updateProfile(patch: Partial<Profile>) {
    setProfile((p) => {
      const next = { ...p, ...patch };
      saveProfile(next);
      return next;
    });
  }

  function sit(table: TableConfig) {
    if (table.entryFee > profile.chips) return;
    if (table.entryFee > 0) updateProfile({ chips: profile.chips - table.entryFee });
    const seed = (Date.now() ^ (Math.random() * 0xffff)) >>> 0;
    online.leave();
    setGame(createMatch(table, fillSeats(table, you), seed));
    setScreen("table");
  }

  function cashout(delta: number) {
    if (!delta) return;
    updateProfile({ chips: Math.max(0, profile.chips + delta) });
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("room")?.trim().toUpperCase();
    if (code) {
      setInviteCode(code);
      setJoinCode(code);
    }
  }, []);

  const liveGame = online.game;
  const inRoom = Boolean(online.room);

  return (
    <>
      {screen === "landing" && !inRoom && (
        <Landing
          name={profile.name}
          onName={(name) => updateProfile({ name })}
          onPlay={() => {
            if (inviteCode) {
              online.join(inviteCode);
              return;
            }
            setScreen("lobby");
          }}
          onHowTo={() => setHowTo(true)}
          inviteCode={inviteCode || undefined}
          error={inviteCode ? online.error : null}
        />
      )}
      {screen === "lobby" && !inRoom && (
        <Lobby
          name={you.name}
          chips={profile.chips}
          joinCode={joinCode}
          onJoinCode={setJoinCode}
          onSit={sit}
          onCreateOnline={(tableId) => online.create(tableId)}
          onJoinOnline={() => online.join(joinCode)}
          onlineError={online.error}
          onHowTo={() => setHowTo(true)}
          onLeave={() => setScreen("landing")}
        />
      )}
      {inRoom && !liveGame && online.room && (
        <Room
          room={online.room}
          error={online.error}
          onStart={(fillBots) => online.start(fillBots)}
          onLeave={() => {
            online.leave();
            setScreen("lobby");
          }}
        />
      )}
      {screen === "table" && game && !liveGame && (
        <Table
          game={game}
          youId={youId}
          chips={profile.chips}
          onChange={setGame}
          onCashout={cashout}
          onLeave={() => {
            setGame(null);
            setScreen("lobby");
          }}
          onHowTo={() => setHowTo(true)}
        />
      )}
      {liveGame && online.room && (
        <Table
          game={liveGame}
          youId={online.room.youId}
          chips={profile.chips}
          onChange={() => undefined}
          dispatch={online.dispatch}
          onCashout={cashout}
          onLeave={() => {
            online.leave();
            setScreen("lobby");
          }}
          onHowTo={() => setHowTo(true)}
        />
      )}
      {howTo && <HowToPlay onClose={() => setHowTo(false)} />}
    </>
  );
}