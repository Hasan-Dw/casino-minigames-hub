::: {align="center"}
# ♛ The Royal Dealer

### A Virtual Casino Experience

**Four classic casino games. One royal table. Virtual chips only.**

[![JavaScript](https://img.shields.io/badge/JavaScript-ES_Modules-f7df1e?style=for-the-badge&logo=javascript&logoColor=111111)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![HTML5](https://img.shields.io/badge/HTML5-Structure-e34f26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-Styling-1572b6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
:::

------------------------------------------------------------------------

## Overview

**The Royal Dealer** is a browser-based casino mini-games hub that
brings four familiar casino games together in a single, themed
interface. Players enter with a local profile, receive a starting
balance of fictional chips, and can play rounds, review their activity,
and track their statistics.

The project is built with native **HTML, CSS, and JavaScript ES
modules**, with no framework or package installation required.

> **Important:** This is an entertainment and educational project. It
> does not involve real-money gambling, deposits, withdrawals, or
> prizes. Virtual chips have no monetary value.

## Games

  -----------------------------------------------------------------------
  Game                                Description
  ----------------------------------- -----------------------------------
  ♠ **Blackjack**                     Play against the dealer, with Hit,
                                      Stand, and Double Down actions.
                                      Natural blackjack pays 3:2.

  ◉ **Roulette**                      European single-zero roulette with
                                      straight, split, street, corner,
                                      six-line, color, parity, range,
                                      dozen, and column bets.

  ✦ **Slot Machine**                  Spin three reels and try to match
                                      symbols. Includes a configurable
                                      paytable and cherry-pair payout.

  ♦ **Baccarat**                      Punto Banco gameplay with Player,
                                      Banker, and Tie bets.
  -----------------------------------------------------------------------

## Features

-   **Unified game lobby** with navigation between all games.
-   **Virtual chip economy** starting at 10,000 chips, with configurable
    minimum and maximum bets.
-   **Persistent player data** for balance, profile, settings, history,
    and statistics using browser `localStorage`.
-   **Game history** with filters for game and result.
-   **Statistics dashboard** summarizing recorded gameplay.
-   **Player entrance screen** with username and age input.
-   **Audio controls** for sound effects and lobby music.
-   **Motion and animation controls**, including reduced-motion support.
-   **Responsive casino-themed interface** with game-specific table
    layouts.
-   **Randomness and card-service fallbacks** designed to keep supported
    gameplay available when external services cannot be reached.

## Built With

-   **HTML5** --- semantic page structure.
-   **CSS3** --- layout, casino theme, responsive styling, and
    animations.
-   **Vanilla JavaScript (ES Modules)** --- game logic, application
    state, and UI interactions.
-   **Browser Local Storage** --- persistence of local profile, balance,
    settings, history, and statistics.
-   **Web Crypto API** --- local cryptographic randomness.
-   **Deck of Cards API** --- remote card deck and draw operations, with
    a local deck fallback.
-   **Random.org API** --- an external randomness source where
    supported, with Web Crypto fallback in the standard random flow.

## Getting Started

This is a static front-end project. There is no `npm install` step.

### 1. Clone the repository

``` bash
git clone https://github.com/Hasan-Dw/casino-minigames-hub.git
cd casino-minigames-hub
```

### 2. Run a local web server

Because the application uses JavaScript ES modules, open it through a
local HTTP server rather than directly through the `file://` protocol.

**Option A --- VS Code Live Server**

1.  Open the project folder in Visual Studio Code.
2.  Install the **Live Server** extension if needed.
3.  Right-click `index.html`.
4.  Select **Open with Live Server**.

**Option B --- Python**

``` bash
python -m http.server 8000
```

Then open:

``` text
http://localhost:8000
```

## Project Structure

``` text
casino-minigames-hub/
│
├── index.html
│
├── css/
│   ├── main.css
│   ├── casino-theme.css
│   ├── animations.css
│   ├── gate.css
│   ├── blackjack.css
│   ├── roulette.css
│   ├── slots.css
│   └── baccarat.css
│
└── js/
    ├── app.js
    │
    ├── api/
    │   ├── DeckAPI.js
    │   └── RandomAPI.js
    │
    ├── core/
    │   ├── BalanceManager.js
    │   ├── GameManager.js
    │   ├── HistoryManager.js
    │   ├── RNGManager.js
    │   ├── StatisticsManager.js
    │   └── StorageManager.js
    │
    ├── games/
    │   ├── Baccarat.js
    │   ├── Blackjack.js
    │   ├── Roulette.js
    │   └── SlotMachine.js
    │
    ├── ui/
    │   ├── AnimationManager.js
    │   ├── CardRenderer.js
    │   ├── LobbyMusicManager.js
    │   ├── ModalManager.js
    │   ├── NotificationManager.js
    │   ├── SoundManager.js
    │   └── UIManager.js
    │
    └── utils/
        ├── constants.js
        ├── formatters.js
        └── helpers.js
```

## Data & Privacy

Player information and gameplay records are stored locally in the
browser using `localStorage`. The project does not implement a
server-side account system or cloud synchronization.

Clearing the browser's site data may remove the locally stored profile,
balance, settings, history, and statistics.

Some gameplay functionality can request data from external services. An
internet connection may therefore be needed for those integrations;
fallback behavior is implemented for the card service and the standard
random-number flow.

## Disclaimer

The Royal Dealer is intended for **educational and entertainment
purposes only**. All chips are fictional, cannot be purchased or
redeemed, and have no real-world monetary value. The project is not a
real gambling service.

## Author

**Hasan Dw**

-   GitHub: [@Hasan-Dw](https://github.com/Hasan-Dw)
-   Repository:
    [casino-minigames-hub](https://github.com/Hasan-Dw/casino-minigames-hub)

------------------------------------------------------------------------

::: {align="center"}
**Enjoy the games. Play with virtual chips.**
:::
