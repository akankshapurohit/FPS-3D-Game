const ARENA = 36;
const HALF = ARENA / 2;
const PLAYER_RADIUS = 0.45;
const ENEMY_RADIUS = 0.5;
const EYE_HEIGHT = 1.62;
const MOVE_SPEED = 9;
const TURN_SPEED = 2.35;
const PLAYER_DAMAGE = 22;
const ENEMY_DAMAGE = 11;
const PLAYER_COOLDOWN = 0.22;
const ENEMY_COOLDOWN = 0.85;
const MAX_HEALTH = 100;

const keys = new Set();
const obstacles = [];
const coverMeshes = [];

const canvas = document.getElementById("game-canvas");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayCopy = document.getElementById("overlay-copy");
const startBtn = document.getElementById("start-btn");
const playerHealthEl = document.getElementById("player-health");
const enemyHealthEl = document.getElementById("enemy-health");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1018);
scene.fog = new THREE.Fog(0x0a1018, 28, 62);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.08,
  80
);
scene.add(camera);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const tracerMat = new THREE.LineBasicMaterial({
  color: 0x9af0ff,
  transparent: true,
  opacity: 0.9,
});

const state = {
  running: false,
  over: false,
  playerHealth: MAX_HEALTH,
  enemyHealth: MAX_HEALTH,
  yaw: 0,
  shootCd: 0,
  enemyCd: 0,
  spawnProtect: 0,
  muzzle: 0,
  enemyFlash: 0,
};

const player = {
  position: new THREE.Vector3(0, 0, 12),
};

const enemy = {
  position: new THREE.Vector3(0, 0, -12),
  yaw: 0,
  strafe: 1,
  nextStrafe: 1.4,
};

function gridTexture(colorA, colorB, cells = 16) {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.fillStyle = colorA;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = colorB;
  const step = size / cells;
  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      if ((x + y) % 2 === 0) ctx.fillRect(x * step, y * step, step, step);
    }
  }
  ctx.strokeStyle = "rgba(126,224,255,0.18)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= cells; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addBoxObstacle(mesh, extra = 0) {
  mesh.updateMatrixWorld();
  const box = new THREE.Box3().setFromObject(mesh);
  box.expandByScalar(extra);
  obstacles.push(box);
  coverMeshes.push(mesh);
}

function buildArena() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA, ARENA),
    new THREE.MeshStandardMaterial({
      map: gridTexture("#101820", "#15202c"),
      roughness: 0.82,
      metalness: 0.12,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x1a2836,
    roughness: 0.7,
    metalness: 0.2,
    emissive: 0x041018,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x7ee0ff,
    emissive: 0x1b6f88,
    roughness: 0.35,
  });

  const wallH = 6;
  const wallT = 1.2;
  const walls = [
    { x: 0, z: -HALF - wallT / 2, w: ARENA + wallT * 2, d: wallT },
    { x: 0, z: HALF + wallT / 2, w: ARENA + wallT * 2, d: wallT },
    { x: -HALF - wallT / 2, z: 0, w: wallT, d: ARENA },
    { x: HALF + wallT / 2, z: 0, w: wallT, d: ARENA },
  ];
  walls.forEach((w) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w.w, wallH, w.d), wallMat);
    mesh.position.set(w.x, wallH / 2, w.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    addBoxObstacle(mesh);
  });

  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(ARENA - 0.4, 0.12, ARENA - 0.4),
    trimMat
  );
  trim.position.y = 0.08;
  scene.add(trim);

  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x243444,
    roughness: 0.55,
    metalness: 0.25,
  });
  const pillarPositions = [
    [-7.5, -7.5],
    [7.5, -7.5],
    [-7.5, 7.5],
    [7.5, 7.5],
    [0, 0],
  ];
  pillarPositions.forEach(([x, z], i) => {
    const h = i === 4 ? 3.4 : 4.6;
    const geo =
      i === 4
        ? new THREE.CylinderGeometry(1.15, 1.35, h, 16)
        : new THREE.BoxGeometry(2.2, h, 2.2);
    const mesh = new THREE.Mesh(geo, pillarMat);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    addBoxObstacle(mesh, 0.05);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(i === 4 ? 1.25 : 1.15, 0.06, 8, 24),
      trimMat
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 1.4, z);
    scene.add(ring);
  });

  scene.add(new THREE.HemisphereLight(0xb7d4ee, 0x121820, 0.55));
  const sun = new THREE.DirectionalLight(0xd7ecff, 1.05);
  sun.position.set(8, 16, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  scene.add(sun);

  const neon = new THREE.PointLight(0x7ee0ff, 7.5, 28);
  neon.position.set(0, 4.2, 0);
  scene.add(neon);
  const red = new THREE.PointLight(0xff5d6c, 10, 22);
  red.position.set(0, 3.4, -14);
  scene.add(red);
}

const gun = new THREE.Group();
function buildGun() {
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.14, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x1c242c, metalness: 0.6, roughness: 0.35 })
  );
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.035, 0.38, 10),
    new THREE.MeshStandardMaterial({ color: 0x8aa0b0, metalness: 0.8, roughness: 0.25 })
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, -0.32);
  const mag = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.16, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x11161b, metalness: 0.4, roughness: 0.45 })
  );
  mag.position.set(0, -0.12, 0.02);
  gun.add(body, barrel, mag);
  gun.position.set(0.32, -0.28, -0.62);
  camera.add(gun);

  const flash = new THREE.PointLight(0x9af0ff, 0, 6);
  flash.name = "muzzle";
  flash.position.set(0, 0.02, -0.55);
  gun.add(flash);
}

const enemyGroup = new THREE.Group();
const enemyParts = [];
function buildEnemy() {
  const skin = new THREE.MeshStandardMaterial({
    color: 0xc45a63,
    roughness: 0.45,
    metalness: 0.15,
    emissive: 0x3a1014,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x2a333c,
    roughness: 0.5,
    metalness: 0.2,
  });
  const armor = new THREE.MeshStandardMaterial({
    color: 0x3f4b57,
    roughness: 0.55,
    metalness: 0.25,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: 0xff8a94,
    emissive: 0xff3344,
    emissiveIntensity: 1.5,
  });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.9, 0.44), skin);
  torso.position.y = 1.18;
  torso.castShadow = true;

  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.48, 0.18), armor);
  chestPlate.position.set(0, 1.18, 0.2);
  chestPlate.castShadow = true;

  const waist = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.2, 0.3), dark);
  waist.position.y = 0.72;
  waist.castShadow = true;

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.18, 12), skin);
  neck.position.y = 1.7;
  neck.castShadow = true;

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.38), skin);
  head.position.y = 1.95;
  head.castShadow = true;

  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.18, 0.46), dark);
  helmet.position.set(0, 2.15, 0);
  helmet.castShadow = true;

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.1), accent);
  visor.position.set(0, 2.0, 0.22);

  const earLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.06), skin);
  earLeft.position.set(-0.21, 2.0, 0);
  const earRight = earLeft.clone();
  earRight.position.x = 0.21;

  const faceDetail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.02), accent);
  faceDetail.position.set(0, 1.94, 0.23);

  const lamp = new THREE.PointLight(0xff5d6c, 3.8, 8);
  lamp.position.set(0, 1.95, 0.45);

  const shoulderLeft = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), armor);
  shoulderLeft.position.set(-0.5, 1.58, 0);
  const shoulderRight = shoulderLeft.clone();
  shoulderRight.position.x = 0.5;

  const upperArmGeometry = new THREE.BoxGeometry(0.18, 0.56, 0.18);
  const lArm = new THREE.Mesh(upperArmGeometry, dark);
  lArm.position.set(-0.68, 1.18, 0);
  lArm.castShadow = true;
  const rArm = lArm.clone();
  rArm.position.x = 0.68;

  const forearmLeft = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.54, 0.16), armor);
  forearmLeft.position.set(-0.68, 0.68, 0.04);
  forearmLeft.castShadow = true;
  const forearmRight = forearmLeft.clone();
  forearmRight.position.x = 0.68;

  const handLeft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), skin);
  handLeft.position.set(-0.68, 0.3, 0.09);
  const handRight = handLeft.clone();
  handRight.position.x = 0.68;

  const thighGeo = new THREE.BoxGeometry(0.22, 0.72, 0.22);
  const lLeg = new THREE.Mesh(thighGeo, dark);
  lLeg.position.set(-0.2, 0.36, 0);
  lLeg.castShadow = true;
  const rLeg = lLeg.clone();
  rLeg.position.x = 0.2;

  const shinLeft = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.66, 0.18), armor);
  shinLeft.position.set(-0.2, -0.35, 0.04);
  shinLeft.castShadow = true;
  const shinRight = shinLeft.clone();
  shinRight.position.x = 0.2;

  const bootLeft = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.4), dark);
  bootLeft.position.set(-0.2, -0.78, 0.09);
  const bootRight = bootLeft.clone();
  bootRight.position.x = 0.2;

  enemyParts.push(
    torso,
    chestPlate,
    waist,
    head,
    helmet,
    visor,
    faceDetail,
    shoulderLeft,
    shoulderRight,
    lArm,
    rArm,
    forearmLeft,
    forearmRight,
    handLeft,
    handRight,
    lLeg,
    rLeg,
    shinLeft,
    shinRight,
    bootLeft,
    bootRight
  );

  enemyGroup.add(
    torso,
    chestPlate,
    waist,
    neck,
    head,
    helmet,
    visor,
    earLeft,
    earRight,
    faceDetail,
    shoulderLeft,
    shoulderRight,
    lArm,
    rArm,
    forearmLeft,
    forearmRight,
    handLeft,
    handRight,
    lLeg,
    rLeg,
    shinLeft,
    shinRight,
    bootLeft,
    bootRight,
    lamp
  );
  scene.add(enemyGroup);
}

const tracers = [];
function spawnTracer(from, to, color) {
  const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
  const mat = tracerMat.clone();
  mat.color = new THREE.Color(color);
  const line = new THREE.Line(geo, mat);
  line.userData.life = 0.08;
  scene.add(line);
  tracers.push(line);
}

function collides(x, z, radius) {
  const point = new THREE.Vector3(x, 1, z);
  for (const box of obstacles) {
    const closest = box.clampPoint(point, new THREE.Vector3());
    const dx = closest.x - x;
    const dz = closest.z - z;
    if (dx * dx + dz * dz < radius * radius) return true;
  }
  return Math.abs(x) > HALF - radius || Math.abs(z) > HALF - radius;
}

function tryMove(entity, nx, nz, radius) {
  if (!collides(nx, entity.position.z, radius)) entity.position.x = nx;
  if (!collides(entity.position.x, nz, radius)) entity.position.z = nz;
}

function losBlocked(from, to) {
  const dir = to.clone().sub(from);
  const dist = dir.length();
  if (dist < 0.001) return true;
  dir.normalize();
  raycaster.set(from, dir);
  raycaster.far = dist - 0.4;
  const hits = raycaster.intersectObjects(coverMeshes, false);
  return hits.length > 0 && hits[0].distance < dist - 0.45;
}

function updateHealthBars() {
  playerHealthEl.style.width = `${Math.max(state.playerHealth, 0)}%`;
  enemyHealthEl.style.width = `${Math.max(state.enemyHealth, 0)}%`;
}

function endGame(won) {
  state.running = false;
  state.over = true;
  overlay.classList.remove("hidden");
  overlayTitle.textContent = won ? "Arena Clear" : "Down";
  overlayCopy.textContent = won
    ? "The computer opponent is out. Enter the arena again for another round."
    : "You were taken out. Recenter, then try a different angle around the pillars.";
  startBtn.textContent = "Play Again";
}

function resetMatch() {
  state.playerHealth = MAX_HEALTH;
  state.enemyHealth = MAX_HEALTH;
  state.yaw = 0;
  state.shootCd = 0;
  state.enemyCd = 1.8;
  state.spawnProtect = 1.6;
  state.over = false;
  player.position.set(6, 0, 12);
  enemy.position.set(-2, 0, -8);
  enemy.yaw = 0;
  enemy.strafe = Math.random() < 0.5 ? -1 : 1;
  updateHealthBars();
}

function playerShoot() {
  if (state.shootCd > 0) return;
  state.shootCd = PLAYER_COOLDOWN;
  state.muzzle = 0.06;

  const origin = camera.getWorldPosition(new THREE.Vector3());
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  raycaster.set(origin, dir);
  raycaster.far = 50;

  const hits = raycaster.intersectObjects(enemyParts, false);
  let end = origin.clone().add(dir.clone().multiplyScalar(40));
  let hitEnemy = false;
  if (hits.length) {
    const first = hits[0];
    if (!losBlocked(origin, first.point)) {
      hitEnemy = true;
      end = first.point;
    }
  }
  spawnTracer(origin.clone().add(dir.clone().multiplyScalar(0.8)), end, 0x9af0ff);
  if (hitEnemy) {
    state.enemyHealth -= PLAYER_DAMAGE;
    state.enemyFlash = 0.12;
    if (state.enemyHealth <= 0) {
      state.enemyHealth = 0;
      updateHealthBars();
      endGame(true);
    }
  }
}

function enemyShoot() {
  if (state.spawnProtect > 0) return;
  const from = enemy.position.clone().setY(1.55);
  const to = player.position.clone().setY(EYE_HEIGHT);
  if (losBlocked(from, to)) return;
  state.enemyCd = ENEMY_COOLDOWN;

  const miss = (Math.random() - 0.5) * 0.18;
  const aimed = to.clone();
  aimed.x += miss;
  spawnTracer(from, aimed, 0xff6b78);

  const dist = from.distanceTo(to);
  const spreadChance = 0.18 + dist * 0.012;
  if (Math.random() > spreadChance) {
    state.playerHealth -= ENEMY_DAMAGE;
    if (state.playerHealth <= 0) {
      state.playerHealth = 0;
      updateHealthBars();
      endGame(false);
    }
  }
}

function updatePlayer(dt) {
  if (keys.has("arrowleft")) state.yaw += TURN_SPEED * dt;
  if (keys.has("arrowright")) state.yaw -= TURN_SPEED * dt;

  const forward = new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
  let move = 0;
  if (keys.has("arrowup")) move += 1;
  if (keys.has("arrowdown")) move -= 1;
  if (move) {
    const step = forward.multiplyScalar(move * MOVE_SPEED * dt);
    tryMove(player, player.position.x + step.x, player.position.z + step.z, PLAYER_RADIUS);
  }

  camera.position.set(player.position.x, EYE_HEIGHT, player.position.z);
  camera.rotation.set(0, state.yaw, 0);

  if (keys.has(" ") || keys.has("spacebar") || keys.has("space")) playerShoot();

  const flash = gun.getObjectByName("muzzle");
  flash.intensity = state.muzzle > 0 ? 12 : 0;
  gun.position.z = -0.62 + (state.muzzle > 0 ? 0.04 : 0);
}

function updateEnemy(dt) {
  const toPlayer = player.position.clone().sub(enemy.position);
  toPlayer.y = 0;
  const dist = toPlayer.length();
  const dir =
    dist > 0.001 ? toPlayer.clone().normalize() : new THREE.Vector3(0, 0, 1);
  enemy.yaw = Math.atan2(dir.x, dir.z);

  enemy.nextStrafe -= dt;
  if (enemy.nextStrafe <= 0) {
    enemy.strafe *= -1;
    enemy.nextStrafe = 0.8 + Math.random() * 1.4;
  }

  const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(enemy.strafe);
  const desired = new THREE.Vector3();
  if (dist > 9) desired.addScaledVector(dir, 1.15);
  else if (dist < 5.5) desired.addScaledVector(dir, -0.9);
  desired.add(side.multiplyScalar(0.85));

  if (desired.lengthSq() > 0) {
    desired.normalize().multiplyScalar(5.4 * dt);
    tryMove(
      enemy,
      enemy.position.x + desired.x,
      enemy.position.z + desired.z,
      ENEMY_RADIUS
    );
  }

  enemyGroup.position.set(enemy.position.x, 0, enemy.position.z);
  enemyGroup.rotation.y = enemy.yaw;
  const pulse = state.enemyFlash > 0 ? 0.55 : 0;
  enemyParts[0].material.emissive.setRGB(0.35 + pulse, 0.05, 0.08);

  const from = enemy.position.clone().setY(1.55);
  const to = player.position.clone().setY(EYE_HEIGHT);
  if (state.enemyCd <= 0 && dist < 22 && !losBlocked(from, to)) enemyShoot();
}

function updateTracers(dt) {
  for (let i = tracers.length - 1; i >= 0; i -= 1) {
    const line = tracers[i];
    line.userData.life -= dt;
    line.material.opacity = Math.max(line.userData.life / 0.08, 0);
    if (line.userData.life <= 0) {
      scene.remove(line);
      line.geometry.dispose();
      line.material.dispose();
      tracers.splice(i, 1);
    }
  }
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  requestAnimationFrame(tick);
  if (state.running) {
    state.shootCd = Math.max(0, state.shootCd - dt);
    state.enemyCd = Math.max(0, state.enemyCd - dt);
    state.spawnProtect = Math.max(0, state.spawnProtect - dt);
    state.muzzle = Math.max(0, state.muzzle - dt);
    state.enemyFlash = Math.max(0, state.enemyFlash - dt);
    updatePlayer(dt);
    updateEnemy(dt);
    updateHealthBars();
  } else {
    camera.position.set(player.position.x, EYE_HEIGHT, player.position.z);
    camera.rotation.set(0, state.yaw, 0);
  }
  updateTracers(dt);
  renderer.render(scene, camera);
}

window.addEventListener("keydown", (e) => {
  keys.add(e.key.toLowerCase());
  if (e.code === "Space") keys.add(" ");
  if (
    ["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(
      e.key.toLowerCase()
    ) ||
    e.code === "Space"
  ) {
    e.preventDefault();
  }
});
window.addEventListener("keyup", (e) => {
  keys.delete(e.key.toLowerCase());
  if (e.code === "Space") keys.delete(" ");
});
window.addEventListener("blur", () => keys.clear());
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

startBtn.addEventListener("click", () => {
  resetMatch();
  overlay.classList.add("hidden");
  state.running = true;
});

buildArena();
buildGun();
buildEnemy();
resetMatch();
tick();
