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
  ouro: number;
  rubi: number;
  diamante: number;
  avatar: string;
  victories: number;
}

export default function GamePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<PlayerProfile>({
    name: 'Diego Seguro',
    phone: '11982854183',
    saldo: 500.0,
    bonus: 0.0,
    ouro: 120,
    rubi: 45,
    diamante: 12,
    avatar: '/images/character_1_25.webp',
    victories: 8
  });

  // Game UI State
  const [activeScreen, setActiveScreen] = useState<'lobby' | 'modes' | 'customization' | 'friends' | 'playing' | 'victory'>('lobby');
  const [selectedMode, setSelectedMode] = useState<'maratona' | 'trio' | 'x1'>('maratona');
  const [selectedFee, setSelectedFee] = useState<number>(5.0);
  const [selectedColor, setSelectedColor] = useState<string>('#ffffff');
  const [selectedCharId, setSelectedCharId] = useState<number>(1);
  const [customTab, setCustomTab] = useState<'colors' | 'accessories' | 'faces' | 'icons'>('colors');
  const [roomCode, setRoomCode] = useState<string>('');
  const [inputCode, setInputCode] = useState<string>('');
  const [activeRaceId, setActiveRaceId] = useState<string>('');

  // In-Game State
  const [currentRank, setCurrentRank] = useState<number>(1);
  const [gemsCollected, setGemsCollected] = useState({ ouro: 0, rubi: 0, diamante: 0 });
  const [raceProgress, setRaceProgress] = useState<number>(0); // 0 to 100
  const [countdown, setCountdown] = useState<number | null>(null);
  const [winnings, setWinnings] = useState<number>(0);
  const [activePowerup, setActivePowerup] = useState<'rocket' | 'wings' | null>(null);

  // WebGL Container Ref
  const mountRef = useRef<HTMLDivElement | null>(null);
  const threeState = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    playerMesh: THREE.Group;
    rivalMeshes: THREE.Group[];
    obstacles: THREE.Group[];
    collectibles: THREE.Group[];
    animId: number;
    clock: THREE.Clock;
    playerLane: number; // -1: Left, 0: Center, 1: Right
    targetX: number;
    playerY: number;
    playerZ: number;
    isJumping: boolean;
    jumpVelocity: number;
    speed: number;
    raceDistance: number;
    isGameActive: boolean;
    rivals: {
      name: string;
      mesh: THREE.Group;
      lane: number;
      z: number;
      speed: number;
      targetX: number;
    }[];
  } | null>(null);

  // Sound Synthesizer
  const playSfx = (type: 'beep' | 'go' | 'coin' | 'gem' | 'hit' | 'boost' | 'win') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;

      if (type === 'beep') {
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'go') {
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === 'coin') {
        osc.frequency.setValueAtTime(987.77, now);
        osc.frequency.setValueAtTime(1318.51, now + 0.08);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'gem') {
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.setValueAtTime(1600, now + 0.06);
        osc.frequency.setValueAtTime(2000, now + 0.12);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'boost') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.5);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      } else if (type === 'hit') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'win') {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          o.frequency.setValueAtTime(freq, now + idx * 0.12);
          g.gain.setValueAtTime(0.25, now + idx * 0.12);
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
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.user) {
          setProfile(prev => ({
            ...prev,
            name: data.user.name || 'Diego Seguro',
            phone: data.user.phone || '11982854183',
            saldo: Number(data.user.saldo ?? 500),
            bonus: Number(data.user.bonus ?? 0)
          }));
        }
      })
      .catch(() => {});
  }, []);

  // START 3D THREE.JS GAME RUNNER
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
      .then(res => res.ok ? res.json() : null)
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
    setGemsCollected({ ouro: 0, rubi: 0, diamante: 0 });
    setRaceProgress(0);
    setCurrentRank(1);
    setActivePowerup(null);

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
          }
          return null;
        }
        return null;
      });
    }, 1000);
  };

  // Initialize Three.js Scene when entering 'playing' screen
  useEffect(() => {
    if (activeScreen !== 'playing' || !mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e27);
    scene.fog = new THREE.FogExp2(0x0a0e27, 0.015);

    const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 1000);
    camera.position.set(0, 4.2, 7.5);
    camera.lookAt(0, 1.8, -10);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);

    // Ambient & Directional Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff3cc, 1.8);
    dirLight.position.set(10, 20, 15);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Glowing Point Lights for Cavern Atmosphere
    const lavaLight = new THREE.PointLight(0xff5500, 2.5, 30);
    lavaLight.position.set(0, -2, -30);
    scene.add(lavaLight);

    // 1. Build Cavern Tunnel
    const tunnelGroup = new THREE.Group();
    const trackWidth = 7.5;
    const tunnelLength = 600;

    // Track Floor
    const floorGeo = new THREE.PlaneGeometry(trackWidth, tunnelLength, 1, 100);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x181c2b,
      roughness: 0.8,
      metalness: 0.2
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(0, 0, -tunnelLength / 2 + 10);
    floorMesh.receiveShadow = true;
    tunnelGroup.add(floorMesh);

    // Lane Dividers (Dashed Neon Yellow Lines)
    [-1.25, 1.25].forEach(xPos => {
      const lineGeo = new THREE.PlaneGeometry(0.12, tunnelLength);
      const lineMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.4 });
      const lineMesh = new THREE.Mesh(lineGeo, lineMat);
      lineMesh.rotation.x = -Math.PI / 2;
      lineMesh.position.set(xPos, 0.02, -tunnelLength / 2 + 10);
      tunnelGroup.add(lineMesh);
    });

    // Outer Cavern Tunnel Rock Walls (Curved Cylinder)
    const cavernGeo = new THREE.CylinderGeometry(8, 8, tunnelLength, 24, 1, true, -Math.PI / 2, Math.PI);
    const cavernMat = new THREE.MeshStandardMaterial({
      color: 0x221a14,
      roughness: 0.95,
      metalness: 0.1,
      side: THREE.BackSide
    });
    const cavernMesh = new THREE.Mesh(cavernGeo, cavernMat);
    cavernMesh.rotation.z = Math.PI / 2;
    cavernMesh.position.set(0, 2, -tunnelLength / 2 + 10);
    tunnelGroup.add(cavernMesh);

    // Glowing Side Energy Pillars with Warning Lights
    for (let z = 0; z > -tunnelLength; z -= 15) {
      [-trackWidth / 2 - 0.5, trackWidth / 2 + 0.5].forEach((xSide, sIdx) => {
        const pillarGeo = new THREE.CylinderGeometry(0.18, 0.18, 5, 8);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x333b4d, metalness: 0.8 });
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(xSide, 2.5, z);
        tunnelGroup.add(pillar);

        const beaconGeo = new THREE.SphereGeometry(0.25, 8, 8);
        const beaconMat = new THREE.MeshBasicMaterial({ color: sIdx === 0 ? 0xff2222 : 0x00ffcc });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.set(xSide, 5, z);
        tunnelGroup.add(beacon);
      });
    }

    // Boiling Lava Pits
    const lavaPits: THREE.Mesh[] = [];
    const pitPositions = [-70, -180, -320, -450];
    pitPositions.forEach(zPit => {
      const lavaGeo = new THREE.PlaneGeometry(trackWidth + 2, 22);
      const lavaMat = new THREE.MeshStandardMaterial({
        color: 0xff3300,
        emissive: 0xff2200,
        emissiveIntensity: 1.2,
        roughness: 0.3
      });
      const lava = new THREE.Mesh(lavaGeo, lavaMat);
      lava.rotation.x = -Math.PI / 2;
      lava.position.set(0, -0.2, zPit);
      tunnelGroup.add(lava);
      lavaPits.push(lava);
    });

    scene.add(tunnelGroup);

    // 2. Helper to Build 3D Cute Robot Character
    const createRobot = (bodyColor: string, isPlayer: boolean = false) => {
      const bot = new THREE.Group();

      // Head
      const headGeo = new THREE.SphereGeometry(0.7, 16, 16);
      const headMat = new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.3, roughness: 0.4 });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 1.6;
      head.castShadow = true;
      bot.add(head);

      // Face Visor Display
      const visorGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.35, 16, 1, false, 0, Math.PI);
      const visorMat = new THREE.MeshBasicMaterial({ color: 0x050c18 });
      const visor = new THREE.Mesh(visorGeo, visorMat);
      visor.rotation.x = Math.PI / 2;
      visor.position.set(0, 1.6, 0.52);
      bot.add(visor);

      // Digital Glowing Eyes
      const eyeGeo = new THREE.PlaneGeometry(0.18, 0.08);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
      const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
      leftEye.position.set(-0.2, 1.62, 0.72);
      bot.add(leftEye);

      const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
      rightEye.position.set(0.2, 1.62, 0.72);
      bot.add(rightEye);

      // Antenna
      const antStemGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8);
      const antMat = new THREE.MeshStandardMaterial({ color: 0x8899aa });
      const antStem = new THREE.Mesh(antStemGeo, antMat);
      antStem.position.set(0, 2.4, 0);
      bot.add(antStem);

      const antBallGeo = new THREE.SphereGeometry(0.12, 8, 8);
      const antBallMat = new THREE.MeshBasicMaterial({ color: 0x00e1ff });
      const antBall = new THREE.Mesh(antBallGeo, antBallMat);
      antBall.position.set(0, 2.6, 0);
      bot.add(antBall);

      // Torso
      const bodyGeo = new THREE.CylinderGeometry(0.5, 0.4, 0.8, 16);
      const body = new THREE.Mesh(bodyGeo, headMat);
      body.position.y = 0.85;
      body.castShadow = true;
      bot.add(body);

      // Jetpack on Back
      const jetGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.6, 8);
      const jetMat = new THREE.MeshStandardMaterial({ color: 0x445566, metalness: 0.8 });
      [-0.22, 0.22].forEach(jX => {
        const jet = new THREE.Mesh(jetGeo, jetMat);
        jet.position.set(jX, 0.9, -0.42);
        bot.add(jet);

        // Blue Jet Flame
        const flameGeo = new THREE.ConeGeometry(0.12, 0.4, 8);
        const flameMat = new THREE.MeshBasicMaterial({ color: 0x00d9ff, transparent: true, opacity: 0.85 });
        const flame = new THREE.Mesh(flameGeo, flameMat);
        flame.rotation.x = Math.PI;
        flame.position.set(jX, 0.5, -0.42);
        bot.add(flame);
      });

      // Floating Pedestal if in lobby or standing
      bot.scale.set(0.9, 0.9, 0.9);
      return bot;
    };

    // Spawn Player
    const playerMesh = createRobot(selectedColor, true);
    playerMesh.position.set(0, 0, 0);
    scene.add(playerMesh);

    // Spawn 4 Competitor Bots
    const competitorBotsData = [
      { name: 'Barry Allen', color: '#ffb300', lane: -1, z: 0, speed: 28 },
      { name: 'Natalia', color: '#ff3366', lane: 1, z: 0, speed: 27.5 },
      { name: 'Priscila', color: '#9933ff', lane: 0, z: 0, speed: 28.5 },
      { name: 'Mateus do Grau', color: '#00cc66', lane: -1, z: 0, speed: 27 }
    ];

    const rivals = competitorBotsData.map(botData => {
      const mesh = createRobot(botData.color, false);
      const laneX = botData.lane * 2.2;
      mesh.position.set(laneX, 0, botData.z);
      scene.add(mesh);
      return {
        name: botData.name,
        mesh,
        lane: botData.lane,
        z: botData.z,
        speed: botData.speed,
        targetX: laneX
      };
    });

    // 3. Spawn Obstacles (3D Barricades with Red 'X', Yellow 'X', Green 'X' matching game-19 & game-24)
    const obstacles: THREE.Group[] = [];
    const laneXs = [-2.2, 0, 2.2];

    for (let z = -25; z > -tunnelLength + 30; z -= 28) {
      const blockGroup = new THREE.Group();
      blockGroup.position.set(0, 0, z);

      // Choose which lane is safe (Green 'X') or open
      const safeLane = Math.floor(Math.random() * 3);

      laneXs.forEach((lx, idx) => {
        const isSafe = idx === safeLane;
        const cubeGeo = new THREE.BoxGeometry(1.9, 2.4, 0.8);
        const cubeMat = new THREE.MeshStandardMaterial({
          color: isSafe ? 0x113322 : 0x2a1111,
          metalness: 0.6,
          roughness: 0.3
        });
        const cube = new THREE.Mesh(cubeGeo, cubeMat);
        cube.position.set(lx, 1.2, 0);
        cube.castShadow = true;
        blockGroup.add(cube);

        // Glowing 'X' Face
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#111';
          ctx.fillRect(0, 0, 128, 128);
          ctx.strokeStyle = isSafe ? '#00ff66' : (Math.random() > 0.5 ? '#ff2222' : '#ffcc00');
          ctx.lineWidth = 20;
          ctx.beginPath();
          ctx.moveTo(25, 25);
          ctx.lineTo(103, 103);
          ctx.moveTo(103, 25);
          ctx.lineTo(25, 103);
          ctx.stroke();
        }
        const tex = new THREE.CanvasTexture(canvas);
        const signGeo = new THREE.PlaneGeometry(1.6, 1.6);
        const signMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(lx, 1.2, 0.42);
        blockGroup.add(sign);

        (cube as any).isSafe = isSafe;
        (cube as any).laneIdx = idx;
      });

      scene.add(blockGroup);
      obstacles.push(blockGroup);
    }

    // 4. Spawn Collectibles (Rotating Gold Coins, Blue Diamonds, Red Rubies, Rocket Boosters)
    const collectibles: THREE.Group[] = [];
    for (let z = -15; z > -tunnelLength + 20; z -= 8) {
      const typeRand = Math.random();
      const colGroup = new THREE.Group();
      const chosenLaneX = laneXs[Math.floor(Math.random() * 3)];
      colGroup.position.set(chosenLaneX, 1.2, z);

      if (typeRand < 0.5) {
        // Gold Coin (Ouro)
        const coinGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.08, 16);
        const coinMat = new THREE.MeshStandardMaterial({
          color: 0xffd700,
          metalness: 0.9,
          roughness: 0.1,
          emissive: 0xffaa00,
          emissiveIntensity: 0.4
        });
        const coin = new THREE.Mesh(coinGeo, coinMat);
        coin.rotation.x = Math.PI / 2;
        colGroup.add(coin);
        (colGroup as any).gemType = 'ouro';
      } else if (typeRand < 0.75) {
        // Red Ruby (Rubi)
        const rubyGeo = new THREE.OctahedronGeometry(0.4, 0);
        const rubyMat = new THREE.MeshStandardMaterial({
          color: 0xff1144,
          emissive: 0x990022,
          emissiveIntensity: 0.6,
          metalness: 0.5,
          roughness: 0.1
        });
        const ruby = new THREE.Mesh(rubyGeo, rubyMat);
        colGroup.add(ruby);
        (colGroup as any).gemType = 'rubi';
      } else if (typeRand < 0.92) {
        // Blue Diamond (Diamante)
        const diaGeo = new THREE.ConeGeometry(0.38, 0.55, 6);
        const diaMat = new THREE.MeshStandardMaterial({
          color: 0x00f0ff,
          emissive: 0x0088cc,
          emissiveIntensity: 0.8,
          metalness: 0.8,
          roughness: 0.05
        });
        const dia = new THREE.Mesh(diaGeo, diaMat);
        dia.rotation.x = Math.PI;
        colGroup.add(dia);
        (colGroup as any).gemType = 'diamante';
      } else {
        // Rocket Booster Powerup
        const rocketGeo = new THREE.ConeGeometry(0.3, 0.7, 8);
        const rocketMat = new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff2200 });
        const rocket = new THREE.Mesh(rocketGeo, rocketMat);
        colGroup.add(rocket);
        (colGroup as any).gemType = 'rocket';
      }

      scene.add(colGroup);
      collectibles.push(colGroup);
    }

    // Set Ref State
    threeState.current = {
      scene,
      camera,
      renderer,
      playerMesh,
      rivalMeshes: rivals.map(r => r.mesh),
      obstacles,
      collectibles,
      animId: 0,
      clock: new THREE.Clock(),
      playerLane: 0,
      targetX: 0,
      playerY: 0,
      playerZ: 0,
      isJumping: false,
      jumpVelocity: 0,
      speed: 28.0,
      raceDistance: tunnelLength - 30,
      isGameActive: false,
      rivals
    };

    // Key Listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!threeState.current || !threeState.current.isGameActive) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        moveLane(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        moveLane(1);
      } else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        jump();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Window Resize Handler
    const handleResize = () => {
      if (!mountRef.current || !threeState.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      threeState.current.camera.aspect = w / h;
      threeState.current.camera.updateProjectionMatrix();
      threeState.current.renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let lastTime = performance.now();
    const animate = (time: number) => {
      const delta = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const st = threeState.current;
      if (!st) return;

      if (st.isGameActive) {
        // Move Forward
        st.playerZ -= st.speed * delta;
        st.playerMesh.position.z = st.playerZ;

        // Smooth Lane Transition
        st.playerMesh.position.x += (st.targetX - st.playerMesh.position.x) * 14 * delta;

        // Banking Rotation during lane shift
        const xDiff = st.targetX - st.playerMesh.position.x;
        st.playerMesh.rotation.z = -xDiff * 0.25;

        // Handle Jump / Gravity
        if (st.isJumping) {
          st.playerY += st.jumpVelocity * delta;
          st.jumpVelocity -= 26 * delta; // Gravity
          if (st.playerY <= 0) {
            st.playerY = 0;
            st.isJumping = false;
            st.jumpVelocity = 0;
          }
        }
        st.playerMesh.position.y = st.playerY;

        // Move Camera with Player
        st.camera.position.z = st.playerZ + 6.8;
        st.camera.position.x = st.playerMesh.position.x * 0.45;
        st.camera.position.y = 3.8 + st.playerY * 0.4;
        st.camera.lookAt(st.playerMesh.position.x * 0.2, 1.6 + st.playerY * 0.2, st.playerZ - 12);

        // Update Progress
        const prog = Math.min(100, Math.floor((Math.abs(st.playerZ) / st.raceDistance) * 100));
        setRaceProgress(prog);

        // Move Competitor Bots
        let aheadCount = 0;
        st.rivals.forEach(bot => {
          bot.z -= bot.speed * delta;
          bot.mesh.position.z = bot.z;
          // Random lane shift for AI bots
          if (Math.random() < 0.015) {
            const newLane = (Math.floor(Math.random() * 3) - 1);
            bot.targetX = newLane * 2.2;
          }
          bot.mesh.position.x += (bot.targetX - bot.mesh.position.x) * 6 * delta;

          if (bot.z < st.playerZ) {
            aheadCount++;
          }
        });
        setCurrentRank(aheadCount + 1);

        // Rotate Collectibles & Check Pickups
        st.collectibles.forEach(col => {
          col.rotation.y += 3.5 * delta;
          if (Math.abs(col.position.z - st.playerZ) < 1.4 && Math.abs(col.position.x - st.playerMesh.position.x) < 1.2) {
            // Collision with collectible!
            const gemType = (col as any).gemType;
            if (gemType === 'ouro') {
              playSfx('coin');
              setGemsCollected(prev => ({ ...prev, ouro: prev.ouro + 1 }));
            } else if (gemType === 'rubi') {
              playSfx('gem');
              setGemsCollected(prev => ({ ...prev, rubi: prev.rubi + 1 }));
            } else if (gemType === 'diamante') {
              playSfx('gem');
              setGemsCollected(prev => ({ ...prev, diamante: prev.diamante + 1 }));
            } else if (gemType === 'rocket') {
              playSfx('boost');
              setActivePowerup('rocket');
              st.speed = 46.0;
              setTimeout(() => {
                if (threeState.current) threeState.current.speed = 28.0;
                setActivePowerup(null);
              }, 4000);
            }
            col.position.y = -999; // Remove from view
          }
        });

        // Check Obstacle Collisions
        st.obstacles.forEach(blockGrp => {
          if (Math.abs(blockGrp.position.z - st.playerZ) < 1.3) {
            blockGrp.children.forEach(child => {
              if (child instanceof THREE.Mesh && (child as any).laneIdx !== undefined) {
                const laneIdx = (child as any).laneIdx;
                const isSafe = (child as any).isSafe;
                const playerLaneIdx = st.playerLane + 1; // 0, 1, 2
                if (playerLaneIdx === laneIdx && !isSafe && st.playerY < 1.4) {
                  // Hit Red Obstacle!
                  playSfx('hit');
                  st.speed = Math.max(16, st.speed - 9);
                  setTimeout(() => {
                    if (threeState.current) threeState.current.speed = 28;
                  }, 1200);
                }
              }
            });
          }
        });

        // Check Finish Line (CHEGADA)
        if (Math.abs(st.playerZ) >= st.raceDistance) {
          st.isGameActive = false;
          const finalRank = aheadCount + 1;
          const prizeMultiplier = finalRank === 1 ? 3.6 : (finalRank === 2 ? 1.8 : (finalRank === 3 ? 1.0 : 0));
          const prizeMoney = Number((selectedFee * prizeMultiplier).toFixed(2));
          setWinnings(prizeMoney);

          if (finalRank === 1) {
            playSfx('win');
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
          }

          // Credit winnings & finalize race in Firebase backend
          if (activeRaceId) {
            fetch('/api/game/finalizar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                corrida_id: activeRaceId,
                posicao: finalRank,
                ouro_coletado: gemsCollected.ouro,
                rubi_coletado: gemsCollected.rubi,
                diamante_coletado: gemsCollected.diamante,
                tempo_segundos: 25
              })
            })
              .then(res => res.ok ? res.json() : null)
              .then(data => {
                if (data?.saldo_atualizado !== undefined) {
                  setProfile(prev => ({
                    ...prev,
                    saldo: Number(data.saldo_atualizado),
                    victories: finalRank === 1 ? prev.victories + 1 : prev.victories
                  }));
                }
              })
              .catch(() => {});
          } else if (prizeMoney > 0) {
            setProfile(prev => ({
              ...prev,
              saldo: prev.saldo + prizeMoney,
              victories: finalRank === 1 ? prev.victories + 1 : prev.victories
            }));
          }

          setTimeout(() => {
            setActiveScreen('victory');
          }, 800);
        }
      }

      st.renderer.render(st.scene, st.camera);
      st.animId = requestAnimationFrame(animate);
    };

    threeState.current.animId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      if (threeState.current) {
        cancelAnimationFrame(threeState.current.animId);
        threeState.current.renderer.dispose();
      }
    };
  }, [activeScreen, selectedColor, selectedFee]);

  // Player Lane Switcher
  const moveLane = (dir: -1 | 1) => {
    if (!threeState.current || !threeState.current.isGameActive) return;
    const newLane = Math.max(-1, Math.min(1, threeState.current.playerLane + dir));
    threeState.current.playerLane = newLane;
    threeState.current.targetX = newLane * 2.2;
    playSfx('beep');
  };

  const setLaneExplicit = (lane: -1 | 0 | 1) => {
    if (!threeState.current || !threeState.current.isGameActive) return;
    threeState.current.playerLane = lane;
    threeState.current.targetX = lane * 2.2;
    playSfx('beep');
  };

  const jump = () => {
    if (!threeState.current || !threeState.current.isGameActive) return;
    if (!threeState.current.isJumping) {
      threeState.current.isJumping = true;
      threeState.current.jumpVelocity = 11.5;
      playSfx('boost');
    }
  };

  return (
    <div className="relative w-full h-screen bg-[#060D2A] text-white overflow-hidden select-none flex justify-center items-center">
      {/* MOBILE CONTAINER WRAPPER (Smartphone frame on desktop, fullscreen on mobile) */}
      <div className="relative w-full max-w-[440px] h-full sm:h-[92vh] sm:rounded-3xl shadow-2xl overflow-hidden bg-[#0A1640] border-0 sm:border-4 sm:border-slate-800 flex flex-col font-lilita">

        {/* ============================================================== */}
        {/* 1. LOBBY SCREEN (Exact replication of game-01-1_webp_71.webp) */}
        {/* ============================================================== */}
        {activeScreen === 'lobby' && (
          <div className="relative w-full h-full flex flex-col justify-between p-4 bg-gradient-to-b from-[#0c1e54] via-[#10307c] to-[#0a469a]">
            {/* Header: Profile, SACAR/DEPOSITAR, Saldo */}
            <div className="flex justify-between items-start pt-2 z-20">
              {/* User Avatar + Name + Buttons */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="relative w-12 h-12 rounded-full border-2 border-white overflow-hidden bg-blue-500 shadow-md">
                    <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setActiveScreen('customization')}
                      className="absolute bottom-0 right-0 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center text-[10px] text-black shadow"
                    >
                      ✏️
                    </button>
                  </div>
                  <div>
                    <h2 className="text-base text-white stroke-black-2 leading-tight uppercase font-extrabold">
                      {profile.name}
                    </h2>
                  </div>
                </div>

                {/* SACAR & DEPOSITAR Quick Pills */}
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

              {/* Saldo & Locked Quick Buttons */}
              <div className="flex flex-col items-end gap-3">
                {/* Money Container */}
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

                {/* Right Floating Badges (Campeões, Mensagens, Presentes) */}
                <div className="flex flex-col gap-2">
                  <button className="flex flex-col items-center justify-center w-12 h-12 bg-blue-700/80 border-2 border-blue-400 rounded-xl shadow text-white hover:brightness-110 active:scale-95">
                    <span className="text-base">🏆</span>
                    <span className="text-[9px] uppercase tracking-tighter">Campeões</span>
                  </button>
                  <button className="flex flex-col items-center justify-center w-12 h-12 bg-blue-600/90 border-2 border-cyan-400 rounded-xl shadow text-white hover:brightness-110 active:scale-95">
                    <span className="text-base">📢</span>
                    <span className="text-[9px] uppercase tracking-tighter">Mensagens</span>
                  </button>
                  <button className="flex flex-col items-center justify-center w-12 h-12 bg-blue-700/80 border-2 border-blue-400 rounded-xl shadow text-white hover:brightness-110 active:scale-95">
                    <span className="text-base">🎁</span>
                    <span className="text-[9px] uppercase tracking-tighter">Presentes</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Central Pedestal & 3D Robot Character Preview */}
            <div className="relative flex-1 flex flex-col items-center justify-center z-10">
              <div className="relative flex flex-col items-center animate-bounce-gentle">
                <img
                  src={`/images/character_${selectedCharId}_${24 + selectedCharId}.webp`}
                  alt="Robot"
                  className="w-48 h-48 object-contain drop-shadow-[0_15px_25px_rgba(0,0,0,0.6)]"
                />
                <img
                  src="/images/base_24.webp"
                  alt="Pedestal"
                  className="w-64 h-auto -mt-10 object-contain drop-shadow-2xl"
                />
              </div>
            </div>

            {/* Action Buttons: "VS Jogar com Amigos" & "JOGAR" */}
            <div className="flex items-center gap-3 px-2 mb-3 z-20">
              <button
                onClick={() => setActiveScreen('friends')}
                className="flex-1 h-14 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-2xl border-4 border-black shadow-[0_6px_0_#000] active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 text-sm tracking-wider uppercase"
              >
                <span className="italic font-black text-lg text-yellow-300">VS</span>
                <span className="stroke-black-3 text-center leading-tight">Jogar com<br />Amigos</span>
              </button>

              <button
                onClick={() => setActiveScreen('modes')}
                className="flex-1 h-14 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-white rounded-2xl border-4 border-black shadow-[0_6px_0_#000] active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 text-2xl tracking-widest uppercase stroke-black-4"
              >
                <span>⚔️</span>
                <span>JOGAR</span>
              </button>
            </div>

            {/* Bottom Bar: Itens, Ranking, Loja, Amigos, Missões */}
            <div className="grid grid-cols-5 gap-1 pt-2 border-t border-white/20 z-20 bg-blue-950/70 -mx-4 -mb-4 px-3 pb-3">
              <button
                onClick={() => setActiveScreen('customization')}
                className="flex flex-col items-center justify-center py-1 text-white hover:text-yellow-400"
              >
                <span className="text-xl">🎒</span>
                <span className="text-[10px] tracking-tight uppercase">Itens</span>
              </button>
              <Link
                href="/profile/me?tab=ranking"
                className="flex flex-col items-center justify-center py-1 text-white hover:text-yellow-400"
              >
                <span className="text-xl">👑</span>
                <span className="text-[10px] tracking-tight uppercase">Ranking</span>
              </Link>
              <button className="flex flex-col items-center justify-center py-1 text-white/50 cursor-not-allowed">
                <span className="text-xl">🏪</span>
                <span className="text-[10px] tracking-tight uppercase">Loja</span>
              </button>
              <button
                onClick={() => setActiveScreen('friends')}
                className="flex flex-col items-center justify-center py-1 text-white hover:text-yellow-400"
              >
                <span className="text-xl">👥</span>
                <span className="text-[10px] tracking-tight uppercase">Amigos</span>
              </button>
              <button className="flex flex-col items-center justify-center py-1 text-white/50 cursor-not-allowed">
                <span className="text-xl">🎯</span>
                <span className="text-[10px] tracking-tight uppercase">Missões</span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 2. MODE SELECTION SCREEN (Replication of game-02-1_webp_72.webp)*/}
        {/* ============================================================== */}
        {activeScreen === 'modes' && (
          <div className="relative w-full h-full flex flex-col justify-between p-4 bg-[#0A1640]">
            {/* Header: Back Button + Balance */}
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

            {/* Mode Tabs: Maratona 5x | Trio Clash | X1 */}
            <div className="flex items-center justify-center gap-4 mt-3 border-b-2 border-white/20 pb-2">
              <button
                onClick={() => setSelectedMode('maratona')}
                className={`text-lg uppercase tracking-wide transition-all ${selectedMode === 'maratona' ? 'text-white border-b-4 border-yellow-400 font-black' : 'text-white/60 font-bold'}`}
              >
                Maratona 5x
              </button>
              <button
                onClick={() => setSelectedMode('trio')}
                className={`text-lg uppercase tracking-wide transition-all ${selectedMode === 'trio' ? 'text-white border-b-4 border-yellow-400 font-black' : 'text-white/60 font-bold'}`}
              >
                Trio Clash
              </button>
              <button
                onClick={() => setSelectedMode('x1')}
                className={`text-lg uppercase tracking-wide transition-all ${selectedMode === 'x1' ? 'text-white border-b-4 border-yellow-400 font-black' : 'text-white/60 font-bold'}`}
              >
                X1
              </button>
            </div>

            {/* Mode Banner Artwork (game-02) */}
            <div className="relative my-2 rounded-2xl overflow-hidden border-2 border-blue-500/50 shadow-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 p-3">
              <h3 className="text-center text-yellow-300 text-lg uppercase tracking-widest stroke-black-2 mb-2">
                {selectedMode === 'maratona' ? 'MARATONA 5' : selectedMode === 'trio' ? 'TRIO CLASH' : 'DUELO X1'}
              </h3>

              <div className="flex items-center justify-around py-2">
                <img src="/images/character_1_25.webp" alt="" className="w-12 h-12 object-contain" />
                <span className="text-xs font-black text-white italic">VS</span>
                <img src="/images/character_2_26.webp" alt="" className="w-12 h-12 object-contain" />
                {selectedMode !== 'x1' && (
                  <>
                    <span className="text-xs font-black text-white italic">VS</span>
                    <img src="/images/character_3_27.webp" alt="" className="w-12 h-12 object-contain" />
                  </>
                )}
                {selectedMode === 'maratona' && (
                  <>
                    <span className="text-xs font-black text-white italic">VS</span>
                    <img src="/images/character_4_28.webp" alt="" className="w-12 h-12 object-contain" />
                  </>
                )}
              </div>
            </div>

            {/* Mode Description Box */}
            <div className="bg-blue-900/60 border-2 border-blue-500 rounded-2xl p-4 shadow-lg text-center">
              <h4 className="text-yellow-400 text-lg uppercase font-black stroke-black-2 mb-1">
                {selectedMode === 'maratona' ? '5 competidores' : selectedMode === 'trio' ? '3 competidores' : '1 contra 1'}
              </h4>
              <p className="text-white text-xs leading-relaxed font-sans font-medium">
                {selectedMode === 'maratona'
                  ? 'Nesta modalidade são 5 pessoas competindo em uma mesma corrida e os 3 primeiros colocados serão premiados.'
                  : selectedMode === 'trio'
                  ? 'Disputa acirrada entre 3 corredores. Os 2 primeiros colocados levam a premiação.'
                  : 'Duelo mano a mano direto na pista. O vencedor leva todo o prêmio acumulado da sala.'}
              </p>
            </div>

            {/* Entry Fee Options */}
            <div className="my-2">
              <label className="block text-xs uppercase text-slate-300 font-extrabold mb-1">
                Escolha o valor da aposta:
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 5, 10, 25].map(val => (
                  <button
                    key={val}
                    onClick={() => setSelectedFee(val)}
                    className={`py-2 rounded-xl font-black text-sm uppercase transition-all border-2 ${selectedFee === val ? 'bg-yellow-400 text-black border-black shadow-[0_3px_0_#000]' : 'bg-slate-800 text-white border-slate-600 hover:bg-slate-700'}`}
                  >
                    R$ {val}
                  </button>
                ))}
              </div>
            </div>

            {/* Subscription Box & Green ENTRAR Button */}
            <div className="bg-[#0e245c] border-2 border-blue-500 rounded-2xl p-4 flex items-center justify-between shadow-xl">
              <div>
                <span className="text-[11px] text-slate-300 uppercase block font-bold">Inscrição</span>
                <span className="text-2xl text-white font-black stroke-black-2">
                  R$ {selectedFee.toFixed(2)}
                </span>
              </div>

              <button
                onClick={() => startRace(selectedFee)}
                className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white rounded-xl border-3 border-black shadow-[0_4px_0_#000] active:translate-y-1 active:shadow-none text-xl tracking-wider uppercase stroke-black-3"
              >
                ENTRAR
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 3. CUSTOMIZATION SCREEN (Equipamentos game-10_webp_80.webp)   */}
        {/* ============================================================== */}
        {activeScreen === 'customization' && (
          <div className="relative w-full h-full flex flex-col justify-between p-4 bg-[#0A1640]">
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setActiveScreen('lobby')}
                className="w-10 h-10 rounded-xl bg-slate-700/80 border-2 border-slate-500 text-white flex items-center justify-center text-lg active:scale-95 shadow"
              >
                ◀
              </button>
              <h2 className="text-2xl text-white stroke-black-3 uppercase tracking-wider">
                Equipamentos
              </h2>
            </div>

            {/* 3D Preview of Selected Robot */}
            <div className="flex-1 flex flex-col items-center justify-center my-2">
              <img
                src={`/images/character_${selectedCharId}_${24 + selectedCharId}.webp`}
                alt="Robot"
                className="w-40 h-40 object-contain drop-shadow-[0_12px_20px_rgba(0,0,0,0.8)]"
              />
            </div>

            {/* Customization Tabs: Accessories | Colors | Faces | Icons */}
            <div className="flex items-center justify-around border-b-2 border-white/20 pb-2 mb-3">
              <button
                onClick={() => setCustomTab('accessories')}
                className={`text-sm uppercase tracking-wide ${customTab === 'accessories' ? 'text-white border-b-2 border-yellow-400 font-black' : 'text-white/60 font-bold'}`}
              >
                Accessories
              </button>
              <button
                onClick={() => setCustomTab('colors')}
                className={`text-sm uppercase tracking-wide ${customTab === 'colors' ? 'text-white border-b-2 border-yellow-400 font-black' : 'text-white/60 font-bold'}`}
              >
                Colors
              </button>
              <button
                onClick={() => setCustomTab('faces')}
                className={`text-sm uppercase tracking-wide ${customTab === 'faces' ? 'text-white border-b-2 border-yellow-400 font-black' : 'text-white/60 font-bold'}`}
              >
                Faces
              </button>
              <button
                onClick={() => setCustomTab('icons')}
                className={`text-sm uppercase tracking-wide ${customTab === 'icons' ? 'text-white border-b-2 border-yellow-400 font-black' : 'text-white/60 font-bold'}`}
              >
                Icons
              </button>
            </div>

            {/* Color Grid (Exact colors from game-10) */}
            <div className="grid grid-cols-4 gap-2.5 pb-4">
              {[
                { hex: '#ffffff', charId: 1, name: 'Branco' },
                { hex: '#2196f3', charId: 2, name: 'Azul' },
                { hex: '#00e5ff', charId: 1, name: 'Ciano' },
                { hex: '#9e9e9e', charId: 3, name: 'Cinza' },
                { hex: '#795548', charId: 4, name: 'Marrom' },
                { hex: '#212121', charId: 2, name: 'Preto' },
                { hex: '#e91e63', charId: 3, name: 'Rosa' },
                { hex: '#4caf50', charId: 1, name: 'Verde' },
                { hex: '#f44336', charId: 4, name: 'Vermelho' }
              ].map((c, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedColor(c.hex);
                    setSelectedCharId(c.charId);
                    setProfile(prev => ({ ...prev, avatar: `/images/character_${c.charId}_${24 + c.charId}.webp` }));
                  }}
                  className={`relative p-2 rounded-2xl bg-blue-900/80 border-3 flex flex-col items-center justify-center transition-all ${selectedColor === c.hex ? 'border-amber-400 ring-2 ring-amber-400 shadow-lg scale-105' : 'border-blue-700 hover:border-blue-500'}`}
                >
                  <img
                    src={`/images/character_${c.charId}_${24 + c.charId}.webp`}
                    alt=""
                    className="w-12 h-12 object-contain"
                  />
                  <div
                    className="w-3 h-3 rounded-full mt-1 border border-white"
                    style={{ backgroundColor: c.hex }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 4. JOGAR COM AMIGOS SCREEN (game-05_webp_75.webp)              */}
        {/* ============================================================== */}
        {activeScreen === 'friends' && (
          <div className="relative w-full h-full flex flex-col justify-between p-4 bg-[#0A1640]">
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setActiveScreen('lobby')}
                className="w-10 h-10 rounded-xl bg-slate-700/80 border-2 border-slate-500 text-white flex items-center justify-center text-lg active:scale-95 shadow"
              >
                ◀
              </button>
              <h2 className="text-2xl text-white stroke-black-3 uppercase tracking-wider">
                Jogar com amigos
              </h2>
            </div>

            <div className="flex-1 flex flex-col justify-center gap-5 my-4">
              {/* Criar Partida Card */}
              <div className="bg-[#0e245c] border-3 border-blue-500 rounded-3xl p-5 shadow-2xl text-center flex flex-col items-center">
                <h3 className="text-xl text-white stroke-black-2 uppercase mb-2">
                  Criar partida
                </h3>
                <p className="text-xs text-white/80 font-sans mb-4">
                  Personalize uma corrida e convide seus amigos!
                </p>
                {roomCode ? (
                  <div className="w-full mb-3">
                    <span className="text-xs text-yellow-300 block uppercase font-bold">Código da sala:</span>
                    <span className="text-2xl tracking-widest text-emerald-400 font-mono font-black">{roomCode}</span>
                  </div>
                ) : null}
                <button
                  onClick={() => {
                    const code = 'ARENA-' + Math.floor(1000 + Math.random() * 9000);
                    setRoomCode(code);
                  }}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-2xl border-3 border-black shadow-[0_4px_0_#000] active:translate-y-1 active:shadow-none text-lg uppercase tracking-wider stroke-black-2"
                >
                  {roomCode ? 'Sala Criada!' : 'Criar'}
                </button>
              </div>

              {/* Participar de uma partida Card */}
              <div className="bg-[#0e245c] border-3 border-blue-500 rounded-3xl p-5 shadow-2xl text-center flex flex-col items-center">
                <h3 className="text-xl text-white stroke-black-2 uppercase mb-2">
                  Participar de uma partida
                </h3>
                <p className="text-xs text-white/80 font-sans mb-3">
                  Insira o código da partida
                </p>
                <input
                  type="text"
                  placeholder="EX: ARENA-5829"
                  value={inputCode}
                  onChange={e => setInputCode(e.target.value.toUpperCase())}
                  className="w-full bg-[#08153b] border-2 border-blue-400 rounded-xl px-4 py-2.5 text-center text-white font-mono font-bold uppercase tracking-wider mb-4 outline-none focus:border-yellow-400"
                />
                <button
                  onClick={() => {
                    if (!inputCode) {
                      alert('Digite um código de partida!');
                      return;
                    }
                    startRace(5.0);
                  }}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-2xl border-3 border-black shadow-[0_4px_0_#000] active:translate-y-1 active:shadow-none text-lg uppercase tracking-wider stroke-black-2"
                >
                  Participar
                </button>
              </div>
            </div>

            <div />
          </div>
        )}

        {/* ============================================================== */}
        {/* 5. ACTIVE 3D RACE RUNNER (game-14, 15, 18, 19, 24)            */}
        {/* ============================================================== */}
        {activeScreen === 'playing' && (
          <div className="relative w-full h-full">
            {/* 3D WebGL Canvas Viewport */}
            <div ref={mountRef} className="absolute inset-0 w-full h-full z-0 cursor-pointer" />

            {/* TOP HUD (Position, Gems, Diamonds, Coins from game-14 & game-24) */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-30 pointer-events-none">
              {/* Position: 1º / 2º / 3º */}
              <div className="text-4xl text-white stroke-black-4 font-black drop-shadow-lg">
                {currentRank}º
              </div>

              {/* Collectibles Pill (💎 Blue Diamond, 🔴 Red Ruby, 🪙 Gold Coin) */}
              <div className="flex items-center gap-3 bg-black/50 backdrop-blur-md border border-white/20 px-3 py-1 rounded-full shadow-lg">
                <div className="flex items-center gap-1">
                  <span className="text-base">💎</span>
                  <span className="text-cyan-400 font-extrabold text-sm">{gemsCollected.diamante}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-base">🔴</span>
                  <span className="text-red-400 font-extrabold text-sm">{gemsCollected.rubi}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-base">🪙</span>
                  <span className="text-yellow-400 font-extrabold text-sm">{gemsCollected.ouro}</span>
                </div>
              </div>
            </div>

            {/* LEFT PROGRESS TRACK (Vertical progress line from game-14/18/24) */}
            <div className="absolute left-3 top-20 bottom-28 w-6 z-30 pointer-events-none flex flex-col items-center">
              <div className="relative w-1.5 h-full bg-white/40 rounded-full overflow-hidden">
                <div
                  className="absolute bottom-0 w-full bg-emerald-500 rounded-full transition-all duration-100"
                  style={{ height: `${raceProgress}%` }}
                />
              </div>

              {/* Player Avatar Pin moving upwards */}
              <div
                className="absolute w-8 h-8 rounded-full border-2 border-white shadow-lg overflow-hidden bg-blue-600 transition-all duration-100 -ml-1"
                style={{ bottom: `calc(${raceProgress}% - 16px)` }}
              >
                <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
              </div>
            </div>

            {/* COUNTDOWN OVERLAY (3, 2, 1, VAI! from game-18) */}
            {countdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/30 backdrop-blur-xs pointer-events-none">
                <span className="text-8xl text-yellow-400 font-black stroke-black-6 animate-ping-once drop-shadow-2xl">
                  {countdown}
                </span>
              </div>
            )}

            {/* BOTTOM CONTROLS: 3 CYAN RETICLE TARGET RINGS (game-14, 18, 19, 24) */}
            <div className="absolute bottom-6 left-0 right-0 flex items-center justify-around px-4 z-30">
              {/* Left Ring */}
              <button
                onClick={() => setLaneExplicit(-1)}
                className="w-16 h-16 rounded-full border-3 border-cyan-400/80 bg-cyan-500/10 flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.4)] active:scale-90 transition-transform"
              >
                <div className="w-8 h-8 rounded-full border-2 border-cyan-300 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-cyan-400" />
                </div>
              </button>

              {/* Center Ring (or Jump) */}
              <button
                onClick={() => {
                  setLaneExplicit(0);
                  jump();
                }}
                className="w-16 h-16 rounded-full border-3 border-cyan-400/80 bg-cyan-500/10 flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.4)] active:scale-90 transition-transform"
              >
                {activePowerup === 'rocket' ? (
                  <span className="text-2xl animate-pulse">🚀</span>
                ) : (
                  <div className="w-8 h-8 rounded-full border-2 border-cyan-300 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-cyan-400" />
                  </div>
                )}
              </button>

              {/* Right Ring */}
              <button
                onClick={() => setLaneExplicit(1)}
                className="w-16 h-16 rounded-full border-3 border-cyan-400/80 bg-cyan-500/10 flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.4)] active:scale-90 transition-transform"
              >
                <div className="w-8 h-8 rounded-full border-2 border-cyan-300 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-cyan-400" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 6. VICTORY SCREEN MODAL (Exact match of game-17_webp_87.webp) */}
        {/* ============================================================== */}
        {activeScreen === 'victory' && (
          <div className="relative w-full h-full flex flex-col items-center justify-center p-6 bg-black/80 backdrop-blur-md z-50">
            {/* Victory Blue Box Container */}
            <div className="relative w-full max-w-[340px] bg-[#0c3e7a] border-4 border-black rounded-3xl p-6 shadow-2xl flex flex-col items-center">
              {/* Circular Avatar Badge on Top */}
              <div className="absolute -top-12 w-24 h-24 rounded-full border-4 border-black overflow-hidden bg-blue-500 shadow-2xl">
                <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
              </div>

              {/* Orange Banner with Player Name */}
              <div className="w-[110%] -mx-4 mt-8 py-2 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 border-y-3 border-black text-center shadow-lg transform -rotate-1">
                <h3 className="text-white text-xl font-extrabold uppercase stroke-black-2 tracking-wider">
                  {profile.name}
                </h3>
              </div>

              {/* Medal & Rank */}
              <div className="flex flex-col items-center my-6">
                <div className="text-6xl mb-2 animate-bounce-gentle">
                  {currentRank === 1 ? '🥇' : currentRank === 2 ? '🥈' : '🥉'}
                </div>
                <h4 className="text-3xl text-white font-black stroke-black-3 uppercase tracking-wider">
                  {currentRank}º LUGAR
                </h4>
                <span className="text-emerald-300 font-extrabold text-sm uppercase tracking-widest mt-1">
                  {currentRank === 1 ? 'PARABÉNS! VOCÊ VENCEU!' : 'BOM DESEMPENHO!'}
                </span>
              </div>

              {/* Prize Winnings Display */}
              <div className="bg-blue-950/80 border-2 border-blue-400 rounded-2xl w-full py-3 px-4 text-center mb-6 shadow-inner">
                <span className="text-slate-300 text-xs uppercase block font-bold">Premiação Recebida</span>
                <span className="text-3xl text-yellow-400 font-black stroke-black-2">
                  + R$ {winnings.toFixed(2)}
                </span>
                <div className="flex justify-center gap-4 mt-2 text-xs text-white">
                  <span>🪙 +{gemsCollected.ouro} Ouro</span>
                  <span>💎 +{gemsCollected.diamante} Diamante</span>
                </div>
              </div>

              {/* Green Continuar Button */}
              <button
                onClick={() => setActiveScreen('lobby')}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white rounded-2xl border-3 border-black shadow-[0_5px_0_#000] active:translate-y-1 active:shadow-none text-xl uppercase tracking-wider stroke-black-2"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
