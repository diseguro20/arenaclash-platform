'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';
import confetti from 'canvas-confetti';

interface PlayerProfile {
  name: string;
  phone: string;
  saldo: number;
  bonus: number;
  avatar: string;
  victories: number;
}

// Collapsing Platform Data Interface
interface FallingTile {
  mesh: THREE.Mesh;
  initialY: number;
  isStepped: boolean;
  stepTimer: number;
  isFalling: boolean;
  fallSpeed: number;
  isRespawning: boolean;
  respawnTimer: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

// Swinging Pendulum Data Interface
interface SwingingPendulum {
  group: THREE.Group;
  pivotObj: THREE.Object3D;
  hammerMesh: THREE.Mesh;
  speed: number;
  limit: number;
  offset: number;
}

// Movable Pusher Data Interface
interface MovableObstacle {
  mesh: THREE.Mesh;
  startZ: number;
  distance: number;
  speed: number;
  dir: number;
  bounds: { minX: number; maxX: number; halfDepth: number };
}

// Spinning Rotator Data Interface
interface SpinnerObstacle {
  group: THREE.Group;
  centerX: number;
  centerZ: number;
  radius: number;
  speed: number;
}

// Bounce Pad Data Interface
interface BouncePad {
  mesh: THREE.Mesh;
  ringMesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  radius: number;
  force: number;
}

// Collectible Coin Data Interface
interface CoinObject {
  mesh: THREE.Group;
  collected: boolean;
}

// Knockdown Physics Cube Interface
interface RBCube {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  groundY: number;
}

// Solid Platform Definition for Continuous Collision
interface PlatformBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  surfaceY: number;
}

export default function GamePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<PlayerProfile>({
    name: 'Diego Seguro',
    phone: '11982854183',
    saldo: 1000.0,
    bonus: 0.0,
    avatar: '/images/character_1_25.webp',
    victories: 16
  });

  // UI Navigation State
  const [activeScreen, setActiveScreen] = useState<'lobby' | 'modes' | 'customization' | 'friends' | 'playing' | 'victory' | 'gameover'>('lobby');
  const [selectedMode, setSelectedMode] = useState<'maratona' | 'trio' | 'x1'>('maratona');
  const [selectedFee, setSelectedFee] = useState<number>(5.0);
  const [selectedColor, setSelectedColor] = useState<string>('#ff2d75'); // Fall Guys Classic Vibrant Pink
  const [selectedCharId, setSelectedCharId] = useState<number>(1);
  const [roomCode, setRoomCode] = useState<string>('');
  const [inputCode, setInputCode] = useState<string>('');
  const [activeRaceId, setActiveRaceId] = useState<string>('');

  // Live HUD In-Game State
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [lives, setLives] = useState<number>(3);
  const [courseProgress, setCourseProgress] = useState<number>(0); // 0 to 100%
  const [countdown, setCountdown] = useState<number | null>(null);
  const [winnings, setWinnings] = useState<number>(0);

  // WebGL Mount Ref
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Touch Controls State
  const touchJoystick = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    dx: number; // -1 to 1
    dy: number; // -1 to 1
    touchId: number | null;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
    touchId: null
  });

  // Touch Camera Look State
  const touchLook = useRef<{
    active: boolean;
    lastX: number;
    lastY: number;
    touchId: number | null;
  }>({
    active: false,
    lastX: 0,
    lastY: 0,
    touchId: null
  });

  // Mouse Orbit State
  const mouseOrbit = useRef<{
    isDown: boolean;
    lastX: number;
    lastY: number;
  }>({
    isDown: false,
    lastX: 0,
    lastY: 0
  });

  // Camera Orbit Angles
  const cameraAngles = useRef<{
    yaw: number;
    pitch: number;
    distance: number;
  }>({
    yaw: 0,
    pitch: 0.32,
    distance: 7.2
  });

  // Keyboard Keys State
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // Three.js Game Engine State
  const threeState = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    playerGroup: THREE.Group;
    bodyMesh: THREE.Mesh;
    leftLeg: THREE.Mesh;
    rightLeg: THREE.Mesh;
    leftArm: THREE.Mesh;
    rightArm: THREE.Mesh;
    shadowMesh: THREE.Mesh;
    pendulums: SwingingPendulum[];
    pushers: MovableObstacle[];
    spinners: SpinnerObstacle[];
    fallingTiles: FallingTile[];
    bouncePads: BouncePad[];
    coins: CoinObject[];
    rbCubes: RBCube[];
    platforms: PlatformBox[];
    checkpoints: { x: number; y: number }[];
    lastCheckpointIndex: number;
    playerPos: THREE.Vector3;
    playerVel: THREE.Vector3;
    isGrounded: boolean;
    isDiving: boolean;
    diveTimer: number;
    isStunned: boolean;
    stunTimer: number;
    walkAnimTimer: number;
    isGameActive: boolean;
    startTime: number;
    animId: number;
  } | null>(null);

  // Audio Synthesizer
  const playSfx = (type: 'beep' | 'go' | 'coin' | 'jump' | 'bounce' | 'hit' | 'dive' | 'fall' | 'checkpoint' | 'win') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      if (type === 'beep') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'go') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'coin') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(987.77, now);
        osc.frequency.setValueAtTime(1318.51, now + 0.08);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'jump') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(580, now + 0.18);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === 'dive') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.2);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'bounce') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(130, now);
        osc.frequency.exponentialRampToValueAtTime(720, now + 0.38);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.38);
        osc.start(now);
        osc.stop(now + 0.38);
      } else if (type === 'hit') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(170, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.28);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === 'fall') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(540, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.65);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
        osc.start(now);
        osc.stop(now + 0.65);
      } else if (type === 'checkpoint') {
        [440, 554.37, 659.25, 880].forEach((f, idx) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          o.frequency.setValueAtTime(f, now + idx * 0.08);
          g.gain.setValueAtTime(0.2, now + idx * 0.08);
          g.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.22);
          o.start(now + idx * 0.08);
          o.stop(now + idx * 0.08 + 0.22);
        });
      } else if (type === 'win') {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          o.frequency.setValueAtTime(freq, now + idx * 0.12);
          g.gain.setValueAtTime(0.28, now + idx * 0.12);
          g.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.12 + 0.4);
          o.start(now + idx * 0.12);
          o.stop(now + idx * 0.12 + 0.4);
        });
      }
    } catch (_) {}
  };

  // Fetch current user from session
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.user) {
          setProfile(prev => ({
            ...prev,
            name: data.user.name || 'Diego Seguro',
            phone: data.user.phone || '11982854183',
            saldo: Number(data.user.saldo ?? 1000),
            bonus: Number(data.user.bonus ?? 0)
          }));
        }
      })
      .catch(() => {});
  }, []);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  // Jump or Dive Action
  const handleJumpOrDive = () => {
    const st = threeState.current;
    if (!st || !st.isGameActive || st.isStunned) return;

    if (st.isGrounded) {
      // Jump
      st.playerVel.y = 12.0;
      st.isGrounded = false;
      playSfx('jump');
    } else if (!st.isDiving && st.diveTimer <= 0) {
      // Mid-air Fall Guys Dive!
      st.isDiving = true;
      st.diveTimer = 0.6;
      // Forward impulse in facing direction
      const facingAngle = st.playerGroup.rotation.y;
      st.playerVel.x += Math.cos(facingAngle) * 7.5;
      st.playerVel.z += Math.sin(facingAngle) * 7.5;
      st.playerVel.y = Math.max(st.playerVel.y, 3.5);
      playSfx('dive');
    }
  };

  // Start Race
  const startRace = (fee: number) => {
    if (profile.saldo < fee) {
      alert('Saldo insuficiente para entrar nesta corrida!');
      return;
    }

    setProfile(prev => ({ ...prev, saldo: Math.max(0, prev.saldo - fee) }));
    fetch('/api/game/iniciar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor_entrada: fee, modalidade: selectedMode, personagem: selectedCharId })
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.corrida_id) {
          setActiveRaceId(data.corrida_id);
          if (typeof data.saldo_restante === 'number') {
            setProfile(prev => ({ ...prev, saldo: data.saldo_restante }));
          }
        }
      })
      .catch(() => {});

    setActiveScreen('playing');
    setScore(0);
    setLives(3);
    setCourseProgress(0);
    setElapsedSeconds(0);

    setCountdown(3);
    playSfx('beep');
    const cInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev === 3) {
          playSfx('beep');
          return 2;
        }
        if (prev === 2) {
          playSfx('beep');
          return 1;
        }
        if (prev === 1) {
          playSfx('go');
          clearInterval(cInterval);
          setTimeout(() => setCountdown(null), 500);
          if (threeState.current) {
            threeState.current.isGameActive = true;
            threeState.current.startTime = performance.now();
          }
          return null;
        }
        return null;
      });
    }, 1000);
  };

  // Respawn at Last Checkpoint
  const respawnAtCheckpoint = () => {
    const st = threeState.current;
    if (!st) return;
    const cp = st.checkpoints[st.lastCheckpointIndex] ?? { x: 0, y: 1.5 };
    st.playerPos.set(cp.x, cp.y + 2.5, 0);
    st.playerVel.set(0, 0, 0);
    st.isGrounded = false;
    st.isDiving = false;
    st.isStunned = false;
    st.stunTimer = 0;
  };

  // BUILD THE 3D ENGINE
  useEffect(() => {
    if (activeScreen !== 'playing' || !mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x70c5ff); // Clear sky blue
    scene.fog = new THREE.Fog(0x70c5ff, 140, 360);

    const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x88bbdd, 0.95);
    scene.add(hemiLight);

    const sun = new THREE.DirectionalLight(0xfff5d8, 1.4);
    sun.position.set(50, 100, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 400;
    sun.shadow.camera.left = -90;
    sun.shadow.camera.right = 90;
    sun.shadow.camera.top = 90;
    sun.shadow.camera.bottom = -90;
    scene.add(sun);

    // 3. Clouds & Scenery
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    for (let c = 0; c < 28; c++) {
      const cloudGroup = new THREE.Group();
      const numPuffs = 4 + Math.floor(Math.random() * 4);
      for (let p = 0; p < numPuffs; p++) {
        const puffGeo = new THREE.BoxGeometry(
          4 + Math.random() * 4,
          2.5 + Math.random() * 2,
          3.5 + Math.random() * 3
        );
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        puff.position.set((p - numPuffs / 2) * 3.5, Math.random() * 1.5, Math.random() * 2);
        cloudGroup.add(puff);
      }
      cloudGroup.position.set(
        Math.random() * 380 - 40,
        30 + Math.random() * 35,
        Math.random() * 220 - 110
      );
      scene.add(cloudGroup);
    }

    // 4. Solid Physics Platforms & Obstacles Arrays
    const platforms: PlatformBox[] = [];
    const pendulums: SwingingPendulum[] = [];
    const pushers: MovableObstacle[] = [];
    const spinners: SpinnerObstacle[] = [];
    const fallingTiles: FallingTile[] = [];
    const bouncePads: BouncePad[] = [];
    const coins: CoinObject[] = [];
    const rbCubes: RBCube[] = [];
    const checkpoints = [
      { x: 0, y: 1.0 },
      { x: 68, y: 1.0 },
      { x: 124, y: 1.0 },
      { x: 180, y: 1.0 },
      { x: 222, y: 1.0 }
    ];

    // Helper to create Solid Seamless Platforms
    const addPlatform = (x1: number, x2: number, z1: number, z2: number, surfaceY: number, color: number, name = '') => {
      const w = x2 - x1;
      const d = z2 - z1;
      const h = 2.0;
      const posX = (x1 + x2) / 2;
      const posZ = (z1 + z2) / 2;
      const posY = surfaceY - h / 2;

      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(posX, posY, posZ);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      scene.add(mesh);

      // Edge Lip Barrier/Trim
      const trimGeo = new THREE.BoxGeometry(w, 0.3, 0.3);
      const trimMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
      const trim1 = new THREE.Mesh(trimGeo, trimMat);
      trim1.position.set(posX, surfaceY + 0.15, z1);
      scene.add(trim1);
      const trim2 = new THREE.Mesh(trimGeo, trimMat);
      trim2.position.set(posX, surfaceY + 0.15, z2);
      scene.add(trim2);

      platforms.push({
        minX: x1,
        maxX: x2,
        minZ: z1,
        maxZ: z2,
        surfaceY
      });
    };

    // Helper to spawn spinning 3D Coins
    const spawnCoin = (x: number, y: number, z: number) => {
      const coinGroup = new THREE.Group();
      coinGroup.position.set(x, y, z);

      const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.14, 16);
      const coinMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.9,
        roughness: 0.15,
        emissive: 0xffaa00,
        emissiveIntensity: 0.5
      });
      const coinMesh = new THREE.Mesh(coinGeo, coinMat);
      coinMesh.rotation.x = Math.PI / 2;
      coinGroup.add(coinMesh);

      const starGeo = new THREE.BoxGeometry(0.4, 0.4, 0.18);
      const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const star = new THREE.Mesh(starGeo, starMat);
      star.rotation.z = Math.PI / 4;
      coinGroup.add(star);

      scene.add(coinGroup);
      coins.push({ mesh: coinGroup, collected: false });
    };

    // ==============================================================
    // 5. BUILD LEVEL: 100% SEAMLESS & BUG-FREE FALL GUYS COURSE
    // ==============================================================

    // ZONE 0: Start Deck (x: -12 to 18, z: -7 to 7, y: 1.0)
    addPlatform(-12, 18, -7, 7, 1.0, 0xfbbf24, 'StartDeck');

    // Start Checkered Arch
    const archMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6, 0.8), archMat);
    p1.position.set(0, 4, -7);
    scene.add(p1);
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6, 0.8), archMat);
    p2.position.set(0, 4, 7);
    scene.add(p2);
    const cBar = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 15), archMat);
    cBar.position.set(0, 7, 0);
    scene.add(cBar);

    // STAGE 1: Pendulum Bridge (x: 18 to 62, z: -4 to 4, y: 1.0)
    addPlatform(18, 62, -4, 4, 1.0, 0x38bdf8, 'PendulumBridge');

    // 4 Giant Swinging Pendulums (Pendulum.cs limit=70deg)
    const pendXs = [26, 36, 46, 56];
    pendXs.forEach((pX, idx) => {
      const gArch = new THREE.Group();
      gArch.position.set(pX, 0, 0);

      const pole1 = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 10, 8), archMat);
      pole1.position.set(0, 5, -5.2);
      gArch.add(pole1);
      const pole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 10, 8), archMat);
      pole2.position.set(0, 5, 5.2);
      gArch.add(pole2);
      const topB = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 11), archMat);
      topB.position.set(0, 10, 0);
      gArch.add(topB);

      const pivot = new THREE.Object3D();
      pivot.position.set(0, 10, 0);

      const shaftMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 8.4, 8), shaftMat);
      shaft.position.set(0, -4.2, 0);
      pivot.add(shaft);

      const hammerMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5, roughness: 0.2 });
      const hammer = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 1.8, 16), hammerMat);
      hammer.rotation.z = Math.PI / 2;
      hammer.position.set(0, -8.3, 0);
      hammer.castShadow = true;
      pivot.add(hammer);

      gArch.add(pivot);
      scene.add(gArch);

      pendulums.push({
        group: gArch,
        pivotObj: pivot,
        hammerMesh: hammer,
        speed: 2.2,
        limit: 1.15,
        offset: idx * 0.95
      });

      spawnCoin(pX + 5, 2.2, idx % 2 === 0 ? 1.8 : -1.8);
    });

    // Checkpoint 1 Island (x: 62 to 74, z: -6 to 6, y: 1.0)
    addPlatform(62, 74, -6, 6, 1.0, 0x10b981, 'CP1');
    spawnCoin(68, 2.2, 0);

    // STAGE 2: Pusher Alley (x: 74 to 118, z: -5 to 5, y: 1.0)
    addPlatform(74, 118, -5, 5, 1.0, 0xa855f7, 'PusherAlley');

    // 4 Sliding Pusher Blocks (MovableObs.cs)
    const pushXs = [82, 90, 100, 110];
    pushXs.forEach((px, idx) => {
      const pGeo = new THREE.BoxGeometry(2.6, 3.6, 4.8);
      const pMat = new THREE.MeshStandardMaterial({
        color: idx % 2 === 0 ? 0xf97316 : 0xeab308,
        roughness: 0.3
      });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      const startZ = idx % 2 === 0 ? -4.5 : 4.5;
      pMesh.position.set(px, 2.8, startZ);
      pMesh.castShadow = true;
      scene.add(pMesh);

      pushers.push({
        mesh: pMesh,
        startZ: 0,
        distance: 4.6,
        speed: 3.4,
        dir: idx % 2 === 0 ? 1 : -1,
        bounds: { minX: px - 1.3, maxX: px + 1.3, halfDepth: 2.4 }
      });

      spawnCoin(px, 2.2, 0);
    });

    // Checkpoint 2 Island (x: 118 to 130, z: -6 to 6, y: 1.0)
    addPlatform(118, 130, -6, 6, 1.0, 0x10b981, 'CP2');
    spawnCoin(124, 2.2, 0);

    // STAGE 3: Rotating Platform & Sweeper Arms (x: 130 to 174)
    // Entry bridge (x: 130 to 138, z: -3.5 to 3.5)
    addPlatform(130, 138, -3.5, 3.5, 1.0, 0xec4899, 'BridgeToRot');

    // Circular Arena (x: 138 to 166, z: -14 to 14, center: 152)
    addPlatform(138, 166, -14, 14, 1.0, 0x06b6d4, 'RotatingArena');

    // Center Spindle with 4 Sweeper Crossbars (Rotator.cs)
    const spinGroup = new THREE.Group();
    spinGroup.position.set(152, 1.0, 0);

    const spindleGeo = new THREE.CylinderGeometry(1.2, 1.2, 3.2, 16);
    const spindleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const spindle = new THREE.Mesh(spindleGeo, spindleMat);
    spindle.position.y = 1.6;
    spinGroup.add(spindle);

    for (let arm = 0; arm < 4; arm++) {
      const armGeo = new THREE.BoxGeometry(0.7, 0.9, 11.5);
      const armMat = new THREE.MeshStandardMaterial({
        color: arm % 2 === 0 ? 0xff0055 : 0xffdd00,
        roughness: 0.3
      });
      const armMesh = new THREE.Mesh(armGeo, armMat);
      armMesh.position.set(0, 0.8, 5.8);
      armMesh.rotation.y = (arm * Math.PI) / 2;
      armMesh.castShadow = true;
      spinGroup.add(armMesh);
    }
    scene.add(spinGroup);

    spinners.push({
      group: spinGroup,
      centerX: 152,
      centerZ: 0,
      radius: 12.0,
      speed: 1.85
    });

    spawnCoin(146, 2.2, 5);
    spawnCoin(158, 2.2, -5);
    spawnCoin(152, 2.2, 7);
    spawnCoin(152, 2.2, -7);

    // Exit bridge (x: 166 to 174, z: -3.5 to 3.5)
    addPlatform(166, 174, -3.5, 3.5, 1.0, 0xec4899, 'BridgeFromRot');

    // Checkpoint 3 Island (x: 174 to 186, z: -6 to 6, y: 1.0)
    addPlatform(174, 186, -6, 6, 1.0, 0x10b981, 'CP3');
    spawnCoin(180, 2.2, 0);

    // STAGE 4: Collapsing Fall Platforms (x: 186 to 216)
    // 5 Columns x 3 Rows of stepping tiles
    const colXs = [190, 196, 202, 208, 214];
    const rowZs = [-3.0, 0, 3.0];
    colXs.forEach(cx => {
      rowZs.forEach(rz => {
        const tGeo = new THREE.BoxGeometry(4.2, 0.8, 2.4);
        const tMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 });
        const tMesh = new THREE.Mesh(tGeo, tMat);
        tMesh.position.set(cx, 0.6, rz);
        tMesh.receiveShadow = true;
        scene.add(tMesh);

        fallingTiles.push({
          mesh: tMesh,
          initialY: 0.6,
          isStepped: false,
          stepTimer: 0,
          isFalling: false,
          fallSpeed: 0,
          isRespawning: false,
          respawnTimer: 0,
          bounds: { minX: cx - 2.1, maxX: cx + 2.1, minZ: rz - 1.2, maxZ: rz + 1.2 }
        });

        if (Math.random() < 0.4) {
          spawnCoin(cx, 2.0, rz);
        }
      });
    });

    // Checkpoint 4 Deck (x: 216 to 228, z: -6 to 6, y: 1.0)
    addPlatform(216, 228, -6, 6, 1.0, 0x10b981, 'CP4');
    spawnCoin(222, 2.2, 0);

    // STAGE 5: Trampoline Bounce Pad to High Deck (x: 228 to 264)
    // Lower Launch Deck (x: 228 to 238, z: -5 to 5, y: 1.0)
    addPlatform(228, 238, -5, 5, 1.0, 0x3b82f6, 'LaunchDeck');

    // Trampoline Bounce Pad (Bounce.cs)
    const padMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.6, 0.4, 32),
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x059669,
        emissiveIntensity: 0.9,
        roughness: 0.2
      })
    );
    padMesh.position.set(233, 1.2, 0);
    scene.add(padMesh);

    const ringMesh = new THREE.Mesh(
      new THREE.TorusGeometry(2.3, 0.12, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.set(233, 1.42, 0);
    scene.add(ringMesh);

    bouncePads.push({
      mesh: padMesh,
      ringMesh,
      x: 233,
      y: 1.2,
      z: 0,
      radius: 2.5,
      force: 22.0 // Giant trampoline jump!
    });

    // Elevated Deck (x: 242 to 264, z: -6 to 6, surfaceY: 8.0)
    addPlatform(242, 264, -6, 6, 8.0, 0xf43f5e, 'HighDeck');
    spawnCoin(238, 11.0, 0); // High apex coin!
    spawnCoin(250, 9.2, 2);
    spawnCoin(250, 9.2, -2);

    // Stacks of Knockdown Physics Toy Cubes (RBCubes.prefab)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const cGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
        const cMat = new THREE.MeshStandardMaterial({
          color: (row + col) % 3 === 0 ? 0xfacc15 : (row + col) % 3 === 1 ? 0x38bdf8 : 0xf43f5e,
          roughness: 0.4
        });
        const cMesh = new THREE.Mesh(cGeo, cMat);
        const cubeX = 252 + col * 1.0;
        const cubeY = 8.5 + row * 0.95;
        const cubeZ = (col - 1.5) * 1.0;
        cMesh.position.set(cubeX, cubeY, cubeZ);
        cMesh.castShadow = true;
        scene.add(cMesh);

        rbCubes.push({
          mesh: cMesh,
          vx: 0,
          vy: 0,
          vz: 0,
          rx: 0,
          ry: 0,
          rz: 0,
          groundY: 8.45
        });
      }
    }

    // STAGE 6: Checkered Finish Line (x: 264 to 286, z: -7 to 7, surfaceY: 8.0)
    addPlatform(264, 286, -7, 7, 8.0, 0xfbbf24, 'FinishDeck');

    // Grand Checkered Finish Arch (FinishLine.cs threshold = 270)
    const fArch = new THREE.Group();
    fArch.position.set(270, 8.0, 0);

    const fP1 = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 1), archMat);
    fP1.position.set(0, 4, -6.5);
    fArch.add(fP1);
    const fP2 = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 1), archMat);
    fP2.position.set(0, 4, 6.5);
    fArch.add(fP2);
    const fTop = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 14), archMat);
    fTop.position.set(0, 7.5, 0);
    fArch.add(fTop);

    // Canvas Checkered Finish Banner
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 64;
    const ctx = cv.getContext('2d');
    if (ctx) {
      const sz = 32;
      for (let x = 0; x < 256; x += sz) {
        for (let y = 0; y < 64; y += sz) {
          ctx.fillStyle = (x / sz + y / sz) % 2 === 0 ? '#ffffff' : '#000000';
          ctx.fillRect(x, y, sz, sz);
        }
      }
    }
    const checkTex = new THREE.CanvasTexture(cv);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(13.6, 1.4), new THREE.MeshBasicMaterial({ map: checkTex, side: THREE.DoubleSide }));
    banner.rotation.y = Math.PI / 2;
    banner.position.set(-0.62, 7.5, 0);
    fArch.add(banner);

    scene.add(fArch);

    // ==============================================================
    // 6. BUILD FALL GUYS BEAN CHARACTER (Player.prefab)
    // ==============================================================
    const playerGroup = new THREE.Group();
    playerGroup.position.set(0, 1.0, 0);

    // Soft Blob Drop Shadow under player (Essential for 3D platformers!)
    const shadowGeo = new THREE.PlaneGeometry(1.2, 1.2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.05;
    scene.add(shadowMesh);

    // Capsule Bean Body
    const bodyMat = new THREE.MeshStandardMaterial({
      color: selectedColor,
      roughness: 0.32,
      metalness: 0.08
    });
    const bodyGeo = new THREE.CapsuleGeometry(0.52, 0.72, 16, 16);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.88;
    bodyMesh.castShadow = true;
    playerGroup.add(bodyMesh);

    // Iconic White Oval Visor / Faceplate
    const visorGeo = new THREE.BoxGeometry(0.5, 0.38, 0.22);
    const visorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0.38, 1.02, 0);
    visor.castShadow = true;
    playerGroup.add(visor);

    // Expressive Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const eyeGeo = new THREE.SphereGeometry(0.065, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(0.48, 1.06, -0.12);
    playerGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.48, 1.06, 0.12);
    playerGroup.add(rightEye);

    // Limbs
    const limbMat = new THREE.MeshStandardMaterial({ color: selectedColor, roughness: 0.4 });
    const legGeo = new THREE.CapsuleGeometry(0.14, 0.3, 8, 8);
    const leftLeg = new THREE.Mesh(legGeo, limbMat);
    leftLeg.position.set(0, 0.24, -0.22);
    leftLeg.castShadow = true;
    playerGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, limbMat);
    rightLeg.position.set(0, 0.24, 0.22);
    rightLeg.castShadow = true;
    playerGroup.add(rightLeg);

    const armGeo = new THREE.CapsuleGeometry(0.12, 0.36, 8, 8);
    const leftArm = new THREE.Mesh(armGeo, limbMat);
    leftArm.position.set(0, 0.82, -0.52);
    leftArm.castShadow = true;
    playerGroup.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, limbMat);
    rightArm.position.set(0, 0.82, 0.52);
    rightArm.castShadow = true;
    playerGroup.add(rightArm);

    scene.add(playerGroup);

    // 7. Store in Ref
    threeState.current = {
      scene,
      camera,
      renderer,
      playerGroup,
      bodyMesh,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      shadowMesh,
      pendulums,
      pushers,
      spinners,
      fallingTiles,
      bouncePads,
      coins,
      rbCubes,
      platforms,
      checkpoints,
      lastCheckpointIndex: 0,
      playerPos: new THREE.Vector3(0, 1.0, 0),
      playerVel: new THREE.Vector3(0, 0, 0),
      isGrounded: true,
      isDiving: false,
      diveTimer: 0,
      isStunned: false,
      stunTimer: 0,
      walkAnimTimer: 0,
      isGameActive: false,
      startTime: performance.now(),
      animId: 0
    };

    // 8. Event Handlers
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        handleJumpOrDive();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    const handleMouseDown = (e: MouseEvent) => {
      mouseOrbit.current.isDown = true;
      mouseOrbit.current.lastX = e.clientX;
      mouseOrbit.current.lastY = e.clientY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!mouseOrbit.current.isDown) return;
      const dx = e.clientX - mouseOrbit.current.lastX;
      const dy = e.clientY - mouseOrbit.current.lastY;
      mouseOrbit.current.lastX = e.clientX;
      mouseOrbit.current.lastY = e.clientY;

      cameraAngles.current.yaw -= dx * 0.006;
      cameraAngles.current.pitch = Math.max(-0.25, Math.min(1.1, cameraAngles.current.pitch + dy * 0.005));
    };

    const handleMouseUp = () => {
      mouseOrbit.current.isDown = false;
    };

    const handleWheel = (e: WheelEvent) => {
      cameraAngles.current.distance = Math.max(4.5, Math.min(12.0, cameraAngles.current.distance + e.deltaY * 0.005));
    };

    const handleResize = () => {
      if (!mountRef.current || !threeState.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      threeState.current.camera.aspect = w / h;
      threeState.current.camera.updateProjectionMatrix();
      threeState.current.renderer.setSize(w, h);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('wheel', handleWheel);
    window.addEventListener('resize', handleResize);

    // ==============================================================
    // 9. MAIN GAME LOOP: ROCK-SOLID 60 FPS PHYSICS
    // ==============================================================
    let lastTime = performance.now();

    const animate = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05); // Safe dt clamp
      lastTime = now;

      const st = threeState.current;
      if (!st) return;

      if (st.isGameActive) {
        // A. Timer
        const elapsed = (now - st.startTime) / 1000;
        setElapsedSeconds(elapsed);

        // B. Movement Input
        let inputX = 0; // Forward / Back
        let inputZ = 0; // Left / Right

        if (keysPressed.current['w'] || keysPressed.current['arrowup']) inputX += 1;
        if (keysPressed.current['s'] || keysPressed.current['arrowdown']) inputX -= 1;
        if (keysPressed.current['a'] || keysPressed.current['arrowleft']) inputZ -= 1;
        if (keysPressed.current['d'] || keysPressed.current['arrowright']) inputZ += 1;

        if (touchJoystick.current.active) {
          inputX -= touchJoystick.current.dy; // joystick up is negative Y
          inputZ += touchJoystick.current.dx;
        }

        const inputLen = Math.hypot(inputX, inputZ);
        if (inputLen > 1) {
          inputX /= inputLen;
          inputZ /= inputLen;
        }

        // Camera Relative Heading
        const camYaw = cameraAngles.current.yaw;
        const forwardX = Math.cos(camYaw);
        const forwardZ = Math.sin(camYaw);
        const rightX = -Math.sin(camYaw);
        const rightZ = Math.cos(camYaw);

        const targetDirX = inputX * forwardX + inputZ * rightX;
        const targetDirZ = inputX * forwardZ + inputZ * rightZ;

        const maxSpeed = 9.5;
        if (!st.isStunned && !st.isDiving) {
          // Responsive ground/air acceleration
          const accel = st.isGrounded ? 16.0 : 8.0;
          st.playerVel.x += (targetDirX * maxSpeed - st.playerVel.x) * accel * dt;
          st.playerVel.z += (targetDirZ * maxSpeed - st.playerVel.z) * accel * dt;
        } else if (st.isDiving) {
          st.diveTimer -= dt;
          if (st.diveTimer <= 0) st.isDiving = false;
        } else {
          // Friction when stunned
          st.playerVel.x *= 0.94;
          st.playerVel.z *= 0.94;
          st.stunTimer -= dt;
          if (st.stunTimer <= 0) st.isStunned = false;
        }

        // Gravity
        st.playerVel.y -= 26.0 * dt;

        // Previous Position for Continuous Collision Sweeping
        const prevY = st.playerPos.y;

        // Apply Velocity
        st.playerPos.x += st.playerVel.x * dt;
        st.playerPos.y += st.playerVel.y * dt;
        st.playerPos.z += st.playerVel.z * dt;

        // Rotate Character into movement direction
        const horizSpeed = Math.hypot(st.playerVel.x, st.playerVel.z);
        if (horizSpeed > 0.4 && !st.isStunned) {
          const targetAngle = Math.atan2(st.playerVel.z, st.playerVel.x);
          let diff = targetAngle - st.playerGroup.rotation.y;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          st.playerGroup.rotation.y += diff * 15 * dt;

          // Cute Bean Waddling Step Animation
          st.walkAnimTimer += dt * 15;
          st.leftLeg.rotation.z = Math.sin(st.walkAnimTimer) * 0.6;
          st.rightLeg.rotation.z = -Math.sin(st.walkAnimTimer) * 0.6;
          st.leftArm.rotation.z = -Math.sin(st.walkAnimTimer) * 0.5;
          st.rightArm.rotation.z = Math.sin(st.walkAnimTimer) * 0.5;
          st.bodyMesh.rotation.z = Math.sin(st.walkAnimTimer * 0.5) * 0.08;
        } else {
          st.leftLeg.rotation.z = 0;
          st.rightLeg.rotation.z = 0;
          st.leftArm.rotation.z = 0;
          st.rightArm.rotation.z = 0;
          st.bodyMesh.rotation.z = 0;
        }

        // Dive & Jump Poses
        if (st.isDiving) {
          st.playerGroup.rotation.z = -0.9;
          st.leftArm.rotation.z = -1.2;
          st.rightArm.rotation.z = -1.2;
        } else if (!st.isGrounded) {
          st.playerGroup.rotation.z = 0;
          st.leftArm.rotation.z = -0.9;
          st.rightArm.rotation.z = 0.9;
        } else {
          st.playerGroup.rotation.z = 0;
        }

        // C. Continuous Solid Platform Collisions (Prevents Any Tunneling!)
        st.isGrounded = false;
        let groundSurfaceY = -999;
        const playerRadius = 0.48;

        for (const plat of st.platforms) {
          if (
            st.playerPos.x >= plat.minX - playerRadius &&
            st.playerPos.x <= plat.maxX + playerRadius &&
            st.playerPos.z >= plat.minZ - playerRadius &&
            st.playerPos.z <= plat.maxZ + playerRadius
          ) {
            // Check if player crossed surface plane from above
            if (prevY >= plat.surfaceY - 0.2 && st.playerPos.y <= plat.surfaceY + 0.35 && st.playerVel.y <= 0) {
              st.playerPos.y = plat.surfaceY;
              st.playerVel.y = 0;
              st.isGrounded = true;
              groundSurfaceY = plat.surfaceY;
              break;
            }
            if (plat.surfaceY > groundSurfaceY && plat.surfaceY <= st.playerPos.y) {
              groundSurfaceY = plat.surfaceY;
            }
          }
        }

        // D. Collapsing Platforms (`FallPlat.cs`)
        st.fallingTiles.forEach(tile => {
          if (!tile.isFalling && !tile.isRespawning) {
            const b = tile.bounds;
            if (
              st.playerPos.x >= b.minX - playerRadius &&
              st.playerPos.x <= b.maxX + playerRadius &&
              st.playerPos.z >= b.minZ - playerRadius &&
              st.playerPos.z <= b.maxZ + playerRadius
            ) {
              const surfY = tile.mesh.position.y + 0.4;
              if (prevY >= surfY - 0.2 && st.playerPos.y <= surfY + 0.35 && st.playerVel.y <= 0) {
                st.playerPos.y = surfY;
                st.playerVel.y = 0;
                st.isGrounded = true;
                groundSurfaceY = surfY;

                if (!tile.isStepped) {
                  tile.isStepped = true;
                  (tile.mesh.material as THREE.MeshStandardMaterial).color.setHex(0xef4444);
                }
              }
            }

            if (tile.isStepped) {
              tile.stepTimer += dt;
              // Warning rapid shake
              tile.mesh.position.y = tile.initialY + (Math.random() - 0.5) * 0.08;
              if (tile.stepTimer > 0.65) {
                tile.isFalling = true;
                tile.fallSpeed = 2.0;
              }
            }
          } else if (tile.isFalling) {
            tile.fallSpeed += 25 * dt;
            tile.mesh.position.y -= tile.fallSpeed * dt;
            if (tile.mesh.position.y < -35) {
              tile.isFalling = false;
              tile.isRespawning = true;
              tile.respawnTimer = 3.5;
              tile.mesh.visible = false;
            }
          } else if (tile.isRespawning) {
            tile.respawnTimer -= dt;
            if (tile.respawnTimer <= 0) {
              tile.isRespawning = false;
              tile.isStepped = false;
              tile.stepTimer = 0;
              tile.mesh.position.y = tile.initialY;
              tile.mesh.visible = true;
              (tile.mesh.material as THREE.MeshStandardMaterial).color.setHex(0xf59e0b);
            }
          }
        });

        // E. Trampoline Bounce Pads (`Bounce.cs`)
        st.bouncePads.forEach(pad => {
          const dist = Math.hypot(st.playerPos.x - pad.x, st.playerPos.z - pad.z);
          if (dist < pad.radius && Math.abs(st.playerPos.y - pad.y) < 1.4) {
            st.playerVel.y = pad.force;
            st.isGrounded = false;
            playSfx('bounce');
            pad.mesh.scale.set(1.2, 0.6, 1.2);
            setTimeout(() => pad.mesh.scale.set(1, 1, 1), 160);
          }
        });

        // F. Swinging Pendulums (`Pendulum.cs`)
        st.pendulums.forEach(pend => {
          const angle = pend.limit * Math.sin(now * 0.001 * pend.speed + pend.offset);
          pend.pivotObj.rotation.x = angle;

          const hammerWorld = new THREE.Vector3();
          pend.hammerMesh.getWorldPosition(hammerWorld);

          const dH = hammerWorld.distanceTo(st.playerPos.clone().add(new THREE.Vector3(0, 0.9, 0)));
          if (dH < 1.6) {
            playSfx('hit');
            st.isStunned = true;
            st.stunTimer = 0.55;
            const swingDir = Math.cos(now * 0.001 * pend.speed + pend.offset) > 0 ? 1 : -1;
            st.playerVel.set(-5.0, 7.5, swingDir * 16.0);
          }
        });

        // G. Sliding Pusher Blocks (`MovableObs.cs`)
        st.pushers.forEach(pusher => {
          const pos = pusher.mesh.position;
          pos.z += pusher.dir * pusher.speed * dt;
          if (Math.abs(pos.z) > pusher.distance) {
            pusher.dir *= -1;
          }

          if (
            st.playerPos.x >= pusher.bounds.minX &&
            st.playerPos.x <= pusher.bounds.maxX &&
            Math.abs(st.playerPos.z - pos.z) < pusher.bounds.halfDepth + playerRadius &&
            Math.abs(st.playerPos.y - pos.y) < 2.0
          ) {
            playSfx('hit');
            st.isStunned = true;
            st.stunTimer = 0.4;
            st.playerVel.z = pusher.dir * 15;
            st.playerVel.y = 5;
          }
        });

        // H. Rotating Sweeper Arms (`Rotator.cs`)
        st.spinners.forEach(spin => {
          spin.group.rotation.y += spin.speed * dt;

          const distCenter = Math.hypot(st.playerPos.x - spin.centerX, st.playerPos.z - spin.centerZ);
          if (distCenter < spin.radius && st.playerPos.y < 2.2) {
            const pAngle = Math.atan2(st.playerPos.z - spin.centerZ, st.playerPos.x - spin.centerX);
            const rotY = spin.group.rotation.y;
            for (let i = 0; i < 4; i++) {
              const armAngle = rotY + (i * Math.PI) / 2;
              let diff = pAngle - armAngle;
              while (diff < -Math.PI) diff += Math.PI * 2;
              while (diff > Math.PI) diff -= Math.PI * 2;

              if (Math.abs(diff) < 0.22 && distCenter > 1.2) {
                playSfx('hit');
                st.isStunned = true;
                st.stunTimer = 0.45;
                const flingX = -Math.sin(armAngle) * 15;
                const flingZ = Math.cos(armAngle) * 15;
                st.playerVel.set(flingX, 8, flingZ);
                break;
              }
            }
          }
        });

        // I. Knockdown Physics Toy Cubes (`RBCubes.prefab`)
        st.rbCubes.forEach(cube => {
          const cPos = cube.mesh.position;
          const dist = Math.hypot(st.playerPos.x - cPos.x, st.playerPos.z - cPos.z);
          if (dist < 1.2 && Math.abs(st.playerPos.y - cPos.y) < 1.2) {
            cube.vx = st.playerVel.x * 0.9 + (Math.random() - 0.5) * 4;
            cube.vz = st.playerVel.z * 0.9 + (Math.random() - 0.5) * 4;
            cube.vy = 4 + Math.random() * 3;
            cube.rx = Math.random() * 8;
            cube.ry = Math.random() * 8;
          }

          if (Math.abs(cube.vx) > 0.05 || Math.abs(cube.vy) > 0.05 || Math.abs(cube.vz) > 0.05) {
            cube.vy -= 22 * dt;
            cPos.x += cube.vx * dt;
            cPos.y += cube.vy * dt;
            cPos.z += cube.vz * dt;
            cube.mesh.rotation.x += cube.rx * dt;
            cube.mesh.rotation.y += cube.ry * dt;

            if (cPos.y <= cube.groundY) {
              cPos.y = cube.groundY;
              cube.vy = -cube.vy * 0.35;
              cube.vx *= 0.85;
              cube.vz *= 0.85;
              cube.rx *= 0.85;
            }
          }
        });

        // J. Gold Coins (`Coin.cs`)
        st.coins.forEach(coin => {
          if (!coin.collected) {
            coin.mesh.rotation.y += 3.5 * dt;
            const dist = coin.mesh.position.distanceTo(st.playerPos.clone().add(new THREE.Vector3(0, 0.9, 0)));
            if (dist < 1.5) {
              coin.collected = true;
              coin.mesh.visible = false;
              playSfx('coin');
              setScore(prev => prev + 1);
            }
          }
        });

        // K. Checkpoint Validation
        st.checkpoints.forEach((cp, idx) => {
          if (st.playerPos.x >= cp.x && idx > st.lastCheckpointIndex) {
            st.lastCheckpointIndex = idx;
            playSfx('checkpoint');
          }
        });

        // Course Progress (0 to 270m)
        const prog = Math.min(100, Math.max(0, Math.floor((st.playerPos.x / 270) * 100)));
        setCourseProgress(prog);

        // L. Void Fall Reset (`FallReset.cs`)
        if (st.playerPos.y < -14.0) {
          playSfx('fall');
          setLives(prev => {
            const nextL = prev - 1;
            if (nextL <= 0) {
              st.isGameActive = false;
              setTimeout(() => setActiveScreen('gameover'), 600);
            } else {
              setTimeout(() => respawnAtCheckpoint(), 400);
            }
            return nextL;
          });
        }

        // M. Finish Line Victory (`FinishLine.cs` threshold = 270)
        if (st.playerPos.x >= 270.0) {
          st.isGameActive = false;
          playSfx('win');
          confetti({ particleCount: 220, spread: 100, origin: { y: 0.55 } });

          const totalPrize = Number((selectedFee * 2.8).toFixed(2));
          setWinnings(totalPrize);

          if (activeRaceId) {
            fetch('/api/game/finalizar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                corrida_id: activeRaceId,
                posicao: 1,
                ouro_coletado: score,
                rubi_coletado: 0,
                diamante_coletado: 0,
                tempo_segundos: Math.floor(elapsed)
              })
            })
              .then(res => (res.ok ? res.json() : null))
              .then(data => {
                const novoSaldo = data?.saldo_novo ?? data?.saldo_atualizado;
                if (novoSaldo !== undefined) {
                  setProfile(prev => ({
                    ...prev,
                    saldo: Number(novoSaldo),
                    victories: prev.victories + 1
                  }));
                }
              })
              .catch(() => {});
          } else {
            setProfile(prev => ({
              ...prev,
              saldo: prev.saldo + totalPrize,
              victories: prev.victories + 1
            }));
          }

          setTimeout(() => setActiveScreen('victory'), 800);
        }

        // Update 3D Character Position
        st.playerGroup.position.copy(st.playerPos);

        // Update Drop Shadow position onto ground surface
        if (groundSurfaceY > -900) {
          st.shadowMesh.position.set(st.playerPos.x, groundSurfaceY + 0.05, st.playerPos.z);
          st.shadowMesh.visible = true;
          // Scale shadow based on height
          const heightAboveGround = Math.max(0, st.playerPos.y - groundSurfaceY);
          const shadowScale = Math.max(0.4, 1.2 - heightAboveGround * 0.1);
          st.shadowMesh.scale.set(shadowScale, shadowScale, shadowScale);
          (st.shadowMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0.1, 0.4 - heightAboveGround * 0.04);
        } else {
          st.shadowMesh.visible = false;
        }

        // N. Third-Person Chase Camera Follow
        const angles = cameraAngles.current;
        const camH = 3.6 + angles.pitch * 3.5;
        const camTargetX = st.playerPos.x - Math.cos(angles.yaw) * angles.distance;
        const camTargetZ = st.playerPos.z - Math.sin(angles.yaw) * angles.distance;
        const camTargetY = st.playerPos.y + camH;

        st.camera.position.x += (camTargetX - st.camera.position.x) * 14 * dt;
        st.camera.position.y += (camTargetY - st.camera.position.y) * 14 * dt;
        st.camera.position.z += (camTargetZ - st.camera.position.z) * 14 * dt;

        st.camera.lookAt(st.playerPos.x, st.playerPos.y + 1.2, st.playerPos.z);
      }

      st.renderer.render(st.scene, st.camera);
      st.animId = requestAnimationFrame(animate);
    };

    threeState.current.animId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      if (threeState.current) {
        cancelAnimationFrame(threeState.current.animId);
        threeState.current.renderer.dispose();
      }
    };
  }, [activeScreen, selectedColor, selectedFee]);

  return (
    <div className="relative w-full h-screen bg-[#060D2A] text-white overflow-hidden select-none flex justify-center items-center font-sans">
      {/* ============================================================== */}
      {/* 1. LOBBY SCREEN                                                */}
      {/* ============================================================== */}
      {activeScreen === 'lobby' && (
        <div className="relative w-full max-w-[440px] h-full sm:h-[92vh] sm:rounded-3xl shadow-2xl overflow-hidden bg-gradient-to-b from-[#0c1e54] via-[#10307c] to-[#0a469a] border-0 sm:border-4 sm:border-slate-800 flex flex-col justify-between p-4">
          <div className="flex justify-between items-start pt-2 z-20">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="relative w-12 h-12 rounded-full border-2 border-white overflow-hidden bg-pink-500 shadow-md">
                  <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setActiveScreen('customization')}
                    className="absolute bottom-0 right-0 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center text-[10px] text-black shadow"
                  >
                    ✏️
                  </button>
                </div>
                <div>
                  <h2 className="text-base text-white font-black leading-tight uppercase tracking-wide">
                    {profile.name}
                  </h2>
                  <span className="text-[11px] text-emerald-400 font-bold">🏆 {profile.victories} Vitórias</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 w-24">
                <Link
                  href="/profile/me?tab=saque"
                  className="flex items-center justify-between px-2.5 py-0.5 rounded-md bg-white text-black font-extrabold text-[11px] shadow border border-slate-300 hover:bg-slate-100 uppercase"
                >
                  <span>SACAR</span>
                  <span className="text-red-500 font-black text-xs">▲</span>
                </Link>
                <Link
                  href="/profile/me?tab=deposito"
                  className="flex items-center justify-between px-2.5 py-0.5 rounded-md bg-white text-black font-extrabold text-[11px] shadow border border-slate-300 hover:bg-slate-100 uppercase"
                >
                  <span>DEPOSITAR</span>
                  <span className="text-emerald-500 font-black text-xs">▼</span>
                </Link>
              </div>
            </div>

            <div className="flex flex-col items-end gap-3">
              <div className="bg-[#1e1005] border-2 border-[#543310] px-3.5 py-1.5 rounded-xl shadow-lg flex items-center gap-2">
                <div className="text-right">
                  <div className="text-white text-base font-extrabold tracking-wider">
                    R$ {profile.saldo.toFixed(2)}
                  </div>
                  <div className="text-yellow-400 text-[10px] font-bold">
                    Bônus: R$ {profile.bonus.toFixed(2)}
                  </div>
                </div>
                <span className="text-2xl">💵</span>
              </div>
            </div>
          </div>

          {/* Central Bean Preview */}
          <div className="relative flex-1 flex flex-col items-center justify-center z-10">
            <div className="relative flex flex-col items-center animate-bounce-gentle">
              <div
                className="w-36 h-48 rounded-full border-4 border-black shadow-2xl relative flex flex-col items-center justify-center"
                style={{ backgroundColor: selectedColor }}
              >
                <div className="w-24 h-16 bg-white rounded-2xl border-3 border-black shadow-inner flex items-center justify-around px-4 mt-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-black" />
                  <div className="w-3.5 h-3.5 rounded-full bg-black" />
                </div>
                <span className="text-[10px] text-white/90 font-black uppercase mt-3 tracking-widest bg-black/30 px-2 py-0.5 rounded-full">
                  FALL GUYS CLONE
                </span>
              </div>
              <img
                src="/images/base_24.webp"
                alt="Pedestal"
                className="w-60 h-auto -mt-6 object-contain drop-shadow-2xl"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 px-2 mb-3 z-20">
            <button
              onClick={() => setActiveScreen('friends')}
              className="flex-1 h-14 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-2xl border-4 border-black shadow-[0_6px_0_#000] active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 text-sm tracking-wider uppercase font-black"
            >
              <span className="italic font-black text-lg text-yellow-300">VS</span>
              <span className="text-center leading-tight">Jogar com<br />Amigos</span>
            </button>

            <button
              onClick={() => setActiveScreen('modes')}
              className="flex-1 h-14 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-white rounded-2xl border-4 border-black shadow-[0_6px_0_#000] active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 text-2xl tracking-widest uppercase font-black"
            >
              <span>⚔️</span>
              <span>JOGAR</span>
            </button>
          </div>

          <div className="grid grid-cols-5 gap-1 pt-2 border-t border-white/20 z-20 bg-blue-950/70 -mx-4 -mb-4 px-3 pb-3">
            <button
              onClick={() => setActiveScreen('customization')}
              className="flex flex-col items-center justify-center py-1 text-white hover:text-yellow-400"
            >
              <span className="text-xl">🎒</span>
              <span className="text-[10px] tracking-tight uppercase font-bold">Itens</span>
            </button>
            <Link
              href="/profile/me?tab=ranking"
              className="flex flex-col items-center justify-center py-1 text-white hover:text-yellow-400"
            >
              <span className="text-xl">👑</span>
              <span className="text-[10px] tracking-tight uppercase font-bold">Ranking</span>
            </Link>
            <button className="flex flex-col items-center justify-center py-1 text-white/50 cursor-not-allowed">
              <span className="text-xl">🏪</span>
              <span className="text-[10px] tracking-tight uppercase font-bold">Loja</span>
            </button>
            <button
              onClick={() => setActiveScreen('friends')}
              className="flex flex-col items-center justify-center py-1 text-white hover:text-yellow-400"
            >
              <span className="text-xl">👥</span>
              <span className="text-[10px] tracking-tight uppercase font-bold">Amigos</span>
            </button>
            <button className="flex flex-col items-center justify-center py-1 text-white/50 cursor-not-allowed">
              <span className="text-xl">🎯</span>
              <span className="text-[10px] tracking-tight uppercase font-bold">Missões</span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. MODE SELECTION SCREEN                                       */}
      {/* ============================================================== */}
      {activeScreen === 'modes' && (
        <div className="relative w-full max-w-[440px] h-full sm:h-[92vh] sm:rounded-3xl shadow-2xl overflow-hidden bg-[#0A1640] border-0 sm:border-4 sm:border-slate-800 flex flex-col justify-between p-4">
          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => setActiveScreen('lobby')}
              className="w-10 h-10 rounded-xl bg-slate-700/80 border-2 border-slate-500 text-white flex items-center justify-center text-lg active:scale-95 shadow"
            >
              ◀
            </button>

            <div className="bg-[#1e1005] border-2 border-[#543310] px-3.5 py-1 rounded-xl shadow flex items-center gap-2">
              <div className="text-right">
                <div className="text-white text-sm font-extrabold tracking-wider">
                  R$ {profile.saldo.toFixed(2)}
                </div>
                <div className="text-yellow-400 text-[9px] font-bold">
                  Bônus: R$ {profile.bonus.toFixed(2)}
                </div>
              </div>
              <span className="text-xl">💵</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 mt-3 border-b-2 border-white/20 pb-2">
            {(['maratona', 'trio', 'x1'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setSelectedMode(mode)}
                className={`text-lg uppercase tracking-wide transition-all ${
                  selectedMode === mode ? 'text-white border-b-4 border-yellow-400 font-black' : 'text-white/60 font-bold'
                }`}
              >
                {mode === 'maratona' ? 'Maratona 5x' : mode === 'trio' ? 'Trio Clash' : 'X1'}
              </button>
            ))}
          </div>

          <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 border-2 border-blue-500 rounded-2xl p-4 shadow-lg text-center my-3">
            <h4 className="text-yellow-400 text-lg uppercase font-black mb-1">
              Obstacle Course 3D Platformer
            </h4>
            <p className="text-white/90 text-xs leading-relaxed">
              Supere pêndulos gigantescos, blocos empurradores, plataformas giratórias e trampolins para alcançar a linha de chegada e garantir o prêmio em dinheiro!
            </p>
          </div>

          <div className="my-2">
            <label className="block text-xs uppercase text-slate-300 font-extrabold mb-1.5">
              Escolha o valor da aposta:
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 5, 10, 25].map(val => (
                <button
                  key={val}
                  onClick={() => setSelectedFee(val)}
                  className={`py-2 rounded-xl font-black text-sm uppercase transition-all border-2 ${
                    selectedFee === val
                      ? 'bg-yellow-400 text-black border-black shadow-[0_3px_0_#000]'
                      : 'bg-slate-800 text-white border-slate-600 hover:bg-slate-700'
                  }`}
                >
                  R$ {val}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#0e245c] border-2 border-blue-500 rounded-2xl p-4 flex items-center justify-between shadow-xl mb-2">
            <div>
              <span className="text-[11px] text-slate-300 uppercase block font-bold">Inscrição</span>
              <span className="text-2xl text-white font-black">
                R$ {selectedFee.toFixed(2)}
              </span>
            </div>

            <button
              onClick={() => startRace(selectedFee)}
              className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white rounded-xl border-3 border-black shadow-[0_4px_0_#000] active:translate-y-1 active:shadow-none text-xl tracking-wider uppercase font-black"
            >
              ENTRAR
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. CUSTOMIZATION SCREEN                                        */}
      {/* ============================================================== */}
      {activeScreen === 'customization' && (
        <div className="relative w-full max-w-[440px] h-full sm:h-[92vh] sm:rounded-3xl shadow-2xl overflow-hidden bg-[#0A1640] border-0 sm:border-4 sm:border-slate-800 flex flex-col justify-between p-4">
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => setActiveScreen('lobby')}
              className="w-10 h-10 rounded-xl bg-slate-700/80 border-2 border-slate-500 text-white flex items-center justify-center text-lg active:scale-95 shadow"
            >
              ◀
            </button>
            <h2 className="text-2xl text-white font-black uppercase tracking-wider">
              Personalização
            </h2>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center my-3">
            <div
              className="w-32 h-44 rounded-full border-4 border-black shadow-2xl relative flex flex-col items-center justify-center transition-colors duration-200"
              style={{ backgroundColor: selectedColor }}
            >
              <div className="w-20 h-14 bg-white rounded-2xl border-3 border-black shadow-inner flex items-center justify-around px-3 mt-1">
                <div className="w-3 h-3 rounded-full bg-black" />
                <div className="w-3 h-3 rounded-full bg-black" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2.5 pb-4">
            {[
              { hex: '#ff2d75', name: 'Rosa Fall Guys' },
              { hex: '#00e5ff', name: 'Ciano Clássico' },
              { hex: '#fbbf24', name: 'Amarelo Ouro' },
              { hex: '#10b981', name: 'Verde Neon' },
              { hex: '#8b5cf6', name: 'Roxo Real' },
              { hex: '#f97316', name: 'Laranja Fogo' },
              { hex: '#ffffff', name: 'Branco Puro' },
              { hex: '#1e293b', name: 'Preto Sombra' }
            ].map((c, i) => (
              <button
                key={i}
                onClick={() => setSelectedColor(c.hex)}
                className={`p-3 rounded-2xl bg-blue-900/80 border-3 flex flex-col items-center justify-center transition-all ${
                  selectedColor === c.hex ? 'border-amber-400 ring-2 ring-amber-400 scale-105' : 'border-blue-700 hover:border-blue-500'
                }`}
              >
                <div className="w-8 h-8 rounded-full border-2 border-white shadow" style={{ backgroundColor: c.hex }} />
                <span className="text-[10px] text-white font-bold mt-1 tracking-tight text-center">{c.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. JOGAR COM AMIGOS SCREEN                                     */}
      {/* ============================================================== */}
      {activeScreen === 'friends' && (
        <div className="relative w-full max-w-[440px] h-full sm:h-[92vh] sm:rounded-3xl shadow-2xl overflow-hidden bg-[#0A1640] border-0 sm:border-4 sm:border-slate-800 flex flex-col justify-between p-4">
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => setActiveScreen('lobby')}
              className="w-10 h-10 rounded-xl bg-slate-700/80 border-2 border-slate-500 text-white flex items-center justify-center text-lg active:scale-95 shadow"
            >
              ◀
            </button>
            <h2 className="text-2xl text-white font-black uppercase tracking-wider">
              Jogar com amigos
            </h2>
          </div>

          <div className="flex-1 flex flex-col justify-center gap-5 my-4">
            <div className="bg-[#0e245c] border-3 border-blue-500 rounded-3xl p-5 shadow-2xl text-center flex flex-col items-center">
              <h3 className="text-xl text-white font-black uppercase mb-1">Criar partida</h3>
              <p className="text-xs text-white/80 mb-3">Compartilhe o código da sala com amigos!</p>
              {roomCode && (
                <div className="w-full mb-3 bg-black/40 py-2 rounded-xl">
                  <span className="text-2xl tracking-widest text-emerald-400 font-mono font-black">{roomCode}</span>
                </div>
              )}
              <button
                onClick={() => setRoomCode('ARENA-' + Math.floor(1000 + Math.random() * 9000))}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-2xl border-3 border-black shadow-[0_4px_0_#000] active:translate-y-1 active:shadow-none text-lg uppercase font-black"
              >
                {roomCode ? 'Código Gerado!' : 'Criar Sala'}
              </button>
            </div>

            <div className="bg-[#0e245c] border-3 border-blue-500 rounded-3xl p-5 shadow-2xl text-center flex flex-col items-center">
              <h3 className="text-xl text-white font-black uppercase mb-1">Entrar em partida</h3>
              <input
                type="text"
                placeholder="EX: ARENA-5829"
                value={inputCode}
                onChange={e => setInputCode(e.target.value.toUpperCase())}
                className="w-full bg-[#08153b] border-2 border-blue-400 rounded-xl px-4 py-2.5 text-center text-white font-mono font-bold uppercase tracking-wider my-3 outline-none focus:border-yellow-400"
              />
              <button
                onClick={() => {
                  if (!inputCode) return alert('Digite um código!');
                  startRace(5.0);
                }}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 text-white rounded-2xl border-3 border-black shadow-[0_4px_0_#000] active:translate-y-1 active:shadow-none text-lg uppercase font-black"
              >
                Entrar
              </button>
            </div>
          </div>
          <div />
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. ACTIVE 3D OBSTACLE COURSE GAMEPLAY (Full Viewport)          */}
      {/* ============================================================== */}
      {activeScreen === 'playing' && (
        <div className="absolute inset-0 w-full h-full overflow-hidden select-none touch-none">
          {/* 3D WebGL Canvas */}
          <div ref={mountRef} className="absolute inset-0 w-full h-full z-0 cursor-grab active:cursor-grabbing" />

          {/* TOP HUD: Live Timer, Progress Bar, Score, Lives */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-30 pointer-events-none">
            {/* Real-time Timer Box */}
            <div className="bg-black/60 backdrop-blur-md border-2 border-white/30 px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2">
              <span className="text-xl">⏱️</span>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-300 uppercase font-black tracking-widest leading-none">TEMPO</span>
                <span className="text-2xl font-mono font-black text-yellow-300 leading-tight">
                  {formatTime(elapsedSeconds)}
                </span>
              </div>
            </div>

            {/* Course Progress */}
            <div className="flex-1 max-w-[280px] mx-4 hidden sm:flex flex-col items-center">
              <div className="w-full flex justify-between text-[11px] font-black uppercase text-white mb-1 drop-shadow">
                <span>LARGADA</span>
                <span className="text-yellow-300">{courseProgress}%</span>
                <span>CHEGADA 🏁</span>
              </div>
              <div className="w-full h-3 bg-black/60 backdrop-blur-md rounded-full border border-white/30 overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 via-yellow-400 to-amber-500 rounded-full transition-all duration-150"
                  style={{ width: `${courseProgress}%` }}
                />
              </div>
            </div>

            {/* Score & Lives Box */}
            <div className="flex items-center gap-2">
              <div className="bg-black/60 backdrop-blur-md border-2 border-white/30 px-3 py-2 rounded-2xl shadow-xl flex items-center gap-1">
                {[1, 2, 3].map(i => (
                  <span key={i} className={`text-lg transition-opacity ${i <= lives ? 'opacity-100' : 'opacity-20'}`}>
                    ❤️
                  </span>
                ))}
              </div>

              <div className="bg-black/60 backdrop-blur-md border-2 border-white/30 px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2">
                <span className="text-xl animate-bounce-gentle">🪙</span>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-300 uppercase font-black tracking-widest leading-none">SCORE</span>
                  <span className="text-2xl font-mono font-black text-amber-400 leading-tight">
                    {score}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Controls Instruction Helper for Desktop */}
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm border border-white/20 px-5 py-2 rounded-full text-xs text-white/90 hidden sm:flex items-center gap-3 z-30 pointer-events-none shadow-lg">
            <span>🎮 <b>WASD</b> / <b>Setas</b> para mover</span>
            <span>•</span>
            <span><b>ESPAÇO</b> para pular (2x para mergulhar!)</span>
            <span>•</span>
            <span><b>Arraste o mouse</b> para câmera 360°</span>
          </div>

          {/* 3-2-1 Countdown Overlay */}
          {countdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/30 backdrop-blur-xs pointer-events-none">
              <span className="text-9xl text-yellow-400 font-black stroke-black-6 animate-ping-once drop-shadow-2xl font-mono">
                {countdown}
              </span>
            </div>
          )}

          {/* TOUCH CAMERA LOOK ZONE (Right half of screen for touch-look on mobile) */}
          <div
            className="absolute inset-y-0 right-0 w-1/2 z-20 sm:hidden touch-none"
            onTouchStart={e => {
              const touch = e.touches[0];
              touchLook.current.active = true;
              touchLook.current.lastX = touch.clientX;
              touchLook.current.lastY = touch.clientY;
              touchLook.current.touchId = touch.identifier;
            }}
            onTouchMove={e => {
              if (!touchLook.current.active) return;
              for (let i = 0; i < e.touches.length; i++) {
                const touch = e.touches[i];
                if (touch.identifier === touchLook.current.touchId) {
                  const dx = touch.clientX - touchLook.current.lastX;
                  const dy = touch.clientY - touchLook.current.lastY;
                  touchLook.current.lastX = touch.clientX;
                  touchLook.current.lastY = touch.clientY;

                  cameraAngles.current.yaw -= dx * 0.007;
                  cameraAngles.current.pitch = Math.max(-0.25, Math.min(1.1, cameraAngles.current.pitch + dy * 0.006));
                  break;
                }
              }
            }}
            onTouchEnd={() => {
              touchLook.current.active = false;
              touchLook.current.touchId = null;
            }}
          />

          {/* MOBILE CONTROLS OVERLAY: Virtual Joystick (Left) + Pular / Mergulhar (Right) */}
          <div className="absolute inset-x-0 bottom-6 z-40 pointer-events-none sm:hidden flex justify-between items-end px-6">
            {/* Joystick */}
            <div
              className="w-32 h-32 rounded-full border-4 border-white/40 bg-black/40 backdrop-blur-md relative pointer-events-auto flex items-center justify-center touch-none shadow-2xl"
              onTouchStart={e => {
                const touch = e.touches[0];
                const rect = e.currentTarget.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                touchJoystick.current.active = true;
                touchJoystick.current.startX = centerX;
                touchJoystick.current.startY = centerY;
                touchJoystick.current.touchId = touch.identifier;
              }}
              onTouchMove={e => {
                if (!touchJoystick.current.active) return;
                for (let i = 0; i < e.touches.length; i++) {
                  const touch = e.touches[i];
                  if (touch.identifier === touchJoystick.current.touchId) {
                    const dx = touch.clientX - touchJoystick.current.startX;
                    const dy = touch.clientY - touchJoystick.current.startY;
                    const maxR = 48;
                    const dist = Math.hypot(dx, dy);
                    const normX = dist > 0 ? (dx / dist) * Math.min(dist, maxR) : 0;
                    const normY = dist > 0 ? (dy / dist) * Math.min(dist, maxR) : 0;
                    touchJoystick.current.dx = normX / maxR;
                    touchJoystick.current.dy = normY / maxR;

                    const stick = document.getElementById('touch-stick');
                    if (stick) stick.style.transform = `translate(${normX}px, ${normY}px)`;
                    break;
                  }
                }
              }}
              onTouchEnd={() => {
                touchJoystick.current.active = false;
                touchJoystick.current.dx = 0;
                touchJoystick.current.dy = 0;
                touchJoystick.current.touchId = null;
                const stick = document.getElementById('touch-stick');
                if (stick) stick.style.transform = 'translate(0px, 0px)';
              }}
            >
              <div
                id="touch-stick"
                className="w-14 h-14 rounded-full bg-cyan-400 border-2 border-white shadow-[0_0_15px_rgba(0,240,255,0.7)] flex items-center justify-center pointer-events-none"
              >
                <div className="w-4 h-4 rounded-full bg-white/80" />
              </div>
            </div>

            {/* Jump / Dive Button */}
            <button
              onTouchStart={e => {
                e.preventDefault();
                handleJumpOrDive();
              }}
              onClick={handleJumpOrDive}
              className="w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-600 to-green-400 border-4 border-white shadow-[0_0_25px_rgba(16,185,129,0.7)] pointer-events-auto active:scale-90 transition-transform flex flex-col items-center justify-center text-white font-black"
            >
              <span className="text-2xl">⬆️</span>
              <span className="text-xs uppercase tracking-wider">PULAR</span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. VICTORY SCREEN MODAL (Matching Scene3.unity)                */}
      {/* ============================================================== */}
      {activeScreen === 'victory' && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/85 backdrop-blur-md z-50 p-4">
          <div className="relative w-full max-w-[380px] bg-[#0c3e7a] border-4 border-black rounded-3xl p-6 shadow-2xl flex flex-col items-center">
            <div className="absolute -top-12 w-24 h-24 rounded-full border-4 border-black overflow-hidden bg-pink-500 shadow-2xl">
              <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
            </div>

            <div className="w-[110%] -mx-4 mt-8 py-2 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 border-y-3 border-black text-center shadow-lg transform -rotate-1">
              <h3 className="text-white text-xl font-black uppercase tracking-wider">
                CURSO CONCLUÍDO!
              </h3>
            </div>

            <div className="text-6xl my-4 animate-bounce-gentle">🏆</div>

            <div className="w-full bg-blue-950/90 border-2 border-blue-400 rounded-2xl p-4 flex flex-col gap-2.5 mb-5 shadow-inner">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-300 font-bold uppercase">Tempo Final:</span>
                <span className="text-white font-mono font-black text-base">{formatTime(elapsedSeconds)}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-t border-white/10 pt-2">
                <span className="text-slate-300 font-bold uppercase">Moedas Coletadas:</span>
                <span className="text-amber-400 font-mono font-black text-base">🪙 {score}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-t border-white/10 pt-2">
                <span className="text-emerald-400 font-black uppercase">Prêmio Recebido:</span>
                <span className="text-emerald-400 font-mono font-black text-xl">+ R$ {winnings.toFixed(2)}</span>
              </div>
            </div>

            <div className="w-full flex flex-col gap-2.5">
              <button
                onClick={() => startRace(selectedFee)}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 text-white rounded-2xl border-3 border-black shadow-[0_5px_0_#000] active:translate-y-1 active:shadow-none text-xl uppercase tracking-wider font-black"
              >
                Jogar Novamente
              </button>
              <button
                onClick={() => setActiveScreen('lobby')}
                className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl border-2 border-black text-sm uppercase tracking-wider font-bold"
              >
                Voltar ao Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 7. GAME OVER MODAL (FallReset.cs / Out of Lives)               */}
      {/* ============================================================== */}
      {activeScreen === 'gameover' && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/85 backdrop-blur-md z-50 p-4">
          <div className="relative w-full max-w-[360px] bg-[#1e1028] border-4 border-red-600 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center">
            <span className="text-6xl mb-2">💥</span>
            <h3 className="text-2xl font-black text-red-500 uppercase tracking-wider mb-2">
              Fim de Jogo!
            </h3>
            <p className="text-slate-300 text-xs mb-4">
              Você caiu no vácuo e suas vidas acabaram. Supere os obstáculos para chegar até a linha de chegada!
            </p>

            <div className="w-full bg-black/50 border border-white/10 rounded-xl p-3 mb-5 text-sm flex justify-between">
              <span className="text-slate-400 font-bold uppercase">Progresso:</span>
              <span className="text-yellow-400 font-black font-mono">{courseProgress}%</span>
            </div>

            <div className="w-full flex flex-col gap-2.5">
              <button
                onClick={() => startRace(selectedFee)}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-black rounded-2xl border-3 border-black shadow-[0_4px_0_#000] active:translate-y-1 active:shadow-none text-lg uppercase font-black"
              >
                Tentar Novamente
              </button>
              <button
                onClick={() => setActiveScreen('lobby')}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border-2 border-black text-sm uppercase font-bold"
              >
                Voltar ao Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
