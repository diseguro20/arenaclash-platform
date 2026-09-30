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

// Fall Platform Data Interface
interface FallingTile {
  mesh: THREE.Mesh;
  initialY: number;
  isStepped: boolean;
  stepTimer: number;
  isFalling: boolean;
  fallSpeed: number;
  isRespawning: boolean;
  respawnTimer: number;
}

// Swinging Pendulum Data Interface
interface SwingingPendulum {
  group: THREE.Group;
  pivotMesh: THREE.Object3D;
  hammerMesh: THREE.Mesh;
  speed: number;
  limit: number;
  offset: number;
}

// Movable Pusher Data Interface
interface MovableObstacle {
  mesh: THREE.Mesh;
  startPos: THREE.Vector3;
  distance: number;
  speed: number;
  horizontal: boolean;
  dir: number;
}

// Spinning Rotator Data Interface
interface SpinnerObstacle {
  group: THREE.Group;
  speed: number;
}

// Bounce Pad Data Interface
interface BouncePad {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
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

export default function GamePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<PlayerProfile>({
    name: 'Diego Seguro',
    phone: '11982854183',
    saldo: 575.0,
    bonus: 0.0,
    avatar: '/images/character_1_25.webp',
    victories: 14
  });

  // UI Navigation State
  const [activeScreen, setActiveScreen] = useState<'lobby' | 'modes' | 'customization' | 'friends' | 'playing' | 'victory' | 'gameover'>('lobby');
  const [selectedMode, setSelectedMode] = useState<'maratona' | 'trio' | 'x1'>('maratona');
  const [selectedFee, setSelectedFee] = useState<number>(5.0);
  const [selectedColor, setSelectedColor] = useState<string>('#ff3366'); // Vibrant Fall Guys Pink
  const [selectedCharId, setSelectedCharId] = useState<number>(1);
  const [customTab, setCustomTab] = useState<'colors' | 'accessories' | 'faces' | 'icons'>('colors');
  const [roomCode, setRoomCode] = useState<string>('');
  const [inputCode, setInputCode] = useState<string>('');
  const [activeRaceId, setActiveRaceId] = useState<string>('');

  // Live HUD In-Game State (matching GameManager.cs)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [lives, setLives] = useState<number>(3);
  const [courseProgress, setCourseProgress] = useState<number>(0); // 0 to 100%
  const [countdown, setCountdown] = useState<number | null>(null);
  const [winnings, setWinnings] = useState<number>(0);
  const [checkpointReached, setCheckpointReached] = useState<number>(0);

  // WebGL Mount Ref
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Joystick Touch State
  const touchState = useRef<{
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

  // Camera Orbit State
  const cameraOrbit = useRef<{
    yaw: number;
    pitch: number;
    isDragging: boolean;
    lastMouseX: number;
    lastMouseY: number;
    touchId: number | null;
  }>({
    yaw: 0,
    pitch: 0.35,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
    touchId: null
  });

  // Keyboard Keys State
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // WebGL Three.js Engine State
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
    pendulums: SwingingPendulum[];
    pushers: MovableObstacle[];
    spinners: SpinnerObstacle[];
    fallingTiles: FallingTile[];
    bouncePads: BouncePad[];
    coins: CoinObject[];
    rbCubes: RBCube[];
    checkpoints: number[];
    lastCheckpointIndex: number;
    playerPos: THREE.Vector3;
    playerVel: THREE.Vector3;
    isGrounded: boolean;
    isStunned: boolean;
    stunTimer: number;
    walkAnimTimer: number;
    isGameActive: boolean;
    startTime: number;
    animId: number;
    platforms: THREE.Box3[];
  } | null>(null);

  // Audio Synthesizer (Realistic Sound FX)
  const playSfx = (type: 'beep' | 'go' | 'coin' | 'jump' | 'bounce' | 'hit' | 'fall' | 'checkpoint' | 'win') => {
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
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'go') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === 'coin') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(987.77, now);
        osc.frequency.setValueAtTime(1318.51, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'jump') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(540, now + 0.18);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === 'bounce') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(680, now + 0.35);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'hit') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'fall') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.6);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
      } else if (type === 'checkpoint') {
        [440, 554.37, 659.25].forEach((f, idx) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          o.frequency.setValueAtTime(f, now + idx * 0.08);
          g.gain.setValueAtTime(0.2, now + idx * 0.08);
          g.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.2);
          o.start(now + idx * 0.08);
          o.stop(now + idx * 0.08 + 0.2);
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
            saldo: Number(data.user.saldo ?? 575),
            bonus: Number(data.user.bonus ?? 0)
          }));
        }
      })
      .catch(() => {});
  }, []);

  // Format Time Helper (MM:SS) matching GameManager.cs
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  // START 3D OBSTACLE COURSE
  const startRace = (fee: number) => {
    if (profile.saldo < fee) {
      alert('Saldo insuficiente para entrar nesta corrida!');
      return;
    }

    // Deduct entry fee & call backend iniciar
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
    setCheckpointReached(0);

    // 3-2-1 Countdown
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

  // Jump Action (Spacebar or Touch Button)
  const handleJump = () => {
    const st = threeState.current;
    if (!st || !st.isGameActive || st.isStunned) return;
    if (st.isGrounded) {
      st.playerVel.y = 11.5;
      st.isGrounded = false;
      playSfx('jump');
    }
  };

  // Checkpoint Respawn Action
  const respawnAtCheckpoint = () => {
    const st = threeState.current;
    if (!st) return;

    const cpX = st.checkpoints[st.lastCheckpointIndex] ?? 0;
    st.playerPos.set(cpX, 4.0, 0);
    st.playerVel.set(0, 0, 0);
    st.isGrounded = false;
    st.isStunned = false;
    st.stunTimer = 0;
  };

  // BUILD & RUN THREE.JS 3D OBSTACLE COURSE
  useEffect(() => {
    if (activeScreen !== 'playing' || !mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x6ec6ff); // Bright Sky Blue Toon Background
    scene.fog = new THREE.Fog(0x6ec6ff, 120, 320);

    const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 1000);
    camera.position.set(-8, 5, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x88bbdd, 0.9);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff6d5, 1.4);
    dirLight.position.set(40, 80, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 300;
    dirLight.shadow.camera.left = -60;
    dirLight.shadow.camera.right = 60;
    dirLight.shadow.camera.top = 60;
    dirLight.shadow.camera.bottom = -60;
    scene.add(dirLight);

    // 3. Floating Stylized Voxel Clouds & Distant Toon Islands
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    for (let c = 0; c < 24; c++) {
      const cloudGroup = new THREE.Group();
      const numPuffs = 4 + Math.floor(Math.random() * 4);
      for (let p = 0; p < numPuffs; p++) {
        const puffGeo = new THREE.BoxGeometry(
          4 + Math.random() * 4,
          2 + Math.random() * 2,
          3 + Math.random() * 3
        );
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        puff.position.set((p - numPuffs / 2) * 3, Math.random() * 1.5, Math.random() * 2);
        cloudGroup.add(puff);
      }
      cloudGroup.position.set(
        Math.random() * 300 - 40,
        25 + Math.random() * 30,
        Math.random() * 180 - 90
      );
      scene.add(cloudGroup);
    }

    // Distant Floating Floating Islands (Decorations from Toon Environments Lite)
    const islandMat = new THREE.MeshStandardMaterial({ color: 0x48bb78, roughness: 0.8 });
    const dirtMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 });
    for (let i = 0; i < 8; i++) {
      const island = new THREE.Group();
      const topGeo = new THREE.CylinderGeometry(8, 10, 3, 7);
      const top = new THREE.Mesh(topGeo, islandMat);
      island.add(top);

      const bottomGeo = new THREE.ConeGeometry(9.8, 12, 7);
      const bottom = new THREE.Mesh(bottomGeo, dirtMat);
      bottom.rotation.x = Math.PI;
      bottom.position.y = -7.5;
      island.add(bottom);

      island.position.set(
        i * 35 - 30,
        -15 - Math.random() * 10,
        (i % 2 === 0 ? 1 : -1) * (35 + Math.random() * 25)
      );
      scene.add(island);
    }

    // 4. Data Arrays for Physics & Obstacles
    const platforms: THREE.Box3[] = [];
    const pendulums: SwingingPendulum[] = [];
    const pushers: MovableObstacle[] = [];
    const spinners: SpinnerObstacle[] = [];
    const fallingTiles: FallingTile[] = [];
    const bouncePads: BouncePad[] = [];
    const coins: CoinObject[] = [];
    const rbCubes: RBCube[] = [];
    const checkpoints: number[] = [0, 52, 92, 138, 170];

    // Helper to Create Platforms with Solid Physics Colliders
    const createPlatform = (x: number, y: number, z: number, w: number, h: number, d: number, color: number) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.4,
        metalness: 0.1
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      scene.add(mesh);

      // Register Bounding Box for Ground Collisions
      const min = new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2);
      const max = new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2);
      platforms.push(new THREE.Box3(min, max));
      return mesh;
    };

    // Helper to Spawn Floating Coins
    const spawnCoin = (x: number, y: number, z: number) => {
      const coinGroup = new THREE.Group();
      coinGroup.position.set(x, y, z);

      const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.12, 16);
      const coinMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.85,
        roughness: 0.15,
        emissive: 0xffaa00,
        emissiveIntensity: 0.4
      });
      const coinMesh = new THREE.Mesh(coinGeo, coinMat);
      coinMesh.rotation.x = Math.PI / 2;
      coinGroup.add(coinMesh);

      // Inner Star Emblem
      const starGeo = new THREE.BoxGeometry(0.4, 0.4, 0.14);
      const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const star = new THREE.Mesh(starGeo, starMat);
      star.rotation.z = Math.PI / 4;
      coinGroup.add(star);

      scene.add(coinGroup);
      coins.push({ mesh: coinGroup, collected: false });
    };

    // ==============================================================
    // 5. BUILD LEVEL: AUTHENTIC SCENE2 OBSTACLE COURSE
    // ==============================================================

    // --- ZONE 0: START PLATFORM (x: -8 to 8) ---
    createPlatform(0, 0, 0, 16, 2, 14, 0xffbb00); // Yellow Start Deck

    // Start Checkered Arch
    const archMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
    const post1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6, 0.8), archMat);
    post1.position.set(0, 3, -6.5);
    scene.add(post1);
    const post2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6, 0.8), archMat);
    post2.position.set(0, 3, 6.5);
    scene.add(post2);
    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 14), archMat);
    crossbar.position.set(0, 6, 0);
    scene.add(crossbar);

    // --- STAGE 1: SWINGING PENDULUMS (x: 10 to 50) ---
    // Narrow walkway bridge (w: 40, d: 6)
    createPlatform(30, 0, 0, 38, 2, 6.5, 0x38bdf8); // Sky Blue Walkway

    // 4 Massive Swinging Pendulums (Pendulum.cs with limit=75 deg)
    const pendulumXs = [16, 24, 32, 40];
    pendulumXs.forEach((pX, idx) => {
      const gantryArch = new THREE.Group();
      gantryArch.position.set(pX, 0, 0);

      // Support pillars
      const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 10, 8), archMat);
      p1.position.set(0, 5, -4.5);
      gantryArch.add(p1);
      const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 10, 8), archMat);
      p2.position.set(0, 5, 4.5);
      gantryArch.add(p2);
      const topBeam = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 9.5), archMat);
      topBeam.position.set(0, 10, 0);
      gantryArch.add(topBeam);

      // The Pendulum Arm & Hammer Head
      const pivotObj = new THREE.Object3D();
      pivotObj.position.set(0, 10, 0);

      const shaftMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 8.5, 8), shaftMat);
      shaft.position.set(0, -4.25, 0);
      pivotObj.add(shaft);

      // Massive Round Hammer Head
      const hammerMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5, roughness: 0.2 });
      const hammer = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 1.6, 16), hammerMat);
      hammer.rotation.z = Math.PI / 2;
      hammer.position.set(0, -8.4, 0);
      hammer.castShadow = true;
      pivotObj.add(hammer);

      gantryArch.add(pivotObj);
      scene.add(gantryArch);

      pendulums.push({
        group: gantryArch,
        pivotMesh: pivotObj,
        hammerMesh: hammer,
        speed: 2.2,
        limit: 1.2, // ~70 degrees in radians
        offset: idx * 0.9
      });

      // Coins in between pendulums
      spawnCoin(pX + 4, 1.4, (idx % 2 === 0 ? 1.5 : -1.5));
    });

    // Checkpoint 1 Deck (x: 52)
    createPlatform(52, 0, 0, 10, 2, 10, 0x10b981); // Emerald Checkpoint
    spawnCoin(52, 1.4, 0);

    // --- STAGE 2: SLIDING PUSHERS & MOVING WALLS (x: 58 to 90) ---
    createPlatform(72, 0, 0, 32, 2, 9, 0xa855f7); // Purple Pusher Platform

    // 4 Sliding Pusher Blocks (MovableObs.cs)
    const pusherXs = [62, 68, 76, 82];
    pusherXs.forEach((pX, idx) => {
      const pusherGeo = new THREE.BoxGeometry(2.5, 3.5, 5);
      const pusherMat = new THREE.MeshStandardMaterial({
        color: idx % 2 === 0 ? 0xf97316 : 0xeab308,
        roughness: 0.3,
        metalness: 0.3
      });
      const pusherMesh = new THREE.Mesh(pusherGeo, pusherMat);
      pusherMesh.position.set(pX, 2.75, (idx % 2 === 0 ? -4 : 4));
      pusherMesh.castShadow = true;
      scene.add(pusherMesh);

      pushers.push({
        mesh: pusherMesh,
        startPos: new THREE.Vector3(pX, 2.75, 0),
        distance: 4.8,
        speed: 3.5,
        horizontal: true,
        dir: idx % 2 === 0 ? 1 : -1
      });

      spawnCoin(pX, 1.4, 0);
    });

    // Checkpoint 2 Deck (x: 92)
    createPlatform(92, 0, 0, 10, 2, 10, 0x10b981);
    spawnCoin(92, 1.4, 0);

    // --- STAGE 3: SPINNING ROTATOR & CIRCULAR PLATFORM (x: 98 to 135) ---
    // Connective bridge
    createPlatform(103, 0, 0, 14, 2, 6, 0xec4899);

    // Rotating Circular Arena (RotationPlat.prefab)
    const rotArenaGeo = new THREE.CylinderGeometry(11, 11, 2, 32);
    const rotArenaMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.4 });
    const rotArena = new THREE.Mesh(rotArenaGeo, rotArenaMat);
    rotArena.position.set(120, 0, 0);
    rotArena.receiveShadow = true;
    scene.add(rotArena);
    platforms.push(new THREE.Box3(new THREE.Vector3(109, -1, -11), new THREE.Vector3(131, 1, 11)));

    // Motorized Center Spindle with 4 Sweeper Arms (Rotator.cs)
    const spinnerGroup = new THREE.Group();
    spinnerGroup.position.set(120, 1, 0);

    const spindleGeo = new THREE.CylinderGeometry(1.2, 1.2, 3, 16);
    const spindleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const spindle = new THREE.Mesh(spindleGeo, spindleMat);
    spindle.position.y = 1.5;
    spinnerGroup.add(spindle);

    // 4 Long Sweeping Crossbar Arms
    for (let armIdx = 0; armIdx < 4; armIdx++) {
      const armGeo = new THREE.BoxGeometry(0.7, 0.9, 9.8);
      const armMat = new THREE.MeshStandardMaterial({
        color: armIdx % 2 === 0 ? 0xff0055 : 0xffdd00,
        roughness: 0.3
      });
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.position.set(0, 0.8, 5);
      arm.rotation.y = (armIdx * Math.PI) / 2;
      arm.castShadow = true;
      spinnerGroup.add(arm);
    }
    scene.add(spinnerGroup);
    spinners.push({ group: spinnerGroup, speed: 1.8 });

    // Coins on the rotating arena
    spawnCoin(114, 1.4, 5);
    spawnCoin(126, 1.4, -5);
    spawnCoin(120, 1.4, 7);
    spawnCoin(120, 1.4, -7);

    // Checkpoint 3 Deck (x: 138)
    createPlatform(138, 0, 0, 10, 2, 8, 0x10b981);
    spawnCoin(138, 1.4, 0);

    // --- STAGE 4: COLLAPSING / FALLING PLATFORMS (x: 145 to 168) ---
    // Grid of separate tiles that drop when stepped on (FallPlat.cs)
    const tileRows = [-2.5, 0, 2.5];
    const tileXs = [146, 152, 158, 164];
    tileXs.forEach(tX => {
      tileRows.forEach(tZ => {
        const tileGeo = new THREE.BoxGeometry(3.6, 0.8, 2.2);
        const tileMat = new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          roughness: 0.5
        });
        const tileMesh = new THREE.Mesh(tileGeo, tileMat);
        tileMesh.position.set(tX, 0.6, tZ);
        tileMesh.receiveShadow = true;
        scene.add(tileMesh);

        fallingTiles.push({
          mesh: tileMesh,
          initialY: 0.6,
          isStepped: false,
          stepTimer: 0,
          isFalling: false,
          fallSpeed: 0,
          isRespawning: false,
          respawnTimer: 0
        });

        // Spawn occasional coin on safe routes
        if (Math.random() < 0.45) {
          spawnCoin(tX, 1.8, tZ);
        }
      });
    });

    // Checkpoint 4 Deck (x: 170)
    createPlatform(170, 0, 0, 10, 2, 10, 0x10b981);
    spawnCoin(170, 1.4, 0);

    // --- STAGE 5: TRAMPOLINE BOUNCERS & KNOCKDOWN CUBES (x: 174 to 196) ---
    // Lower bounce pad launch deck
    createPlatform(177, 0, 0, 8, 2, 8, 0x3b82f6);

    // Glowing Trampoline Bounce Pad (Bounce.cs)
    const padGeo = new THREE.CylinderGeometry(2.2, 2.4, 0.4, 24);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.8,
      roughness: 0.2
    });
    const padMesh = new THREE.Mesh(padGeo, padMat);
    padMesh.position.set(177, 1.2, 0);
    scene.add(padMesh);

    // Upward arrow graphic on pad
    const arrowGeo = new THREE.ConeGeometry(0.8, 1.2, 3);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.rotation.x = -Math.PI / 2;
    arrow.position.set(177, 1.42, 0);
    scene.add(arrow);

    bouncePads.push({
      mesh: padMesh,
      position: new THREE.Vector3(177, 1.2, 0),
      force: 20.0 // Big launch impulse!
    });

    // Elevated Destination Deck reached via Trampoline Jump (y: 6.0, x: 188)
    createPlatform(190, 6.0, 0, 16, 2, 10, 0xf43f5e);
    spawnCoin(184, 9.5, 0); // High coin in the air!
    spawnCoin(190, 7.4, 2);
    spawnCoin(190, 7.4, -2);

    // Stacks of Knockdown Physics Toy Cubes (RBCubes.prefab)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const cubeGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
        const cubeMat = new THREE.MeshStandardMaterial({
          color: ((row + col) % 3 === 0 ? 0xfacc15 : (row + col) % 3 === 1 ? 0x38bdf8 : 0xf43f5e),
          roughness: 0.4
        });
        const cMesh = new THREE.Mesh(cubeGeo, cubeMat);
        const cubeX = 189 + col * 1.0;
        const cubeY = 7.5 + row * 0.95;
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
          groundY: 7.45
        });
      }
    }

    // --- STAGE 6: THE CHECKERED FINISH LINE (x: 200+) ---
    createPlatform(206, 6.0, 0, 16, 2, 12, 0xffbb00); // Victory Platform

    // Grand Checkered Finish Line Arch & Banner (FinishLine.cs at threshold=199)
    const finishArchGroup = new THREE.Group();
    finishArchGroup.position.set(200, 7.0, 0);

    const fPostGeo = new THREE.BoxGeometry(1, 8, 1);
    const fPostMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const fPost1 = new THREE.Mesh(fPostGeo, fPostMat);
    fPost1.position.set(0, 4, -5.5);
    finishArchGroup.add(fPost1);

    const fPost2 = new THREE.Mesh(fPostGeo, fPostMat);
    fPost2.position.set(0, 4, 5.5);
    finishArchGroup.add(fPost2);

    const fCrossGeo = new THREE.BoxGeometry(1.2, 1.8, 12);
    const fCross = new THREE.Mesh(fCrossGeo, fPostMat);
    fCross.position.set(0, 7.5, 0);
    finishArchGroup.add(fCross);

    // Canvas Checkered Texture for Finish Banner
    const checkCanvas = document.createElement('canvas');
    checkCanvas.width = 256;
    checkCanvas.height = 64;
    const cCtx = checkCanvas.getContext('2d');
    if (cCtx) {
      const size = 32;
      for (let x = 0; x < 256; x += size) {
        for (let y = 0; y < 64; y += size) {
          cCtx.fillStyle = ((x / size + y / size) % 2 === 0) ? '#ffffff' : '#000000';
          cCtx.fillRect(x, y, size, size);
        }
      }
    }
    const checkTex = new THREE.CanvasTexture(checkCanvas);
    const bannerGeo = new THREE.PlaneGeometry(11.6, 1.4);
    const bannerMat = new THREE.MeshBasicMaterial({ map: checkTex, side: THREE.DoubleSide });
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.rotation.y = Math.PI / 2;
    banner.position.set(-0.62, 7.5, 0);
    finishArchGroup.add(banner);

    scene.add(finishArchGroup);

    // ==============================================================
    // 6. BUILD FALL GUYS BEAN CHARACTER (Player.prefab)
    // ==============================================================
    const playerGroup = new THREE.Group();
    playerGroup.position.set(0, 1.4, 0);

    // Capsule Bean Body
    const bodyMat = new THREE.MeshStandardMaterial({
      color: selectedColor,
      roughness: 0.35,
      metalness: 0.1
    });

    // Bean Main Capsule
    const bodyGeo = new THREE.CapsuleGeometry(0.5, 0.7, 16, 16);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.85;
    bodyMesh.castShadow = true;
    playerGroup.add(bodyMesh);

    // Iconic White Oval Visor / Faceplate
    const visorGeo = new THREE.BoxGeometry(0.48, 0.38, 0.22);
    const visorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0.38, 1.0, 0); // Facing positive X (forward along course)
    visor.castShadow = true;
    playerGroup.add(visor);

    // Expressive Black Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(0.48, 1.04, -0.12);
    playerGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.48, 1.04, 0.12);
    playerGroup.add(rightEye);

    // Cute Stubby Limbs
    const limbMat = new THREE.MeshStandardMaterial({ color: selectedColor, roughness: 0.4 });
    const legGeo = new THREE.CapsuleGeometry(0.14, 0.3, 8, 8);
    const leftLeg = new THREE.Mesh(legGeo, limbMat);
    leftLeg.position.set(0, 0.22, -0.22);
    leftLeg.castShadow = true;
    playerGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, limbMat);
    rightLeg.position.set(0, 0.22, 0.22);
    rightLeg.castShadow = true;
    playerGroup.add(rightLeg);

    const armGeo = new THREE.CapsuleGeometry(0.12, 0.35, 8, 8);
    const leftArm = new THREE.Mesh(armGeo, limbMat);
    leftArm.position.set(0, 0.8, -0.52);
    leftArm.rotation.x = -0.2;
    leftArm.castShadow = true;
    playerGroup.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, limbMat);
    rightArm.position.set(0, 0.8, 0.52);
    rightArm.rotation.x = 0.2;
    rightArm.castShadow = true;
    playerGroup.add(rightArm);

    scene.add(playerGroup);

    // 7. Store Engine State in Ref
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
      pendulums,
      pushers,
      spinners,
      fallingTiles,
      bouncePads,
      coins,
      rbCubes,
      checkpoints,
      lastCheckpointIndex: 0,
      playerPos: new THREE.Vector3(0, 1.4, 0),
      playerVel: new THREE.Vector3(0, 0, 0),
      isGrounded: true,
      isStunned: false,
      stunTimer: 0,
      walkAnimTimer: 0,
      isGameActive: false,
      startTime: performance.now(),
      animId: 0,
      platforms
    };

    // 8. Event Listeners: Keyboard & Mouse
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        handleJump();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    // Mouse Drag to Orbit Camera
    const handleMouseDown = (e: MouseEvent) => {
      cameraOrbit.current.isDragging = true;
      cameraOrbit.current.lastMouseX = e.clientX;
      cameraOrbit.current.lastMouseY = e.clientY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!cameraOrbit.current.isDragging) return;
      const dx = e.clientX - cameraOrbit.current.lastMouseX;
      const dy = e.clientY - cameraOrbit.current.lastMouseY;
      cameraOrbit.current.lastMouseX = e.clientX;
      cameraOrbit.current.lastMouseY = e.clientY;

      cameraOrbit.current.yaw -= dx * 0.006;
      cameraOrbit.current.pitch = Math.max(-0.2, Math.min(1.1, cameraOrbit.current.pitch + dy * 0.006));
    };

    const handleMouseUp = () => {
      cameraOrbit.current.isDragging = false;
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
    window.addEventListener('resize', handleResize);

    // ==============================================================
    // 9. MAIN GAME LOOP: 60 FPS PHYSICS & INTERACTION
    // ==============================================================
    let lastTime = performance.now();

    const animate = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.06); // Delta time clamp
      lastTime = now;

      const st = threeState.current;
      if (!st) return;

      if (st.isGameActive) {
        // --- A. Live Timer ---
        const elapsed = (now - st.startTime) / 1000;
        setElapsedSeconds(elapsed);

        // --- B. Movement Input Processing ---
        let inputX = 0; // Forward / Back
        let inputZ = 0; // Left / Right

        // Keyboard WASD / Arrows
        if (keysPressed.current['w'] || keysPressed.current['arrowup']) inputX += 1;
        if (keysPressed.current['s'] || keysPressed.current['arrowdown']) inputX -= 1;
        if (keysPressed.current['a'] || keysPressed.current['arrowleft']) inputZ -= 1;
        if (keysPressed.current['d'] || keysPressed.current['arrowright']) inputZ += 1;

        // Virtual Touch Joystick
        if (touchState.current.active) {
          inputX -= touchState.current.dy; // joystick up is negative Y
          inputZ += touchState.current.dx;
        }

        // Normalize input vector
        const inputLen = Math.hypot(inputX, inputZ);
        if (inputLen > 1) {
          inputX /= inputLen;
          inputZ /= inputLen;
        }

        // Camera-relative Movement Calculation (CharacterControls.cs)
        const camYaw = cameraOrbit.current.yaw;
        const moveForwardX = Math.cos(camYaw);
        const moveForwardZ = Math.sin(camYaw);
        const moveRightX = -Math.sin(camYaw);
        const moveRightZ = Math.cos(camYaw);

        const moveDirX = inputX * moveForwardX + inputZ * moveRightX;
        const moveDirZ = inputX * moveForwardZ + inputZ * moveRightZ;

        // Apply Movement Speed
        const speed = 9.2;
        if (!st.isStunned) {
          st.playerVel.x = moveDirX * speed;
          st.playerVel.z = moveDirZ * speed;
        } else {
          // Friction when stunned
          st.playerVel.x *= 0.92;
          st.playerVel.z *= 0.92;
          st.stunTimer -= dt;
          if (st.stunTimer <= 0) {
            st.isStunned = false;
          }
        }

        // Apply Gravity
        st.playerVel.y -= 25.0 * dt;

        // Move Player
        st.playerPos.x += st.playerVel.x * dt;
        st.playerPos.y += st.playerVel.y * dt;
        st.playerPos.z += st.playerVel.z * dt;

        // Rotate Character to Face Movement Direction
        if (Math.hypot(st.playerVel.x, st.playerVel.z) > 0.4 && !st.isStunned) {
          const targetAngle = Math.atan2(st.playerVel.z, st.playerVel.x);
          let diff = targetAngle - st.playerGroup.rotation.y;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          st.playerGroup.rotation.y += diff * 14 * dt;

          // Walking Wobble & Limb Animation
          st.walkAnimTimer += dt * 14;
          st.leftLeg.rotation.z = Math.sin(st.walkAnimTimer) * 0.6;
          st.rightLeg.rotation.z = -Math.sin(st.walkAnimTimer) * 0.6;
          st.leftArm.rotation.z = -Math.sin(st.walkAnimTimer) * 0.5;
          st.rightArm.rotation.z = Math.sin(st.walkAnimTimer) * 0.5;
          st.bodyMesh.rotation.z = Math.sin(st.walkAnimTimer * 0.5) * 0.08;
        } else {
          // Idle Stance
          st.leftLeg.rotation.z = 0;
          st.rightLeg.rotation.z = 0;
          st.leftArm.rotation.z = 0;
          st.rightArm.rotation.z = 0;
          st.bodyMesh.rotation.z = 0;
        }

        // Jumping Arm / Leg Spread
        if (!st.isGrounded) {
          st.leftArm.rotation.z = -0.9;
          st.rightArm.rotation.z = 0.9;
          st.leftLeg.rotation.x = 0.4;
          st.rightLeg.rotation.x = -0.4;
        }

        // --- C. Platform Ground Collisions ---
        st.isGrounded = false;
        const playerRadius = 0.5;
        const pFeet = st.playerPos.y;

        // Check against solid platforms
        for (const box of st.platforms) {
          if (
            st.playerPos.x >= box.min.x - playerRadius &&
            st.playerPos.x <= box.max.x + playerRadius &&
            st.playerPos.z >= box.min.z - playerRadius &&
            st.playerPos.z <= box.max.z + playerRadius
          ) {
            const surfaceY = box.max.y;
            if (pFeet <= surfaceY + 0.2 && pFeet >= surfaceY - 1.2 && st.playerVel.y <= 0) {
              st.playerPos.y = surfaceY;
              st.playerVel.y = 0;
              st.isGrounded = true;
              break;
            }
          }
        }

        // --- D. Falling Platform Logic (FallPlat.cs) ---
        st.fallingTiles.forEach(tile => {
          if (!tile.isFalling && !tile.isRespawning) {
            const tPos = tile.mesh.position;
            if (
              Math.abs(st.playerPos.x - tPos.x) < 1.9 &&
              Math.abs(st.playerPos.z - tPos.z) < 1.2
            ) {
              const surfaceY = tPos.y + 0.4;
              if (pFeet <= surfaceY + 0.2 && pFeet >= surfaceY - 0.8 && st.playerVel.y <= 0) {
                st.playerPos.y = surfaceY;
                st.playerVel.y = 0;
                st.isGrounded = true;

                // Stepped on! Trigger shake & fall timer
                if (!tile.isStepped) {
                  tile.isStepped = true;
                  (tile.mesh.material as THREE.MeshStandardMaterial).color.setHex(0xef4444);
                }
              }
            }

            if (tile.isStepped) {
              tile.stepTimer += dt;
              // Shake
              tile.mesh.position.y = tile.initialY + (Math.random() - 0.5) * 0.08;
              if (tile.stepTimer > 0.55) {
                tile.isFalling = true;
                tile.fallSpeed = 2.0;
              }
            }
          } else if (tile.isFalling) {
            tile.fallSpeed += 24 * dt;
            tile.mesh.position.y -= tile.fallSpeed * dt;
            if (tile.mesh.position.y < -30) {
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

        // --- E. Trampoline Bounce Pads (Bounce.cs) ---
        st.bouncePads.forEach(pad => {
          if (
            Math.hypot(st.playerPos.x - pad.position.x, st.playerPos.z - pad.position.z) < 2.0 &&
            Math.abs(st.playerPos.y - pad.position.y) < 1.0
          ) {
            st.playerVel.y = pad.force;
            st.isGrounded = false;
            playSfx('bounce');
            pad.mesh.scale.set(1.2, 0.6, 1.2);
            setTimeout(() => {
              pad.mesh.scale.set(1.0, 1.0, 1.0);
            }, 180);
          }
        });

        // --- F. Swinging Pendulums (Pendulum.cs) ---
        st.pendulums.forEach(pend => {
          const angle = pend.limit * Math.sin(now * 0.001 * pend.speed + pend.offset);
          pend.pivotMesh.rotation.x = angle;

          // Get Hammer World Position
          const hammerWorld = new THREE.Vector3();
          pend.hammerMesh.getWorldPosition(hammerWorld);

          // Collision with Player
          const distToHammer = hammerWorld.distanceTo(st.playerPos.clone().add(new THREE.Vector3(0, 0.8, 0)));
          if (distToHammer < 1.6) {
            playSfx('hit');
            st.isStunned = true;
            st.stunTimer = 0.6;
            // Knockback impulse in swing direction
            const swingDir = Math.cos(now * 0.001 * pend.speed + pend.offset) > 0 ? 1 : -1;
            st.playerVel.set(-4, 7, swingDir * 16);
          }
        });

        // --- G. Sliding Pushers (MovableObs.cs) ---
        st.pushers.forEach(pusher => {
          const pos = pusher.mesh.position;
          pos.z += pusher.dir * pusher.speed * dt;
          if (Math.abs(pos.z) > pusher.distance) {
            pusher.dir *= -1;
          }

          // Collision with Player
          if (
            Math.abs(st.playerPos.x - pos.x) < 1.6 &&
            Math.abs(st.playerPos.z - pos.z) < 2.8 &&
            Math.abs(st.playerPos.y - pos.y) < 2.0
          ) {
            playSfx('hit');
            st.isStunned = true;
            st.stunTimer = 0.4;
            st.playerVel.z = pusher.dir * 14;
            st.playerVel.y = 5;
          }
        });

        // --- H. Spinning Rotator Arms (Rotator.cs) ---
        st.spinners.forEach(spinner => {
          spinner.group.rotation.y += spinner.speed * dt;

          // Check distance to center spindle
          const spinPos = spinner.group.position;
          const distToCenter = Math.hypot(st.playerPos.x - spinPos.x, st.playerPos.z - spinPos.z);
          if (distToCenter < 10.5 && st.playerPos.y < spinPos.y + 1.2) {
            // Check angle against 4 arms
            const pAngle = Math.atan2(st.playerPos.z - spinPos.z, st.playerPos.x - spinPos.x);
            const rotAngle = spinner.group.rotation.y;
            for (let i = 0; i < 4; i++) {
              const armAngle = rotAngle + (i * Math.PI) / 2;
              let angleDiff = pAngle - armAngle;
              while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
              while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

              if (Math.abs(angleDiff) < 0.22 && distToCenter > 1.2) {
                // Hit by rotating arm!
                playSfx('hit');
                st.isStunned = true;
                st.stunTimer = 0.45;
                // Tangential fling
                const flingX = -Math.sin(armAngle) * 14;
                const flingZ = Math.cos(armAngle) * 14;
                st.playerVel.set(flingX, 7, flingZ);
                break;
              }
            }
          }
        });

        // --- I. Knockdown Physics Cubes (RBCubes.prefab) ---
        st.rbCubes.forEach(cube => {
          const cPos = cube.mesh.position;
          // Distance to Player
          const dist = Math.hypot(st.playerPos.x - cPos.x, st.playerPos.z - cPos.z);
          if (dist < 1.2 && Math.abs(st.playerPos.y - cPos.y) < 1.2) {
            // Player bumps cube
            cube.vx = st.playerVel.x * 0.8 + (Math.random() - 0.5) * 4;
            cube.vz = st.playerVel.z * 0.8 + (Math.random() - 0.5) * 4;
            cube.vy = 4 + Math.random() * 3;
            cube.rx = Math.random() * 8;
            cube.ry = Math.random() * 8;
          }

          // Apply physics to moving cubes
          if (Math.abs(cube.vx) > 0.05 || Math.abs(cube.vy) > 0.05 || Math.abs(cube.vz) > 0.05) {
            cube.vy -= 22 * dt;
            cPos.x += cube.vx * dt;
            cPos.y += cube.vy * dt;
            cPos.z += cube.vz * dt;
            cube.mesh.rotation.x += cube.rx * dt;
            cube.mesh.rotation.y += cube.ry * dt;

            // Ground bounce
            if (cPos.y <= cube.groundY) {
              cPos.y = cube.groundY;
              cube.vy = -cube.vy * 0.35;
              cube.vx *= 0.85;
              cube.vz *= 0.85;
              cube.rx *= 0.85;
            }
          }
        });

        // --- J. Rotating Gold Coins (Coin.cs) ---
        st.coins.forEach(coin => {
          if (!coin.collected) {
            coin.mesh.rotation.y += 3.5 * dt;
            const dist = coin.mesh.position.distanceTo(st.playerPos.clone().add(new THREE.Vector3(0, 0.8, 0)));
            if (dist < 1.4) {
              coin.collected = true;
              coin.mesh.visible = false;
              playSfx('coin');
              setScore(prev => prev + 1);
            }
          }
        });

        // --- K. Checkpoints & Course Progress ---
        st.checkpoints.forEach((cpX, idx) => {
          if (st.playerPos.x >= cpX && idx > st.lastCheckpointIndex) {
            st.lastCheckpointIndex = idx;
            setCheckpointReached(idx);
            playSfx('checkpoint');
          }
        });

        const progressPercent = Math.min(100, Math.max(0, Math.floor((st.playerPos.x / 200) * 100)));
        setCourseProgress(progressPercent);

        // --- L. Fall Reset / Void Death (FallReset.cs) ---
        if (st.playerPos.y < -14.0) {
          playSfx('fall');
          setLives(prev => {
            const nextLives = prev - 1;
            if (nextLives <= 0) {
              // Game Over
              st.isGameActive = false;
              setTimeout(() => setActiveScreen('gameover'), 600);
            } else {
              // Respawn at Checkpoint
              setTimeout(() => respawnAtCheckpoint(), 400);
            }
            return nextLives;
          });
        }

        // --- M. Checkered Finish Line Cross (FinishLine.cs threshold=199) ---
        if (st.playerPos.x >= 199.0) {
          st.isGameActive = false;
          playSfx('win');
          confetti({ particleCount: 200, spread: 90, origin: { y: 0.55 } });

          // Calculate Winnings & Finalize
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

        // Sync 3D Player Mesh Position
        st.playerGroup.position.copy(st.playerPos);

        // --- N. Third-Person Chase Camera (CameraManager.cs) ---
        const camDist = 7.0;
        const camHeight = 3.6 + cameraOrbit.current.pitch * 3.5;
        const camTargetX = st.playerPos.x - Math.cos(cameraOrbit.current.yaw) * camDist;
        const camTargetZ = st.playerPos.z - Math.sin(cameraOrbit.current.yaw) * camDist;
        const camTargetY = st.playerPos.y + camHeight;

        // Smooth follow
        st.camera.position.x += (camTargetX - st.camera.position.x) * 12 * dt;
        st.camera.position.y += (camTargetY - st.camera.position.y) * 12 * dt;
        st.camera.position.z += (camTargetZ - st.camera.position.z) * 12 * dt;

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
      {/* 1. LOBBY SCREEN (Clean, authentic interface matching original) */}
      {/* ============================================================== */}
      {activeScreen === 'lobby' && (
        <div className="relative w-full max-w-[440px] h-full sm:h-[92vh] sm:rounded-3xl shadow-2xl overflow-hidden bg-gradient-to-b from-[#0c1e54] via-[#10307c] to-[#0a469a] border-0 sm:border-4 sm:border-slate-800 flex flex-col justify-between p-4">
          {/* Top Bar: Profile & Saldo */}
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

              {/* SACAR & DEPOSITAR Quick Links */}
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

            {/* Money Box */}
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

          {/* Central Bean Character Graphic Preview */}
          <div className="relative flex-1 flex flex-col items-center justify-center z-10">
            <div className="relative flex flex-col items-center animate-bounce-gentle">
              <div
                className="w-36 h-48 rounded-full border-4 border-black shadow-2xl relative flex flex-col items-center justify-center"
                style={{ backgroundColor: selectedColor }}
              >
                {/* White Visor */}
                <div className="w-24 h-16 bg-white rounded-2xl border-3 border-black shadow-inner flex items-center justify-around px-4 mt-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-black" />
                  <div className="w-3.5 h-3.5 rounded-full bg-black" />
                </div>
                {/* Fall Guys Bean Badge */}
                <span className="text-[10px] text-white/90 font-black uppercase mt-3 tracking-widest bg-black/30 px-2 py-0.5 rounded-full">
                  OBSTACLE RUNNER
                </span>
              </div>
              <img
                src="/images/base_24.webp"
                alt="Pedestal"
                className="w-60 h-auto -mt-6 object-contain drop-shadow-2xl"
              />
            </div>
          </div>

          {/* Action Buttons: "VS Jogar com Amigos" & "JOGAR" */}
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

          {/* Bottom Bar */}
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
      {/* 2. MODE SELECTION SCREEN (Fee & Mode Selection)               */}
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

          {/* Mode Tabs */}
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

          {/* Mode Info Box */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 border-2 border-blue-500 rounded-2xl p-4 shadow-lg text-center my-3">
            <h4 className="text-yellow-400 text-lg uppercase font-black mb-1">
              Obstacle Course 3D Platformer
            </h4>
            <p className="text-white/90 text-xs leading-relaxed">
              Supere pêndulos gigantescos, blocos empurradores, plataformas giratórias e trampolins para alcançar a linha de chegada e garantir o prêmio em dinheiro!
            </p>
          </div>

          {/* Entry Fee Picker */}
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

          {/* Subscription Box & Green ENTRAR Button */}
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
      {/* 3. CUSTOMIZATION SCREEN (Color picker for Bean character)     */}
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

          {/* Live Preview of Bean */}
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

          {/* Color Grid */}
          <div className="grid grid-cols-4 gap-2.5 pb-4">
            {[
              { hex: '#ff3366', name: 'Rosa Fall Guys' },
              { hex: '#00e5ff', name: 'Ciano Clássico' },
              { hex: '#ffbb00', name: 'Amarelo Ouro' },
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
        <div className="absolute inset-0 w-full h-full overflow-hidden select-none">
          {/* 3D WebGL Canvas Mount */}
          <div ref={mountRef} className="absolute inset-0 w-full h-full z-0 cursor-grab active:cursor-grabbing" />

          {/* TOP HUD (Matching GameManager.cs: TIME, SCORE, PROGRESS) */}
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

            {/* Live Progress Bar (0 to 200m) */}
            <div className="flex-1 max-w-[280px] mx-4 hidden sm:flex flex-col items-center">
              <div className="w-full flex justify-between text-[11px] font-black uppercase text-white mb-1 drop-shadow">
                <span>INÍCIO</span>
                <span>{courseProgress}%</span>
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
              {/* Lives */}
              <div className="bg-black/60 backdrop-blur-md border-2 border-white/30 px-3 py-2 rounded-2xl shadow-xl flex items-center gap-1">
                {[1, 2, 3].map(i => (
                  <span key={i} className={`text-lg transition-opacity ${i <= lives ? 'opacity-100' : 'opacity-20'}`}>
                    ❤️
                  </span>
                ))}
              </div>

              {/* Coins Score */}
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

          {/* Desktop Controls Overlay Banner (Auto-fades) */}
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm border border-white/20 px-4 py-1.5 rounded-full text-xs text-white/90 hidden sm:flex items-center gap-3 z-30 pointer-events-none">
            <span>🎮 <b>WASD</b> ou <b>Setas</b> para mover</span>
            <span>•</span>
            <span><b>ESPAÇO</b> para pular</span>
            <span>•</span>
            <span><b>Arraste o mouse</b> para girar a câmera 360°</span>
          </div>

          {/* 3-2-1 Countdown Overlay */}
          {countdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/30 backdrop-blur-xs pointer-events-none">
              <span className="text-9xl text-yellow-400 font-black stroke-black-6 animate-ping-once drop-shadow-2xl font-mono">
                {countdown}
              </span>
            </div>
          )}

          {/* MOBILE TOUCH CONTROLS (Virtual Analog Joystick + Jump Button) */}
          <div className="absolute inset-0 z-40 pointer-events-none sm:hidden flex flex-col justify-end p-6">
            <div className="flex justify-between items-end w-full">
              {/* Virtual Touch Joystick Base */}
              <div
                className="w-32 h-32 rounded-full border-4 border-white/40 bg-black/40 backdrop-blur-md relative pointer-events-auto flex items-center justify-center touch-none"
                onTouchStart={e => {
                  const touch = e.touches[0];
                  const rect = e.currentTarget.getBoundingClientRect();
                  const centerX = rect.left + rect.width / 2;
                  const centerY = rect.top + rect.height / 2;
                  touchState.current.active = true;
                  touchState.current.startX = centerX;
                  touchState.current.startY = centerY;
                  touchState.current.touchId = touch.identifier;
                }}
                onTouchMove={e => {
                  if (!touchState.current.active) return;
                  for (let i = 0; i < e.touches.length; i++) {
                    const touch = e.touches[i];
                    if (touch.identifier === touchState.current.touchId) {
                      const dx = touch.clientX - touchState.current.startX;
                      const dy = touch.clientY - touchState.current.startY;
                      const maxR = 48;
                      const dist = Math.hypot(dx, dy);
                      const normX = dist > 0 ? (dx / dist) * Math.min(dist, maxR) : 0;
                      const normY = dist > 0 ? (dy / dist) * Math.min(dist, maxR) : 0;
                      touchState.current.dx = normX / maxR;
                      touchState.current.dy = normY / maxR;

                      const stickEl = document.getElementById('touch-stick');
                      if (stickEl) {
                        stickEl.style.transform = `translate(${normX}px, ${normY}px)`;
                      }
                      break;
                    }
                  }
                }}
                onTouchEnd={e => {
                  touchState.current.active = false;
                  touchState.current.dx = 0;
                  touchState.current.dy = 0;
                  touchState.current.touchId = null;
                  const stickEl = document.getElementById('touch-stick');
                  if (stickEl) stickEl.style.transform = 'translate(0px, 0px)';
                }}
              >
                {/* Joystick Floating Stick */}
                <div
                  id="touch-stick"
                  className="w-14 h-14 rounded-full bg-cyan-400 border-2 border-white shadow-[0_0_15px_rgba(0,240,255,0.6)] flex items-center justify-center transition-transform duration-75"
                >
                  <div className="w-4 h-4 rounded-full bg-white/80" />
                </div>
              </div>

              {/* Large Tactile Jump Button */}
              <button
                onTouchStart={e => {
                  e.preventDefault();
                  handleJump();
                }}
                onClick={handleJump}
                className="w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-600 to-green-400 border-4 border-white shadow-[0_0_20px_rgba(16,185,129,0.6)] pointer-events-auto active:scale-90 transition-transform flex flex-col items-center justify-center text-white font-black"
              >
                <span className="text-2xl">⬆️</span>
                <span className="text-xs uppercase tracking-wider">PULAR</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. VICTORY SCREEN MODAL (Matching Scene3.unity)                */}
      {/* ============================================================== */}
      {activeScreen === 'victory' && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/85 backdrop-blur-md z-50 p-4">
          <div className="relative w-full max-w-[380px] bg-[#0c3e7a] border-4 border-black rounded-3xl p-6 shadow-2xl flex flex-col items-center">
            {/* Top Avatar Crown Badge */}
            <div className="absolute -top-12 w-24 h-24 rounded-full border-4 border-black overflow-hidden bg-pink-500 shadow-2xl">
              <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
            </div>

            {/* Victory Headline */}
            <div className="w-[110%] -mx-4 mt-8 py-2 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 border-y-3 border-black text-center shadow-lg transform -rotate-1">
              <h3 className="text-white text-xl font-black uppercase tracking-wider">
                CURSO CONCLUÍDO!
              </h3>
            </div>

            {/* Trophy Icon */}
            <div className="text-6xl my-4 animate-bounce-gentle">🏆</div>

            {/* Results Grid matching Scene3 */}
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

            {/* Buttons */}
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
