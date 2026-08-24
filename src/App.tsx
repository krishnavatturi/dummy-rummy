import { useMemo, useState } from "react";
import { BOT_NAMES, PRACTICE_START_CHIPS } from "./game/lobby";
import { createMatch } from "./game/engine";
import type { GameState, TableConfig, TableSeat } from "./game/types";
import { HowToPlay } from "./ui/HowToPlay";
import { Landing } from "./ui/Landing";
import { Lobby } from "./ui/Lobby";
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
  const youId = "you";

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
    setGame(createMatch(table, fillSeats(table, you), seed));
    setScreen("table");
  }

  function cashout(delta: number) {
    if (!delta) return;
    updateProfile({ chips: Math.max(0, profile.chips + delta) });
  }

  return (
    <>
      {screen === "landing" && (
        <Landing
          name={profile.name}
          onName={(name) => updateProfile({ name })}
          onPlay={() => setScreen("lobby")}
          onHowTo={() => setHowTo(true)}
        />
      )}
      {screen === "lobby" && (
        <Lobby
          name={you.name}
          chips={profile.chips}
          onSit={sit}
          onHowTo={() => setHowTo(true)}
          onLeave={() => setScreen("landing")}
        />
      )}
      {screen === "table" && game && (
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
      {howTo && <HowToPlay onClose={() => setHowTo(false)} />}
    </>
  );
}
