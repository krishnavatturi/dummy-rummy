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
- **Online** — Create room, copy the invite link from the waiting room, host deals (empty seats can be filled with bots)

## Play with friends (no git needed)

Friends only need the invite URL in a browser. They never clone this repo.

On the host machine:

```bash
npm install
npm run share
```

That builds the app, serves UI + realtime on one port, and opens a public tunnel. Works on Windows and macOS/Linux. Watch the terminal for:

- `You (this PC): http://localhost:4173` — open this yourself
- `Friends open this URL` — send that public link (appears after the tunnel starts)

The waiting room then shows a **Copy link** button (`/?room=CODE`). Send that URL. Friends enter a name and sit.

Online play (including `npm run share`) is on branch `cursor/online-multiplayer-a1c0` until PR #2 is merged into `main`.

Same Wi-Fi without a tunnel: `npm run dev` (or `npm start` after a build) and copy the LAN link from the waiting room.

| Command         | What it does                                      |
| --------------- | ------------------------------------------------- |
| `npm run share` | Production build + public tunnel (friends join)   |
| `npm run share:dev` | Tunnel the Vite dev server (`localhost:5173`) |
| `npm start`     | Serve the built app + WebSocket on port 8787      |

Set `PUBLIC_URL` if you already have a public origin (skip the tunnel). Practice chips only.

## Host online (HTTPS, for friends)

Do **not** expose your home PC. `npm run share` / localtunnel is a quick demo, not a secure host. Put the app on a small HTTPS host so friends get `https://…` and `wss://…`.

### Fly.io (recommended)

1. Install the [Fly CLI](https://fly.io/docs/flyctl/install/) and sign in: `fly auth login`
2. From this repo (branch `cursor/online-multiplayer-a1c0` until it is merged):

```bash
git pull
fly launch --yes --copy-config=false --name adda-rummy-friends
fly deploy
```

3. Open the `https://….fly.dev` URL Fly prints. Create a room, **Copy link**, send that to friends.
4. Keep a machine running while you play (`fly scale count 1`) so the table does not sleep mid-hand.

Railway works the same way: new project → deploy this repo → it picks up the `Dockerfile`. Set `PUBLIC_URL=https://your-app.up.railway.app` if invite links still show an internal host.

The container serves the UI and WebSocket on one port (`PORT`, default 8080). The platform terminates TLS. Room codes are the only gate — do not post the site publicly.

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
| `npm test`     | Vitest (melds, engine, net, invites) |
| `npm run build`| Production bundle                    |

## Stack

Vite, React 19, TypeScript, `ws` room server. Game rules live in `src/game` and are covered by unit tests so the table UI stays honest.
