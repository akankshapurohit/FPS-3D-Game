# Arena FPS

This project is a browser-based first-person shooter (FPS) built with JavaScript and Three.js. The player enters a 3D arena, faces a hostile opponent, and uses movement and shooting mechanics to survive and win the round.

## Project Overview

Arena FPS is a lightweight 3D combat game where the player controls a first-person character inside a closed arena. The goal is to defeat the enemy AI while avoiding incoming fire and using the arena layout to your advantage.

## Features

- First-person shooting perspective
- 3D arena environment with walls, pillars, and floor lighting
- Enemy AI opponent with health bar and combat behavior
- Keyboard controls for movement and firing
- HUD with player and enemy health indicators
- Simple game loop with win/lose state and restart flow

## Controls

- Up / Down Arrow: Move forward and backward
- Left / Right Arrow: Turn left and right
- Space: Fire weapon

## How to Run

Because this is a simple front-end web game, you can run it by opening the project in a browser or serving it locally.

### Option 1: Open directly

Open `index.html` in a browser.

### Option 2: Run a local web server

From the project folder, run:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Project Files

- `index.html` — main game page and HUD structure
- `styles.css` — UI styling and overlay design
- `game.js` — game logic, 3D scene, enemy AI, shooting, and controls
- `ReameMe.md` — project documentation

## Technology Stack

- HTML5
- CSS3
- JavaScript
- Three.js

## Gameplay Summary

The player takes the role of a soldier in a futuristic arena, fighting a single enemy in a fast-paced FPS duel. The game emphasizes quick reactions, directional movement, and accurate aiming against a moving opponent.
