# Adda Rummy

Practice 13-card Indian rummy in the style of an Adda lobby: points, 101/201 pool, and deals, with wild jokers, drops, and declarations. Chips are score only — there is no real-money play.

This is an independent recreation for the Certified Uncles dummy rummy group. It is not affiliated with Adda52 or Gaussian Networks.

## Play

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Enter a table name, then either:

- **Vs bots** — sit at any Points / Pool / Deals table
- **Online** — Create room, share the 4-letter code, open a second browser, Join table, host deals (empty seats can be filled with bots)

## Rules in this build

- Two packs + printed jokers, 13 cards each
- Cut joker / wild rank (if the cut card is a printed joker, 2s are wild)
- Pure sequence required, plus a second sequence, before sets count toward a valid show
- Ace can run A-2-3 or Q-K-A, never K-A-2
- First drop 20, middle drop 40, wrong declare 80, hand capped at 80
- Arrange / Sort / Group tools on your rack; Finish declares with the selected discard

## Scripts

| Command        | What it does                         |
| -------------- | ------------------------------------ |
| `npm run dev`  | Vite + realtime WebSocket server     |
| `npm test`     | Vitest (melds, engine, net snapshots)|
| `npm run build`| Production bundle                    |

## Stack

Vite, React 19, TypeScript, `ws` room server. Game rules live in `src/game` and are covered by unit tests so the table UI stays honest.
