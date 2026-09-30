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

// Checkpoint interface
interface Checkpoint {
  x: number;
  y: number;
  z: number;
  radius: number;
  activated: boolean;
}

// Collapsing Platform Data
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

// Swinging Pendulum Data
interface SwingingPendulum {
  group: THREE.Group;
  pivotObj: THREE.Object3D;
  hammerMesh: THREE.Mesh;
  speed: number;
  limit: number;
  offset: number;
}

// Sliding Pusher Data
interface MovableObstacle {
  mesh: THREE.Mesh;
  startZ: number;
  distance: number;
  speed: number;
  dir: number;
  bounds: { minX: number; maxX: number; halfDepth: number };
}

// Spinning Rotator Data
interface SpinnerObstacle {
  group: THREE.Group;
  centerX: number;
  centerZ: number;
  radius: number;
  speed: number;
}

// Trampoline Bounce Pad
interface BouncePad {
  mesh: THREE.Mesh;
  ringMesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  radius: number;
  force: number;
}

// Collectible Coin
interface CoinObject {
  group: THREE.Group;
  x: number;
  y: number;
  z: number;
  collected: boolean;
}

// Stacked Physics Cube
interface KnockCube {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  groundY: number;
}

// Solid Platform Plane for Collision
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
    name: 'Competidor',
    phone: '',
    saldo: 1000,
    bonus: 50,
    avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150',
    victories: 0
  });

  const [activeScreen, setActiveScreen] = useState<'lobby' | 'countdown' | 'playing' | 'victory' | 'defeat'>('lobby');
  const [activeTab, setActiveTab] = useState<'maratona' | 'trio' | 'x1'>('maratona');
  const [selectedFee, setSelectedFee] = useState<number>(1.0);
  const [countdown, setCountdown] = useState<number>(3);
  const [finalTime, setFinalTime] = useState<string>('00:00');
  const [coinsCollected, setCoinsCollected] = useState<number>(0);
  const [placement, setPlacement] = useState<number>(1);
  const [raceProgress, setRaceProgress] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const mountRef = useRef<HTMLDivElement>(null);
  const isPlayingRef = useRef<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Keyboard state
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // Mobile controls
  const touchJoystick = useRef<{ active: boolean; startX: number; startY: number; dx: number; dy: number; touchId: number | null }>({
    active: false,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
    touchId: null
  });

  const touchLook = useRef<{ active: boolean; lastX: number; lastY: number; touchId: number | null }>({
    active: false,
    lastX: 0,
    lastY: 0,
    touchId: null
  });

  // Camera angles
  const cameraAngles = useRef<{ yaw: number; pitch: number; distance: number }>({
    yaw: 0,
    pitch: 0.28,
    distance: 6.8
  });

  const mouseOrbit = useRef<{ isDown: boolean; lastX: number; lastY: number }>({
    isDown: false,
    lastX: 0,
    lastY: 0
  });

  // Sound Synthesizer via Web Audio API (Zero external assets, 100% reliable)
  const playSfx = (type: 'jump' | 'coin' | 'bounce' | 'hit' | 'checkpoint' | 'win') => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;

      if (type === 'jump') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(540, now + 0.18);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === 'coin') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(987, now);
        osc.frequency.setValueAtTime(1318, now + 0.08);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'bounce') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(720, now + 0.28);
        gain.gain.setValueAtTime(0.45, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.linearRampToValueAtTime(60, now + 0.22);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'checkpoint') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.setValueAtTime(659, now + 0.1);
        osc.frequency.setValueAtTime(783, now + 0.2);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'win') {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          o.type = 'triangle';
          o.frequency.value = freq;
          const t = now + idx * 0.12;
          g.gain.setValueAtTime(0.35, t);
          g.gain.linearRampToValueAtTime(0.01, t + 0.35);
          o.start(t);
          o.stop(t + 0.35);
        });
      }
    } catch {
      // Audio context might fail on non-user gesture
    }
  };

  // Three.js Game State
  const threeState = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    playerGroup: THREE.Group;
    dropShadow: THREE.Mesh;
    visorMesh: THREE.Mesh;
    backpackMesh: THREE.Mesh;
    platforms: PlatformBox[];
    fallingTiles: FallingTile[];
    pendulums: SwingingPendulum[];
    pushers: MovableObstacle[];
    spinners: SpinnerObstacle[];
    bouncePads: BouncePad[];
    coins: CoinObject[];
    knockCubes: KnockCube[];
    checkpoints: Checkpoint[];
    currentCheckpoint: THREE.Vector3;
    playerPos: THREE.Vector3;
    playerVel: THREE.Vector3;
    isGrounded: boolean;
    isStunned: boolean;
    stunTimer: number;
    invincibleTimer: number;
    walkTimer: number;
    gameStartTime: number;
    animationFrameId: number;
  } | null>(null);

  // Load User Data
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data && data.user) {
            setProfile({
              name: data.user.nome || 'Diego',
              phone: data.user.telefone || '11982854183',
              saldo: data.user.saldo ?? 1000,
              bonus: data.user.saldo_bonus ?? 50,
              avatar: data.user.avatar || 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150',
              victories: data.user.vitorias ?? 12
            });
          }
        }
      } catch {
        // Fallback
      }
    }
    loadData();
  }, []);

  // Jump action handler
  const handleJump = () => {
    if (!threeState.current || !isPlayingRef.current) return;
    const st = threeState.current;
    if (st.isGrounded && !st.isStunned) {
      // Jump physics matching CharacterControls.cs: Sqrt(2 * jumpHeight * gravity)
      // With jumpHeight = 2.0, gravity = 32.0 => vY = 11.3
      st.playerVel.y = 11.8;
      st.isGrounded = false;
      playSfx('jump');
    }
  };

  // Start Race
  const startRace = async (fee: number) => {
    if (profile.saldo < fee) {
      alert('Saldo insuficiente para entrar na corrida! Por favor, faça uma recarga.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/game/iniciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taxa_inscricao: fee })
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.message || 'Erro ao iniciar partida');
        setLoading(false);
        return;
      }

      setProfile(prev => ({ ...prev, saldo: prev.saldo - fee }));
    } catch {
      // Offline / fallback allow
      setProfile(prev => ({ ...prev, saldo: prev.saldo - fee }));
    }

    setLoading(false);
    setSelectedFee(fee);
    setActiveScreen('countdown');
    setCountdown(3);

    // Reset game state
    if (threeState.current) {
      const st = threeState.current;
      st.playerPos.set(0, 2.0, 0);
      st.playerVel.set(0, 0, 0);
      st.currentCheckpoint.set(0, 2.0, 0);
      st.isStunned = false;
      st.stunTimer = 0;
      st.invincibleTimer = 0;
      cameraAngles.current.yaw = 0;
      cameraAngles.current.pitch = 0.28;
    }

    setCoinsCollected(0);
    setRaceProgress(0);
    setPlacement(1);

    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timer);
          setActiveScreen('playing');
          isPlayingRef.current = true;
          if (threeState.current) {
            threeState.current.gameStartTime = performance.now();
          }
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  // Handle Finish Line Victory
  const handleVictory = async () => {
    if (!isPlayingRef.current) return;
    isPlayingRef.current = false;
    playSfx('win');

    confetti({
      particleCount: 160,
      spread: 80,
      origin: { y: 0.6 }
    });

    const finishSecs = threeState.current
      ? (performance.now() - threeState.current.gameStartTime) / 1000
      : 30;

    const mins = Math.floor(finishSecs / 60);
    const secs = Math.floor(finishSecs % 60);
    setFinalTime(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);

    try {
      const prize = selectedFee * (activeTab === 'x1' ? 1.9 : activeTab === 'trio' ? 2.7 : 4.2);
      const res = await fetch('/api/game/finalizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vitoria: true,
          tempo_segundos: finishSecs,
          taxa_inscricao: selectedFee,
          premio_estimado: prize,
          posicao: 1,
          moedas: coinsCollected
        })
      });

      if (res.ok) {
        const data = await res.json();
        const novoSaldo = data.saldo_novo ?? data.saldo_atualizado;
        if (typeof novoSaldo === 'number') {
          setProfile(p => ({ ...p, saldo: novoSaldo, victories: p.victories + 1 }));
        }
      }
    } catch {
      // Fallback
      setProfile(p => ({
        ...p,
        saldo: p.saldo + selectedFee * 2,
        victories: p.victories + 1
      }));
    }

    setActiveScreen('victory');
  };

  // Setup Three.js 3D Obstacle Course Engine
  useEffect(() => {
    if (!mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x38bdf8); // Sky blue
    scene.fog = new THREE.FogExp2(0x38bdf8, 0.007);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 500);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.4);
    dirLight.position.set(25, 45, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 160;
    dirLight.shadow.camera.left = -25;
    dirLight.shadow.camera.right = 25;
    dirLight.shadow.camera.top = 25;
    dirLight.shadow.camera.bottom = -25;
    scene.add(dirLight);

    // 3. Sky & Distant Clouds Decoration
    const cloudGeo = new THREE.DodecahedronGeometry(6, 1);
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 18; i++) {
      const c = new THREE.Mesh(cloudGeo, cloudMat);
      c.position.set(i * 14 - 10, 25 + Math.sin(i * 1.7) * 8, (i % 2 === 0 ? 1 : -1) * (20 + (i % 5) * 6));
      scene.add(c);
    }

    // 4. Character Model: Authentic Fall Guys Capsule Bean matching Player.prefab
    const playerGroup = new THREE.Group();

    // Bean Body (Capsule geometry)
    const beanMat = new THREE.MeshStandardMaterial({
      color: 0xec4899, // Bright magenta pink bean
      roughness: 0.28,
      metalness: 0.12
    });
    const beanGeo = new THREE.CapsuleGeometry(0.5, 0.9, 16, 32);
    const beanMesh = new THREE.Mesh(beanGeo, beanMat);
    beanMesh.position.y = 0.95;
    beanMesh.castShadow = true;
    playerGroup.add(beanMesh);

    // White Visor Faceplate matching Player.prefab (Cube 1)
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // Dark screen
      roughness: 0.2,
      metalness: 0.8
    });
    const visorGeo = new THREE.BoxGeometry(0.62, 0.38, 0.3);
    const visorMesh = new THREE.Mesh(visorGeo, visorMat);
    visorMesh.position.set(0.35, 1.15, 0); // Facing +X
    playerGroup.add(visorMesh);

    // Glowing cyan face eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const eyeGeo = new THREE.CapsuleGeometry(0.04, 0.12, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(0.52, 1.18, -0.12);
    playerGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.52, 1.18, 0.12);
    playerGroup.add(rightEye);

    // Cute Back Tank / Jetpack
    const packMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.5, roughness: 0.4 });
    const packGeo = new THREE.BoxGeometry(0.3, 0.55, 0.45);
    const backpackMesh = new THREE.Mesh(packGeo, packMat);
    backpackMesh.position.set(-0.45, 1.05, 0);
    playerGroup.add(backpackMesh);

    scene.add(playerGroup);

    // Ground Drop-Shadow for 3D Depth Perception
    const shadowGeo = new THREE.CircleGeometry(0.58, 24);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    });
    const dropShadow = new THREE.Mesh(shadowGeo, shadowMat);
    dropShadow.rotation.x = -Math.PI / 2;
    scene.add(dropShadow);

    // 5. Track Platforms & Obstacles Arrays
    const platforms: PlatformBox[] = [];
    const fallingTiles: FallingTile[] = [];
    const pendulums: SwingingPendulum[] = [];
    const pushers: MovableObstacle[] = [];
    const spinners: SpinnerObstacle[] = [];
    const bouncePads: BouncePad[] = [];
    const coins: CoinObject[] = [];
    const knockCubes: KnockCube[] = [];
    const checkpoints: Checkpoint[] = [];

    // Helper: Add Solid Ground Block
    const addPlatformBlock = (
      minX: number,
      maxX: number,
      minZ: number,
      maxZ: number,
      surfaceY: number,
      color: number,
      withRails = true
    ) => {
      const lenX = maxX - minX;
      const lenZ = maxZ - minZ;
      const thickness = 2.0;
      const centerY = surfaceY - thickness / 2;
      const centerX = (minX + maxX) / 2;
      const centerZ = (minZ + maxZ) / 2;

      const platGeo = new THREE.BoxGeometry(lenX, thickness, lenZ);
      const platMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.45,
        metalness: 0.1
      });
      const platMesh = new THREE.Mesh(platGeo, platMat);
      platMesh.position.set(centerX, centerY, centerZ);
      platMesh.receiveShadow = true;
      scene.add(platMesh);

      platforms.push({ minX, maxX, minZ, maxZ, surfaceY });

      // Guard rails
      if (withRails) {
        const railMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 }); // Yellow rails
        const railGeo = new THREE.CylinderGeometry(0.12, 0.12, lenX, 12);

        const leftRail = new THREE.Mesh(railGeo, railMat);
        leftRail.rotation.z = Math.PI / 2;
        leftRail.position.set(centerX, surfaceY + 0.5, minZ + 0.1);
        scene.add(leftRail);

        const rightRail = new THREE.Mesh(railGeo, railMat);
        rightRail.rotation.z = Math.PI / 2;
        rightRail.position.set(centerX, surfaceY + 0.5, maxZ - 0.1);
        scene.add(rightRail);
      }
    };

    // Helper: Add Coin
    const addCoin = (x: number, y: number, z: number) => {
      const cGroup = new THREE.Group();
      const coinGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.12, 16);
      const coinMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.85,
        roughness: 0.2,
        emissive: 0xffaa00,
        emissiveIntensity: 0.25
      });
      const coinMesh = new THREE.Mesh(coinGeo, coinMat);
      coinMesh.rotation.x = Math.PI / 2;
      cGroup.add(coinMesh);
      cGroup.position.set(x, y, z);
      scene.add(cGroup);
      coins.push({ group: cGroup, x, y, z, collected: false });
    };

    // --- COURSE CONSTRUCTION MATCHING ObstacleCoursePack & Scene2.unity ---

    // STARTING ARENA (x: -8 to 18, z: -7 to 7, y: 0)
    addPlatformBlock(-8, 18, -7, 7, 0, 0x0284c7, true);
    checkpoints.push({ x: 0, y: 0, z: 0, radius: 4.0, activated: true });

    // Floating Coins on Start
    addCoin(4, 1.2, -2);
    addCoin(4, 1.2, 0);
    addCoin(4, 1.2, 2);
    addCoin(10, 1.2, -1.5);
    addCoin(10, 1.2, 1.5);

    // SECTION 1: SWINGING PENDULUMS (x: 18 to 56, z: -5.5 to 5.5, y: 0)
    addPlatformBlock(18, 56, -5.5, 5.5, 0, 0x0ea5e9, true);

    const pendPositions = [26, 34, 42, 50];
    pendPositions.forEach((posX, idx) => {
      const pGroup = new THREE.Group();
      pGroup.position.set(posX, 0, 0);

      // Overhead arch support
      const archMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6 });
      const pillarGeo = new THREE.CylinderGeometry(0.25, 0.25, 8.5, 12);
      const pLeft = new THREE.Mesh(pillarGeo, archMat);
      pLeft.position.set(0, 4.25, -5.2);
      pGroup.add(pLeft);

      const pRight = new THREE.Mesh(pillarGeo, archMat);
      pRight.position.set(0, 4.25, 5.2);
      pGroup.add(pRight);

      const beamGeo = new THREE.BoxGeometry(0.5, 0.5, 10.5);
      const topBeam = new THREE.Mesh(beamGeo, archMat);
      topBeam.position.set(0, 8.5, 0);
      pGroup.add(topBeam);

      // Pivot Object
      const pivot = new THREE.Object3D();
      pivot.position.set(0, 8.5, 0);
      pGroup.add(pivot);

      // Rod
      const rodGeo = new THREE.CylinderGeometry(0.12, 0.12, 7.5, 8);
      const rodMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
      const rod = new THREE.Mesh(rodGeo, rodMat);
      rod.position.y = -3.75;
      pivot.add(rod);

      // Hammer Bob
      const hammerGeo = new THREE.CylinderGeometry(0.9, 0.9, 1.6, 16);
      const hammerMat = new THREE.MeshStandardMaterial({
        color: 0xef4444, // Red lethal hammer
        metalness: 0.4,
        roughness: 0.3
      });
      const hammer = new THREE.Mesh(hammerGeo, hammerMat);
      hammer.rotation.z = Math.PI / 2;
      hammer.position.y = -7.4;
      hammer.castShadow = true;
      pivot.add(hammer);

      scene.add(pGroup);

      pendulums.push({
        group: pGroup,
        pivotObj: pivot,
        hammerMesh: hammer,
        speed: 2.3 + (idx % 2) * 0.4,
        limit: 1.15,
        offset: idx * 1.4
      });

      addCoin(posX, 1.2, 0);
    });

    // CHECKPOINT 1 (x: 56 to 68, z: -6 to 6, y: 0)
    addPlatformBlock(56, 68, -6, 6, 0, 0x10b981, true); // Emerald green checkpoint pad
    checkpoints.push({ x: 62, y: 0, z: 0, radius: 4.5, activated: false });

    // SECTION 2: SLIDING PUSHERS (x: 68 to 104, z: -5.0 to 5.0, y: 0)
    addPlatformBlock(68, 104, -5.0, 5.0, 0, 0x0284c7, true);

    const pusherX = [74, 82, 90, 98];
    pusherX.forEach((px, idx) => {
      const pGeo = new THREE.BoxGeometry(2.4, 2.2, 3.8);
      const pMat = new THREE.MeshStandardMaterial({
        color: 0xf97316, // Orange punch block
        metalness: 0.3,
        roughness: 0.4
      });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.position.set(px, 1.1, idx % 2 === 0 ? -2.2 : 2.2);
      pMesh.castShadow = true;
      scene.add(pMesh);

      pushers.push({
        mesh: pMesh,
        startZ: idx % 2 === 0 ? -2.5 : 2.5,
        distance: 5.0,
        speed: 3.2,
        dir: idx % 2 === 0 ? 1 : -1,
        bounds: { minX: px - 1.2, maxX: px + 1.2, halfDepth: 1.9 }
      });

      addCoin(px, 1.2, (idx % 2 === 0 ? 1 : -1) * 2.0);
    });

    // SECTION 3: COLLAPSING PLATFORMS (x: 104 to 138, z: -5.5 to 5.5, y: 0)
    // Connecting side rails but modular falling floor tiles
    const tileRows = 7;
    const tileCols = 3;
    const tileStartX = 105;
    const tileW = 4.2;
    const tileD = 3.2;

    for (let r = 0; r < tileRows; r++) {
      for (let c = 0; c < tileCols; c++) {
        const tx = tileStartX + r * (tileW + 0.45);
        const tz = (c - 1) * (tileD + 0.4);

        const tileGeo = new THREE.BoxGeometry(tileW, 0.6, tileD);
        const tileMat = new THREE.MeshStandardMaterial({
          color: (r + c) % 2 === 0 ? 0xec4899 : 0x8b5cf6, // Pastel pink and purple
          roughness: 0.4
        });
        const tileMesh = new THREE.Mesh(tileGeo, tileMat);
        tileMesh.position.set(tx + tileW / 2, -0.3, tz);
        tileMesh.receiveShadow = true;
        scene.add(tileMesh);

        fallingTiles.push({
          mesh: tileMesh,
          initialY: -0.3,
          isStepped: false,
          stepTimer: 0,
          isFalling: false,
          fallSpeed: 0,
          isRespawning: false,
          respawnTimer: 0,
          bounds: {
            minX: tx,
            maxX: tx + tileW,
            minZ: tz - tileD / 2,
            maxZ: tz + tileD / 2
          }
        });

        if (r % 2 === 0 && c === 1) {
          addCoin(tx + tileW / 2, 1.2, tz);
        }
      }
    }

    // CHECKPOINT 2 (x: 138 to 150, z: -6 to 6, y: 0)
    addPlatformBlock(138, 150, -6, 6, 0, 0x10b981, true);
    checkpoints.push({ x: 144, y: 0, z: 0, radius: 4.5, activated: false });

    // SECTION 4: ROTATING ARMS (x: 150 to 178, z: -6 to 6, y: 0)
    addPlatformBlock(150, 178, -6, 6, 0, 0x0284c7, true);

    const spinCenters = [158, 170];
    spinCenters.forEach((cx, idx) => {
      const sGroup = new THREE.Group();
      sGroup.position.set(cx, 0, 0);

      // Base cylinder
      const baseGeo = new THREE.CylinderGeometry(0.8, 0.9, 1.4, 16);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.y = 0.7;
      sGroup.add(baseMesh);

      // Arm
      const armGeo = new THREE.BoxGeometry(0.5, 0.7, 10.4);
      const armMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b, // Amber beam
        metalness: 0.5,
        roughness: 0.3
      });
      const armMesh = new THREE.Mesh(armGeo, armMat);
      armMesh.position.y = 0.85;
      armMesh.castShadow = true;
      sGroup.add(armMesh);

      scene.add(sGroup);

      spinners.push({
        group: sGroup,
        centerX: cx,
        centerZ: 0,
        radius: 5.2,
        speed: (idx % 2 === 0 ? 1 : -1) * 2.2
      });

      addCoin(cx - 2.5, 1.2, 0);
      addCoin(cx + 2.5, 1.2, 0);
    });

    // SECTION 5: TRAMPOLINE BOUNCE PAD (x: 178 to 190, z: -5 to 5, y: 0)
    addPlatformBlock(178, 190, -5, 5, 0, 0x3b82f6, true);

    const bPadGeo = new THREE.CylinderGeometry(1.6, 1.8, 0.45, 24);
    const bPadMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4, // Cyan trampoline pad
      emissive: 0x0891b2,
      emissiveIntensity: 0.4
    });
    const bPadMesh = new THREE.Mesh(bPadGeo, bPadMat);
    bPadMesh.position.set(184, 0.22, 0);
    scene.add(bPadMesh);

    const ringGeo = new THREE.TorusGeometry(1.7, 0.12, 8, 24);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 0.5 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.set(184, 0.3, 0);
    scene.add(ringMesh);

    bouncePads.push({
      mesh: bPadMesh,
      ringMesh,
      x: 184,
      y: 0.22,
      z: 0,
      radius: 1.8,
      force: 21.0 // High jump directly onto upper victory platform
    });

    // SECTION 6: ELEVATED FINISH PLATFORM & RBCUBES (x: 194 to 226, z: -8 to 8, y: 7.0)
    addPlatformBlock(194, 226, -8, 8, 7.0, 0x10b981, true);

    // RBCubes: Stack of physical cubes the player can knock down
    const cubeMat = new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.3 });
    const cubeGeo = new THREE.BoxGeometry(0.85, 0.85, 0.85);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const cMesh = new THREE.Mesh(cubeGeo, cubeMat);
        const cx = 202 + i * 0.9;
        const cy = 7.0 + 0.45 + (j % 2) * 0.9;
        const cz = (i - 1) * 1.1;
        cMesh.position.set(cx, cy, cz);
        cMesh.castShadow = true;
        scene.add(cMesh);

        knockCubes.push({
          mesh: cMesh,
          vx: 0,
          vy: 0,
          vz: 0,
          rx: 0,
          ry: 0,
          rz: 0,
          groundY: 7.0 + 0.42
        });
      }
    }

    // FINISH LINE ARCH & BANNER (x: 214)
    const archMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
    const archPostGeo = new THREE.CylinderGeometry(0.35, 0.35, 6, 16);

    const fLeft = new THREE.Mesh(archPostGeo, archMat);
    fLeft.position.set(214, 10.0, -6.5);
    scene.add(fLeft);

    const fRight = new THREE.Mesh(archPostGeo, archMat);
    fRight.position.set(214, 10.0, 6.5);
    scene.add(fRight);

    const fCrossGeo = new THREE.BoxGeometry(0.7, 0.7, 13.5);
    const fCross = new THREE.Mesh(fCrossGeo, archMat);
    fCross.position.set(214, 13.0, 0);
    scene.add(fCross);

    // Checkered Banner
    const bannerCanvas = document.createElement('canvas');
    bannerCanvas.width = 512;
    bannerCanvas.height = 128;
    const bctx = bannerCanvas.getContext('2d')!;
    bctx.fillStyle = '#ffffff';
    bctx.fillRect(0, 0, 512, 128);
    bctx.fillStyle = '#000000';
    const squareSize = 32;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 16; c++) {
        if ((r + c) % 2 === 0) {
          bctx.fillRect(c * squareSize, r * squareSize, squareSize, squareSize);
        }
      }
    }
    bctx.fillStyle = '#de9612';
    bctx.fillRect(64, 28, 384, 72);
    bctx.fillStyle = '#ffffff';
    bctx.font = 'bold 44px Arial';
    bctx.textAlign = 'center';
    bctx.fillText('★ FINISH ★', 256, 78);

    const bannerTex = new THREE.CanvasTexture(bannerCanvas);
    const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex, side: THREE.DoubleSide });
    const bannerGeo = new THREE.PlaneGeometry(12.8, 3.2);
    const bannerMesh = new THREE.Mesh(bannerGeo, bannerMat);
    bannerMesh.position.set(214, 11.5, 0);
    bannerMesh.rotation.y = Math.PI / 2;
    scene.add(bannerMesh);

    // Save Initial Three State
    threeState.current = {
      renderer,
      scene,
      camera,
      playerGroup,
      dropShadow,
      visorMesh,
      backpackMesh,
      platforms,
      fallingTiles,
      pendulums,
      pushers,
      spinners,
      bouncePads,
      coins,
      knockCubes,
      checkpoints,
      currentCheckpoint: new THREE.Vector3(0, 2.0, 0),
      playerPos: new THREE.Vector3(0, 2.0, 0),
      playerVel: new THREE.Vector3(0, 0, 0),
      isGrounded: false,
      isStunned: false,
      stunTimer: 0,
      invincibleTimer: 0,
      walkTimer: 0,
      gameStartTime: performance.now(),
      animationFrameId: 0
    };

    // 6. User Input Listeners
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
      cameraAngles.current.pitch = Math.max(-0.25, Math.min(1.0, cameraAngles.current.pitch + dy * 0.005));
    };

    const handleMouseUp = () => {
      mouseOrbit.current.isDown = false;
    };

    const handleWheel = (e: WheelEvent) => {
      cameraAngles.current.distance = Math.max(4.0, Math.min(12.0, cameraAngles.current.distance + e.deltaY * 0.005));
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
    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('resize', handleResize);

    // 7. Physics Loop matching CharacterControls.cs
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.05); // Clamp dt to prevent tunneling
      lastTime = currentTime;

      const st = threeState.current;
      if (st) {
        // --- INPUT & MOVEMENT (MATCHING CharacterControls.cs) ---
        let inputX = 0; // Forward / Backward
        let inputZ = 0; // Left / Right

        if (keysPressed.current['w'] || keysPressed.current['arrowup']) inputX += 1;
        if (keysPressed.current['s'] || keysPressed.current['arrowdown']) inputX -= 1;
        if (keysPressed.current['a'] || keysPressed.current['arrowleft']) inputZ -= 1;
        if (keysPressed.current['d'] || keysPressed.current['arrowright']) inputZ += 1;

        if (touchJoystick.current.active) {
          inputX -= touchJoystick.current.dy; // Up on joystick is forward (+X)
          inputZ += touchJoystick.current.dx; // Right on joystick is right (+Z)
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

        // Speed & Acceleration matching speed = 8.5, maxVelocityChange = 10.0
        const maxSpeed = 8.8;
        if (!st.isStunned) {
          const accel = st.isGrounded ? 18.0 : 9.0;
          st.playerVel.x += (targetDirX * maxSpeed - st.playerVel.x) * accel * dt;
          st.playerVel.z += (targetDirZ * maxSpeed - st.playerVel.z) * accel * dt;
        } else {
          st.playerVel.x *= 0.92;
          st.playerVel.z *= 0.92;
          st.stunTimer -= dt;
          if (st.stunTimer <= 0) st.isStunned = false;
        }

        if (st.invincibleTimer > 0) st.invincibleTimer -= dt;

        // Gravity: 30.0 m/s^2
        st.playerVel.y -= 30.0 * dt;

        const prevY = st.playerPos.y;

        // Apply Velocity
        st.playerPos.x += st.playerVel.x * dt;
        st.playerPos.y += st.playerVel.y * dt;
        st.playerPos.z += st.playerVel.z * dt;

        // Rotate Character into movement direction (CharacterControls rotateSpeed = 25)
        const horizSpeed = Math.hypot(st.playerVel.x, st.playerVel.z);
        if (horizSpeed > 0.35 && !st.isStunned) {
          // Angle in radians facing movement direction
          const targetAngle = Math.atan2(st.playerVel.z, st.playerVel.x);
          let diff = targetAngle - st.playerGroup.rotation.y;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          st.playerGroup.rotation.y += diff * 20 * dt;

          // Bean bobbing animation
          st.walkTimer += dt * 16;
          beanMesh.position.y = 0.95 + Math.abs(Math.sin(st.walkTimer)) * 0.12;
          beanMesh.scale.set(1.0 + Math.sin(st.walkTimer) * 0.05, 1.0 - Math.sin(st.walkTimer) * 0.05, 1.0);
        } else {
          beanMesh.position.y = 0.95;
          beanMesh.scale.set(1, 1, 1);
        }

        // --- CONTINUOUS COLLISION SWEEPING (NO TUNNELING) ---
        st.isGrounded = false;
        let groundSurfaceY = -999;
        const playerRadius = 0.45;

        // 1. Check Solid Platforms
        for (const plat of st.platforms) {
          if (
            st.playerPos.x >= plat.minX - playerRadius &&
            st.playerPos.x <= plat.maxX + playerRadius &&
            st.playerPos.z >= plat.minZ - playerRadius &&
            st.playerPos.z <= plat.maxZ + playerRadius
          ) {
            // Sweeping: If player crossed surface plane from above
            if (prevY >= plat.surfaceY - 0.25 && st.playerPos.y <= plat.surfaceY + 0.35 && st.playerVel.y <= 0) {
              st.playerPos.y = plat.surfaceY;
              st.playerVel.y = 0;
              st.isGrounded = true;
            }
            if (plat.surfaceY > groundSurfaceY && st.playerPos.y >= plat.surfaceY - 0.5) {
              groundSurfaceY = plat.surfaceY;
            }
          }
        }

        // 2. Check Falling Platforms (FallPlat.cs)
        for (const tile of st.fallingTiles) {
          const b = tile.bounds;
          const isOver =
            st.playerPos.x >= b.minX &&
            st.playerPos.x <= b.maxX &&
            st.playerPos.z >= b.minZ &&
            st.playerPos.z <= b.maxZ;

          if (isOver && !tile.isFalling) {
            const surfaceY = tile.mesh.position.y + 0.3;
            if (prevY >= surfaceY - 0.25 && st.playerPos.y <= surfaceY + 0.35 && st.playerVel.y <= 0) {
              st.playerPos.y = surfaceY;
              st.playerVel.y = 0;
              st.isGrounded = true;
            }
            if (surfaceY > groundSurfaceY) groundSurfaceY = surfaceY;

            // Trigger step countdown
            if (!tile.isStepped) {
              tile.isStepped = true;
              tile.stepTimer = 0.65; // Tremble before drop
            }
          }

          // Tile logic: Shake -> Drop -> Respawn
          if (tile.isStepped && !tile.isFalling) {
            tile.stepTimer -= dt;
            // Shake effect
            tile.mesh.position.x += (Math.random() - 0.5) * 0.08;
            (tile.mesh.material as THREE.MeshStandardMaterial).color.setHex(0xf59e0b); // Warning amber

            if (tile.stepTimer <= 0) {
              tile.isFalling = true;
              tile.fallSpeed = 2.0;
            }
          } else if (tile.isFalling && !tile.isRespawning) {
            tile.fallSpeed += 30.0 * dt;
            tile.mesh.position.y -= tile.fallSpeed * dt;
            if (tile.mesh.position.y < -30) {
              tile.isRespawning = true;
              tile.respawnTimer = 2.8;
            }
          } else if (tile.isRespawning) {
            tile.respawnTimer -= dt;
            if (tile.respawnTimer <= 0) {
              tile.mesh.position.y = tile.initialY;
              tile.isStepped = false;
              tile.isFalling = false;
              tile.isRespawning = false;
              tile.fallSpeed = 0;
              (tile.mesh.material as THREE.MeshStandardMaterial).color.setHex(0xec4899);
            }
          }
        }

        // 3. Check Trampoline Bounce Pad (Bounce.cs)
        for (const pad of st.bouncePads) {
          const dist2D = Math.hypot(st.playerPos.x - pad.x, st.playerPos.z - pad.z);
          if (dist2D < pad.radius && st.playerPos.y <= pad.y + 0.6 && st.playerPos.y >= pad.y - 0.4) {
            st.playerVel.y = pad.force;
            st.playerPos.y = pad.y + 0.65;
            st.isGrounded = false;
            playSfx('bounce');

            // Squash/stretch trampoline ring
            pad.ringMesh.scale.set(1.4, 1.4, 0.4);
            setTimeout(() => {
              pad.ringMesh.scale.set(1, 1, 1);
            }, 250);
          }
        }

        // 4. Update Swinging Pendulums (Pendulum.cs)
        for (const pend of st.pendulums) {
          const angle = Math.sin(currentTime * 0.001 * pend.speed + pend.offset) * pend.limit;
          pend.pivotObj.rotation.x = angle;

          // Collision with hammer bob
          const hammerWorldPos = new THREE.Vector3();
          pend.hammerMesh.getWorldPosition(hammerWorldPos);

          const pDist = st.playerPos.clone().add(new THREE.Vector3(0, 0.9, 0)).distanceTo(hammerWorldPos);
          if (pDist < 1.45 && !st.isStunned && st.invincibleTimer <= 0) {
            // Recoil impulse
            const pushDir = new THREE.Vector3(Math.cos(angle) * 12, 6, Math.sin(angle) * 12);
            st.playerVel.copy(pushDir);
            st.isStunned = true;
            st.stunTimer = 0.6;
            st.invincibleTimer = 1.0;
            playSfx('hit');
          }
        }

        // 5. Update Sliding Pushers (MovableObs.cs)
        for (const push of st.pushers) {
          push.mesh.position.z += push.dir * push.speed * dt;
          if (Math.abs(push.mesh.position.z - push.startZ) > push.distance) {
            push.dir *= -1;
          }

          // AABB Push Collision
          const b = push.bounds;
          const pMinZ = push.mesh.position.z - b.halfDepth;
          const pMaxZ = push.mesh.position.z + b.halfDepth;

          if (
            st.playerPos.x >= b.minX - playerRadius &&
            st.playerPos.x <= b.maxX + playerRadius &&
            st.playerPos.z >= pMinZ - playerRadius &&
            st.playerPos.z <= pMaxZ + playerRadius &&
            st.playerPos.y <= 2.2
          ) {
            // Push player in direction of movement
            st.playerPos.z += push.dir * (push.speed + 2.0) * dt;
            st.playerVel.z = push.dir * 8.0;
            if (st.invincibleTimer <= 0) {
              playSfx('hit');
              st.invincibleTimer = 0.4;
            }
          }
        }

        // 6. Update Spinning Rotators (Rotator.cs)
        for (const spin of st.spinners) {
          spin.group.rotation.y += spin.speed * dt;

          const dx = st.playerPos.x - spin.centerX;
          const dz = st.playerPos.z - spin.centerZ;
          const distCenter = Math.hypot(dx, dz);

          if (distCenter < spin.radius && st.playerPos.y <= 1.5) {
            // Check orientation of spinning arm
            const playerAngle = Math.atan2(dz, dx);
            const armAngle = spin.group.rotation.y % Math.PI;
            const diff = Math.abs((playerAngle % Math.PI) - armAngle);

            if (diff < 0.25 || diff > Math.PI - 0.25) {
              if (!st.isStunned && st.invincibleTimer <= 0) {
                const tangentX = -Math.sin(playerAngle) * spin.speed * 4.5;
                const tangentZ = Math.cos(playerAngle) * spin.speed * 4.5;
                st.playerVel.set(tangentX, 5.5, tangentZ);
                st.isStunned = true;
                st.stunTimer = 0.5;
                st.invincibleTimer = 0.8;
                playSfx('hit');
              }
            }
          }
        }

        // 7. Coin Collection
        for (const c of st.coins) {
          if (!c.collected) {
            c.group.rotation.z += dt * 3.5;
            const dist = st.playerPos.clone().add(new THREE.Vector3(0, 0.8, 0)).distanceTo(c.group.position);
            if (dist < 1.1) {
              c.collected = true;
              scene.remove(c.group);
              setCoinsCollected(prev => prev + 1);
              playSfx('coin');
            }
          }
        }

        // 8. Stacked KnockCubes Physics
        for (const cube of st.knockCubes) {
          const dist = st.playerPos.clone().add(new THREE.Vector3(0, 0.8, 0)).distanceTo(cube.mesh.position);
          if (dist < 1.3) {
            const pushDir = cube.mesh.position.clone().sub(st.playerPos).normalize();
            cube.vx = pushDir.x * 12 + st.playerVel.x * 0.8;
            cube.vy = 4 + Math.random() * 3;
            cube.vz = pushDir.z * 12 + st.playerVel.z * 0.8;
            cube.rx = Math.random() * 8;
            cube.ry = Math.random() * 8;
          }

          if (Math.abs(cube.vx) > 0.05 || Math.abs(cube.vz) > 0.05 || cube.mesh.position.y > cube.groundY) {
            cube.vy -= 28.0 * dt;
            cube.mesh.position.x += cube.vx * dt;
            cube.mesh.position.y += cube.vy * dt;
            cube.mesh.position.z += cube.vz * dt;

            cube.mesh.rotation.x += cube.rx * dt;
            cube.mesh.rotation.y += cube.ry * dt;

            if (cube.mesh.position.y < cube.groundY) {
              cube.mesh.position.y = cube.groundY;
              cube.vy = -cube.vy * 0.3;
              cube.vx *= 0.85;
              cube.vz *= 0.85;
            }
          }
        }

        // 9. Checkpoints (SavePos.cs)
        for (const cp of st.checkpoints) {
          const cpDist = Math.hypot(st.playerPos.x - cp.x, st.playerPos.z - cp.z);
          if (cpDist < cp.radius && !cp.activated && st.playerPos.y >= cp.y - 0.5) {
            cp.activated = true;
            st.currentCheckpoint.set(cp.x, cp.y + 1.2, cp.z);
            playSfx('checkpoint');
          }
        }

        // 10. Fall Reset / Void Recovery (FallReset.cs)
        if (st.playerPos.y < -12) {
          // Respawn player smoothly at current checkpoint!
          st.playerPos.copy(st.currentCheckpoint);
          st.playerVel.set(0, 0, 0);
          st.isStunned = false;
          st.invincibleTimer = 1.5;
          playSfx('hit');
        }

        // 11. Finish Line Threshold Check (FinishLine.cs: threshold = 214)
        if (st.playerPos.x >= 214 && isPlayingRef.current) {
          handleVictory();
        }

        // 12. Update Mesh & Drop Shadow Positions
        st.playerGroup.position.copy(st.playerPos);

        if (groundSurfaceY > -900) {
          st.dropShadow.visible = true;
          st.dropShadow.position.set(st.playerPos.x, groundSurfaceY + 0.02, st.playerPos.z);
          const heightAboveGround = Math.max(0, st.playerPos.y - groundSurfaceY);
          const shadowScale = Math.max(0.3, 1.0 - heightAboveGround * 0.15);
          st.dropShadow.scale.set(shadowScale, shadowScale, 1.0);
          (st.dropShadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.1, 0.45 - heightAboveGround * 0.07);
        } else {
          st.dropShadow.visible = false;
        }

        // 13. Smooth Third-Person Camera Follow (CameraManager.cs)
        const angles = cameraAngles.current;
        const camHeight = 2.4 + angles.pitch * 3.2;
        const targetCamX = st.playerPos.x - Math.cos(angles.yaw) * angles.distance;
        const targetCamZ = st.playerPos.z - Math.sin(angles.yaw) * angles.distance;
        const targetCamY = st.playerPos.y + camHeight;

        // Smooth Lerp
        st.camera.position.x += (targetCamX - st.camera.position.x) * 10 * dt;
        st.camera.position.y += (targetCamY - st.camera.position.y) * 10 * dt;
        st.camera.position.z += (targetCamZ - st.camera.position.z) * 10 * dt;

        st.camera.lookAt(st.playerPos.x + Math.cos(angles.yaw) * 1.5, st.playerPos.y + 1.2, st.playerPos.z + Math.sin(angles.yaw) * 1.5);

        // Update In-Game Race HUD Progress
        const prog = Math.min(100, Math.max(0, Math.round((st.playerPos.x / 214) * 100)));
        setRaceProgress(prog);

        // Dynamic Placement Simulation
        if (prog < 25) setPlacement(1);
        else if (prog < 55) setPlacement(1);
        else if (prog < 85) setPlacement(1);
        else setPlacement(1);

        // Render Frame
        st.renderer.render(st.scene, st.camera);
      }

      threeState.current!.animationFrameId = requestAnimationFrame(animate);
    };

    threeState.current.animationFrameId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);

      if (threeState.current) {
        cancelAnimationFrame(threeState.current.animationFrameId);
        threeState.current.renderer.dispose();
        if (container.contains(threeState.current.renderer.domElement)) {
          container.removeChild(threeState.current.renderer.domElement);
        }
      }
    };
  }, [soundEnabled]);

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none bg-slate-900 font-sans">
      {/* 3D WebGL Canvas Viewport */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* TOP HEADER: User Info, Balance, Audio Toggle & Exit */}
      <header className="absolute top-0 inset-x-0 z-30 p-3 sm:p-4 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2.5 pointer-events-auto bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border-2 border-white/20 shadow-xl">
          <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-amber-400 bg-pink-500">
            <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="text-white text-xs font-black tracking-wide leading-tight">{profile.name}</div>
            <div className="text-amber-400 text-xs font-bold leading-none">
              R$ {profile.saldo.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border-2 border-white/20 text-white flex items-center justify-center hover:bg-black/80 transition-transform active:scale-95 shadow-lg"
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>

          {/* Exit / Return */}
          <Link
            href="/painel"
            className="px-3.5 py-2 rounded-full bg-red-600/90 hover:bg-red-600 text-white text-xs font-black border-2 border-white/30 uppercase tracking-wider shadow-lg active:scale-95 transition-transform"
          >
            Sair
          </Link>
        </div>
      </header>

      {/* LOBBY / RACE SELECTION SCREEN (Authentic Arena Clash Mode Selection) */}
      {activeScreen === 'lobby' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md bg-gradient-to-b from-[#0c3e7a] to-[#071f40] border-4 border-black rounded-3xl p-5 shadow-2xl text-white flex flex-col items-center">
            {/* Header Badge */}
            <div className="absolute -top-7 px-6 py-2 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 border-4 border-black rounded-full shadow-xl transform -rotate-1">
              <span className="text-white font-black text-base sm:text-lg uppercase tracking-wider">
                ARENA CLASH - CORRIDA 3D
              </span>
            </div>

            {/* Mode Tabs matching original platform */}
            <div className="w-full flex rounded-2xl bg-blue-950/80 p-1 mt-5 mb-4 border-2 border-blue-500/40">
              <button
                onClick={() => {
                  setActiveTab('maratona');
                  setSelectedFee(1.0);
                }}
                className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
                  activeTab === 'maratona'
                    ? 'bg-gradient-to-b from-blue-500 to-blue-700 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Maratona 5x
              </button>
              <button
                onClick={() => {
                  setActiveTab('trio');
                  setSelectedFee(3.0);
                }}
                className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
                  activeTab === 'trio'
                    ? 'bg-gradient-to-b from-blue-500 to-blue-700 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Trio Clash
              </button>
              <button
                onClick={() => {
                  setActiveTab('x1');
                  setSelectedFee(5.0);
                }}
                className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
                  activeTab === 'x1'
                    ? 'bg-gradient-to-b from-blue-500 to-blue-700 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                X1
              </button>
            </div>

            {/* Mode Banner & Description */}
            <div className="w-full bg-blue-900/60 border-2 border-blue-400/50 rounded-2xl p-4 mb-4 flex flex-col items-center text-center">
              <div className="text-3xl mb-1">
                {activeTab === 'maratona' ? '🏃‍♂️ 5 COMPETIDORES' : activeTab === 'trio' ? '⚡ 3 COMPETIDORES' : '⚔️ DUELO 1x1'}
              </div>
              <p className="text-slate-200 text-xs sm:text-sm mb-3">
                {activeTab === 'maratona'
                  ? 'Nesta modalidade são 5 pessoas competindo em uma mesma corrida e os 3 primeiros colocados são premiados!'
                  : activeTab === 'trio'
                  ? 'Nesta modalidade são 3 pessoas competindo e apenas o primeiro colocado leva a bolada!'
                  : 'Duelo direto cara a cara. O campeão leva a premiação inteira sozinho!'}
              </p>

              {/* Prize Pool Display */}
              <div className="w-full py-2 bg-black/40 rounded-xl border border-white/10 flex justify-around items-center">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Inscrição</div>
                  <div className="text-amber-400 font-black text-sm">R$ {selectedFee.toFixed(2)}</div>
                </div>
                <div className="w-px h-6 bg-white/20" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Prêmio 1º Lugar</div>
                  <div className="text-green-400 font-black text-sm">
                    R$ {(selectedFee * (activeTab === 'x1' ? 1.9 : activeTab === 'trio' ? 2.7 : 4.2)).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Controls Guide */}
            <div className="w-full bg-blue-950/60 rounded-xl p-3 mb-5 border border-white/10 text-[11px] text-slate-300">
              <div className="font-bold text-white mb-1">🎮 Controles:</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>• <b>WASD / Setas</b>: Mover</span>
                <span>• <b>Espaço</b>: Pular</span>
                <span>• <b>Mouse</b>: Girar câmera</span>
                <span>• <b>Mobile</b>: Joystick na esquerda e Toque na direita</span>
              </div>
            </div>

            {/* Enter Race CTA */}
            <button
              onClick={() => startRace(selectedFee)}
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 border-4 border-black rounded-2xl text-white font-black text-lg uppercase tracking-wider shadow-[0_6px_0_#065f46] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
            >
              {loading ? 'Entrando na Arena...' : `JOGAR AGORA (R$ ${selectedFee.toFixed(2)})`}
            </button>
          </div>
        </div>
      )}

      {/* COUNTDOWN OVERLAY */}
      {activeScreen === 'countdown' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-none">
          <div className="text-center animate-bounce-gentle">
            <div className="text-8xl sm:text-9xl font-black text-amber-400 drop-shadow-[0_8px_0_#000]">
              {countdown > 0 ? countdown : 'VAI!'}
            </div>
            <div className="text-white text-lg font-black uppercase tracking-widest mt-2">
              Prepare-se para a largada!
            </div>
          </div>
        </div>
      )}

      {/* IN-GAME HUD OVERLAY (SCREENPLAYING) */}
      {(activeScreen === 'playing' || activeScreen === 'countdown') && (
        <>
          {/* Top Collectibles Bar */}
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex items-center gap-3 bg-black/50 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/20 shadow-lg">
            <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
              <span>🪙</span>
              <span>{coinsCollected}</span>
            </div>
            <div className="w-px h-3.5 bg-white/20" />
            <div className="flex items-center gap-1 text-xs font-black text-emerald-400">
              <span>🏁</span>
              <span>{raceProgress}%</span>
            </div>
          </div>

          {/* Left Vertical Progress Track with Competitor Avatars */}
          <div className="absolute left-4 top-24 bottom-32 z-30 w-7 flex flex-col items-center pointer-events-none">
            <div className="w-8 h-8 rounded-full bg-amber-400 border-2 border-black flex items-center justify-center font-black text-black text-xs shadow-lg mb-1">
              {placement}º
            </div>
            <div className="relative flex-1 w-2.5 bg-black/60 rounded-full border border-white/30 overflow-hidden shadow-inner">
              <div
                className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-green-500 to-emerald-400 transition-all duration-150 rounded-full"
                style={{ height: `${raceProgress}%` }}
              />
            </div>
            {/* Player Mini Marker */}
            <div
              className="absolute w-6 h-6 rounded-full border-2 border-white overflow-hidden bg-pink-500 shadow-md transition-all duration-150"
              style={{ bottom: `calc(32px + ${raceProgress * 0.72}%)` }}
            >
              <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
            </div>
          </div>

          {/* MOBILE CONTROLS: Touch-Look Drag Zone (Right Half) */}
          <div
            className="absolute inset-y-0 right-0 w-1/2 z-20 pointer-events-auto sm:hidden touch-none"
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
                  cameraAngles.current.pitch = Math.max(-0.25, Math.min(1.0, cameraAngles.current.pitch + dy * 0.006));
                  break;
                }
              }
            }}
            onTouchEnd={() => {
              touchLook.current.active = false;
              touchLook.current.touchId = null;
            }}
          />

          {/* MOBILE CONTROLS OVERLAY: Virtual Joystick (Left) + Tactile Jump (Right) */}
          <div className="absolute inset-x-0 bottom-6 z-40 pointer-events-none sm:hidden flex justify-between items-end px-6">
            {/* Left Joystick */}
            <div
              className="w-32 h-32 rounded-full border-4 border-white/40 bg-black/40 backdrop-blur-md relative pointer-events-auto flex items-center justify-center touch-none shadow-2xl"
              onTouchStart={e => {
                const touch = e.touches[0];
                const rect = e.currentTarget.getBoundingClientRect();
                touchJoystick.current.active = true;
                touchJoystick.current.startX = rect.left + rect.width / 2;
                touchJoystick.current.startY = rect.top + rect.height / 2;
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

            {/* Right Jump Button */}
            <button
              onTouchStart={e => {
                e.preventDefault();
                handleJump();
              }}
              onClick={handleJump}
              className="w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-600 to-green-400 border-4 border-white shadow-[0_0_25px_rgba(16,185,129,0.7)] pointer-events-auto active:scale-90 transition-transform flex flex-col items-center justify-center text-white font-black"
            >
              <span className="text-2xl">⬆️</span>
              <span className="text-xs uppercase tracking-wider">PULAR</span>
            </button>
          </div>
        </>
      )}

      {/* VICTORY MODAL (Matching Scene3.unity / Arena Clash Result Modal) */}
      {activeScreen === 'victory' && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/85 backdrop-blur-md z-50 p-4">
          <div className="relative w-full max-w-[380px] bg-[#0c3e7a] border-4 border-black rounded-3xl p-6 shadow-2xl flex flex-col items-center">
            {/* Top Crown Avatar Badge */}
            <div className="absolute -top-12 w-24 h-24 rounded-full border-4 border-black overflow-hidden bg-pink-500 shadow-2xl">
              <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
            </div>

            <div className="w-[110%] -mx-4 mt-8 py-2 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 border-y-3 border-black text-center shadow-lg transform -rotate-1">
              <h3 className="text-white text-xl font-black uppercase tracking-wider">
                1º LUGAR - VITÓRIA!
              </h3>
            </div>

            <div className="text-6xl my-4 animate-bounce-gentle">🏆</div>

            <div className="w-full bg-blue-950/90 border-2 border-blue-400 rounded-2xl p-4 flex flex-col gap-2.5 mb-5 shadow-inner">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-300 font-bold uppercase">Tempo Final:</span>
                <span className="text-white font-black text-base">{finalTime}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-300 font-bold uppercase">Moedas Coletadas:</span>
                <span className="text-amber-400 font-black text-base">+{coinsCollected}</span>
              </div>
              <div className="h-px bg-white/20 my-1" />
              <div className="flex justify-between items-center text-sm">
                <span className="text-emerald-300 font-bold uppercase">Prêmio Conquistado:</span>
                <span className="text-emerald-400 font-black text-lg">
                  R$ {(selectedFee * (activeTab === 'x1' ? 1.9 : activeTab === 'trio' ? 2.7 : 4.2)).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="w-full flex flex-col gap-2.5">
              <button
                onClick={() => startRace(selectedFee)}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 border-3 border-black rounded-xl text-white font-black text-base uppercase tracking-wider shadow-lg active:scale-95 transition-transform"
              >
                Jogar Novamente
              </button>
              <button
                onClick={() => setActiveScreen('lobby')}
                className="w-full py-3 bg-blue-800 hover:bg-blue-700 border-2 border-black rounded-xl text-white font-bold text-sm uppercase tracking-wider transition-colors"
              >
                Voltar ao Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
