'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface RivalBot {
  name: string;
  avatar: string;
  charId: number;
  lane: number;
  progress: number;
  speed: number;
  targetLane: number;
  laneChangeTimer: number;
}

interface TrackObstacle {
  id: number;
  z: number; // Distance from start (0 to 1500)
  lane: number; // 0, 1, 2
  type: 'cube_red' | 'cube_green' | 'cube_yellow' | 'boulder' | 'lava' | 'booster';
  hit?: boolean;
}

interface TrackGem {
  id: number;
  z: number;
  lane: number;
  type: 'ouro' | 'rubi' | 'diamante';
  collected?: boolean;
}

export default function GamePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Navigation tabs in Lobby: 'maratona' | 'trio' | 'x1'
  const [showModeModal, setShowModeModal] = useState(false);
  const [showPartyModal, setShowPartyModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'maratona' | 'trio' | 'x1'>('maratona');
  const [betAmount, setBetAmount] = useState('5');
  const [selectedChar, setSelectedChar] = useState<number>(1);
  const [startingRace, setStartingRace] = useState(false);

  // Game state: 'lobby' | 'playing' | 'gameover'
  const [gameState, setGameState] = useState<'lobby' | 'playing' | 'gameover'>('lobby');
  const [activeSession, setActiveSession] = useState<any>(null);

  // HUD stats during race
  const [currentRank, setCurrentRank] = useState(1);
  const [raceGems, setRaceGems] = useState({ ouro: 0, rubi: 0, diamante: 0 });
  const [playerRaceProgress, setPlayerRaceProgress] = useState(0); // 0 to 100
  const [countdownText, setCountdownText] = useState<string | null>(null);
  const [raceResult, setRaceResult] = useState<any>(null);
  const [activeLaneIndex, setActiveLaneIndex] = useState(1); // 0: Left, 1: Center, 2: Right

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Sound helper using Web Audio API
  const playSfx = (type: 'beep' | 'go' | 'coin' | 'gem' | 'hit' | 'boost' | 'win') => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'beep') {
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'go') {
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'coin') {
        osc.frequency.setValueAtTime(987.77, now);
        osc.frequency.setValueAtTime(1318.51, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'gem') {
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.setValueAtTime(1600, now + 0.06);
        osc.frequency.setValueAtTime(2000, now + 0.12);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.25);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'boost') {
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'win') {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          const noteOsc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          noteOsc.connect(noteGain);
          noteGain.connect(ctx.destination);
          noteOsc.frequency.setValueAtTime(freq, now + idx * 0.12);
          noteGain.gain.setValueAtTime(0.2, now + idx * 0.12);
          noteGain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.12 + 0.3);
          noteOsc.start(now + idx * 0.12);
          noteOsc.stop(now + idx * 0.12 + 0.3);
        });
      }
    } catch (e) {
      // Audio not permitted yet
    }
  };

  // Fetch logged in user
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) throw new Error('Não autenticado');
        return res.json();
      })
      .then((data) => {
        setUser(data.user);
        setLoading(false);
      })
      .catch(() => {
        router.push('/sign-in');
      });
  }, [router]);

  // Start race call
  const handleStartRace = async () => {
    const val = Number(betAmount);
    if (isNaN(val) || val < 1) {
      alert('Aposta mínima de R$ 1,00.');
      return;
    }
    if ((user?.saldo || 0) < val) {
      alert('Saldo insuficiente! Faça um depósito para correr na arena.');
      return;
    }

    setStartingRace(true);
    try {
      const res = await fetch('/api/game/iniciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valor_entrada: val,
          modalidade: selectedTab === 'maratona' ? 'classica' : selectedTab,
          personagem: selectedChar,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao entrar na arena.');

      setActiveSession(data);
      setUser((prev: any) => ({ ...prev, saldo: data.saldo_restante }));
      setShowModeModal(false);
      setRaceGems({ ouro: 0, rubi: 0, diamante: 0 });
      setPlayerRaceProgress(0);
      setCurrentRank(1);
      setActiveLaneIndex(1);
      setGameState('playing');
    } catch (err: any) {
      alert(err.message || 'Erro ao entrar na corrida.');
    } finally {
      setStartingRace(false);
    }
  };

  // --------------------------------------------------------------------------
  // GAME ENGINE CANVAS
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (gameState !== 'playing' || !canvasRef.current || !activeSession) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    // Character assets
    const charImg = new Image();
    charImg.src = `/images/character_${selectedChar}_${selectedChar + 24}.webp`;

    const rivalImg1 = new Image();
    rivalImg1.src = '/images/character_2_26.webp';

    const rivalImg2 = new Image();
    rivalImg2.src = '/images/character_3_27.webp';

    const rivalImg3 = new Image();
    rivalImg3.src = '/images/character_4_28.webp';

    const rivalImg4 = new Image();
    rivalImg4.src = '/images/character_1_25.webp';

    const rivalImages = [rivalImg1, rivalImg2, rivalImg3, rivalImg4];

    // Track total distance in meters
    const TOTAL_TRACK_DISTANCE = 1600;

    // Player state
    let playerDistance = 0;
    let targetLane = 1; // 0: Left, 1: Center, 2: Right
    let currentLaneX = 1; // Smooth interpolate between lanes 0..2
    let playerSpeed = 7.5; // Base speed
    let isJumping = false;
    let jumpY = 0;
    let jumpVy = 0;
    let speedBoostTimer = 0;
    let hitSlowTimer = 0;

    // Track lane positions in X percentage
    const getLaneX = (lane: number, trackWidth: number, centerX: number) => {
      const laneStep = trackWidth * 0.32;
      return centerX + (lane - 1) * laneStep;
    };

    // Rivals state
    const rivalsList: RivalBot[] = [
      { name: 'NATALIA', avatar: 'N', charId: 2, lane: 0, progress: 0, speed: 7.2, targetLane: 0, laneChangeTimer: 100 },
      { name: 'PRISCILA', avatar: 'P', charId: 3, lane: 2, progress: 0, speed: 7.3, targetLane: 2, laneChangeTimer: 140 },
      { name: 'MATEUS DO', avatar: 'M', charId: 4, lane: 0, progress: 0, speed: 7.0, targetLane: 0, laneChangeTimer: 180 },
      { name: 'BARRY ALLEN', avatar: 'B', charId: 1, lane: 2, progress: 0, speed: 7.4, targetLane: 2, laneChangeTimer: 220 },
    ];

    // Filter rivals based on mode
    let activeRivals = rivalsList;
    if (selectedTab === 'x1') activeRivals = [rivalsList[0]];
    else if (selectedTab === 'trio') activeRivals = [rivalsList[0], rivalsList[1]];

    // Generate Obstacles along the 1600m track
    const obstacles: TrackObstacle[] = [];
    for (let z = 180; z < TOTAL_TRACK_DISTANCE - 100; z += 90 + Math.random() * 50) {
      const lane = Math.floor(Math.random() * 3);
      const rand = Math.random();
      let type: TrackObstacle['type'] = 'cube_red';
      if (rand < 0.35) type = 'cube_red';
      else if (rand < 0.55) type = 'boulder';
      else if (rand < 0.75) type = 'lava';
      else if (rand < 0.9) type = 'cube_green';
      else type = 'booster';

      obstacles.push({ id: obstacles.length, z, lane, type, hit: false });
    }

    // Generate Gems along the track
    const gems: TrackGem[] = [];
    for (let z = 120; z < TOTAL_TRACK_DISTANCE - 80; z += 40 + Math.random() * 30) {
      const lane = Math.floor(Math.random() * 3);
      const rand = Math.random();
      let type: TrackGem['type'] = 'ouro';
      if (rand > 0.88) type = 'diamante';
      else if (rand > 0.65) type = 'rubi';

      gems.push({ id: gems.length, z, lane, type, collected: false });
    }

    let collectedGold = 0;
    let collectedRuby = 0;
    let collectedDiamond = 0;

    // Controls
    const setLane = (newLane: number) => {
      if (newLane < 0) newLane = 0;
      if (newLane > 2) newLane = 2;
      targetLane = newLane;
      setActiveLaneIndex(newLane);
    };

    const doJump = () => {
      if (!isJumping) {
        isJumping = true;
        jumpVy = 16;
        playSfx('boost');
      }
    };

    // Keyboard controls
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        setLane(targetLane - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        setLane(targetLane + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
        doJump();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    // Touch Swipe Controls
    let touchStartX = 0;
    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };
    const onTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
        if (dx < 0) setLane(targetLane - 1);
        else setLane(targetLane + 1);
      } else if (dy < -30) {
        doJump();
      }
    };
    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchend', onTouchEnd);

    // Countdown before race start
    let countdownState = 3;
    setCountdownText('3');
    playSfx('beep');

    const cdInterval = setInterval(() => {
      countdownState--;
      if (countdownState === 2) {
        setCountdownText('2');
        playSfx('beep');
      } else if (countdownState === 1) {
        setCountdownText('1');
        playSfx('beep');
      } else if (countdownState === 0) {
        setCountdownText('VAI!');
        playSfx('go');
      } else {
        setCountdownText(null);
        clearInterval(cdInterval);
      }
    }, 900);

    // Finish race
    let raceFinished = false;
    const finishRace = async (finalPos: number) => {
      if (raceFinished) return;
      raceFinished = true;
      playSfx('win');

      try {
        const res = await fetch('/api/game/finalizar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            corrida_id: activeSession.corrida_id,
            posicao: finalPos,
            ouro_coletado: collectedGold,
            rubi_coletado: collectedRuby,
            diamante_coletado: collectedDiamond,
          }),
        });
        const data = await res.json();
        setRaceResult(data);
        setGameState('gameover');
      } catch {
        setRaceResult({ posicao: finalPos, valor_premio: 0, mensagem: 'Corrida finalizada!' });
        setGameState('gameover');
      }
    };

    // ------------------------------------------------------------------------
    // MAIN RENDER LOOP (60 FPS)
    // ------------------------------------------------------------------------
    let frameCount = 0;
    const render = () => {
      frameCount++;
      ctx.clearRect(0, 0, width, height);

      // 1. Move Player & Rivals if countdown finished
      if (countdownState <= 0 && !raceFinished) {
        // Smooth lane interpolation
        currentLaneX += (targetLane - currentLaneX) * 0.18;

        // Speed modifications
        let activeSpeed = playerSpeed;
        if (speedBoostTimer > 0) {
          activeSpeed *= 1.45;
          speedBoostTimer--;
        }
        if (hitSlowTimer > 0) {
          activeSpeed *= 0.65;
          hitSlowTimer--;
        }

        playerDistance += activeSpeed;

        // Jump physics
        if (isJumping) {
          jumpY += jumpVy;
          jumpVy -= 0.85;
          if (jumpY <= 0) {
            jumpY = 0;
            isJumping = false;
          }
        }

        // Rivals AI logic
        activeRivals.forEach((bot, bIdx) => {
          // Normal speed with slight variation
          bot.progress += bot.speed * (0.94 + (Math.sin(frameCount * 0.05 + bIdx) * 0.08));

          // Random lane shift
          bot.laneChangeTimer--;
          if (bot.laneChangeTimer <= 0) {
            bot.targetLane = Math.floor(Math.random() * 3);
            bot.laneChangeTimer = 80 + Math.floor(Math.random() * 120);
          }
          bot.lane += (bot.targetLane - bot.lane) * 0.08;
        });

        // Calculate Rank Position
        let aheadCount = 0;
        activeRivals.forEach((bot) => {
          if (bot.progress > playerDistance) aheadCount++;
        });

        // Influencer mode always finishes 1st
        if (activeSession.is_influencer) {
          aheadCount = 0;
        }

        const calculatedRank = aheadCount + 1;
        setCurrentRank(calculatedRank);

        // Update progress bar
        const pct = Math.min(100, Math.floor((playerDistance / TOTAL_TRACK_DISTANCE) * 100));
        setPlayerRaceProgress(pct);

        // Check Finish Line
        if (playerDistance >= TOTAL_TRACK_DISTANCE) {
          finishRace(calculatedRank);
        }
      }

      // ----------------------------------------------------------------------
      // 2. DRAW 3D PERSPECTIVE CAVERN TUNNEL & TRACK
      // ----------------------------------------------------------------------
      const horizonY = height * 0.28;
      const trackTopW = width * 0.28;
      const trackBottomW = Math.min(width * 0.94, 620);
      const trackLeftTop = width / 2 - trackTopW / 2;
      const trackRightTop = width / 2 + trackTopW / 2;
      const trackLeftBottom = width / 2 - trackBottomW / 2;
      const trackRightBottom = width / 2 + trackBottomW / 2;

      // Cavern Rocky Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#020514');
      bgGrad.addColorStop(0.3, '#0b162c');
      bgGrad.addColorStop(1, '#050c18');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Left & Right Cavern Rock Walls
      const wallGradLeft = ctx.createLinearGradient(0, horizonY, trackLeftBottom, height);
      wallGradLeft.addColorStop(0, '#1a130f');
      wallGradLeft.addColorStop(0.5, '#2b1e17');
      wallGradLeft.addColorStop(1, '#150d0a');
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(trackLeftTop, horizonY);
      ctx.lineTo(trackLeftBottom, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fillStyle = wallGradLeft;
      ctx.fill();

      // Right Cavern Rock Wall
      const wallGradRight = ctx.createLinearGradient(width, horizonY, trackRightBottom, height);
      wallGradRight.addColorStop(0, '#1a130f');
      wallGradRight.addColorStop(0.5, '#2b1e17');
      wallGradRight.addColorStop(1, '#150d0a');
      ctx.beginPath();
      ctx.moveTo(width, 0);
      ctx.lineTo(trackRightTop, horizonY);
      ctx.lineTo(trackRightBottom, height);
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = wallGradRight;
      ctx.fill();

      // Cave ceiling arch & rocks
      ctx.fillStyle = '#100a07';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(width, 0);
      ctx.lineTo(width, horizonY * 0.6);
      ctx.quadraticCurveTo(width / 2, horizonY * 0.9, 0, horizonY * 0.6);
      ctx.closePath();
      ctx.fill();

      // Glowing crystals on cavern walls
      for (let i = 0; i < 6; i++) {
        const py = horizonY + i * ((height - horizonY) / 6);
        const pLeft = trackLeftTop + (trackLeftBottom - trackLeftTop) * (i / 6);
        const pRight = trackRightTop + (trackRightBottom - trackRightTop) * (i / 6);

        // Left crystal
        ctx.fillStyle = i % 2 === 0 ? '#38bdf8' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(pLeft - 22, py, 6, 0, Math.PI * 2);
        ctx.fill();

        // Right crystal
        ctx.fillStyle = i % 2 === 0 ? '#ec4899' : '#10b981';
        ctx.beginPath();
        ctx.arc(pRight + 22, py, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Track Surface (Asphalt Mine Track)
      const trackSurface = ctx.createLinearGradient(0, horizonY, 0, height);
      trackSurface.addColorStop(0, '#111827');
      trackSurface.addColorStop(0.7, '#1f2937');
      trackSurface.addColorStop(1, '#111827');

      ctx.beginPath();
      ctx.moveTo(trackLeftTop, horizonY);
      ctx.lineTo(trackRightTop, horizonY);
      ctx.lineTo(trackRightBottom, height);
      ctx.lineTo(trackLeftBottom, height);
      ctx.closePath();
      ctx.fillStyle = trackSurface;
      ctx.fill();

      // Glowing track neon borders (Cyan)
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00F0FF';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(trackLeftTop, horizonY);
      ctx.lineTo(trackLeftBottom, height);
      ctx.moveTo(trackRightTop, horizonY);
      ctx.lineTo(trackRightBottom, height);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 4. Track Lane Lines (Dashed moving white lines)
      const offsetSpeed = (playerDistance * 2.5) % 80;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([14, 18]);
      ctx.lineDashOffset = -offsetSpeed;

      // Divider 1 (between Lane 0 and Lane 1)
      const d1TopX = trackLeftTop + trackTopW * 0.333;
      const d1BottomX = trackLeftBottom + trackBottomW * 0.333;
      ctx.beginPath();
      ctx.moveTo(d1TopX, horizonY);
      ctx.lineTo(d1BottomX, height);
      ctx.stroke();

      // Divider 2 (between Lane 1 and Lane 2)
      const d2TopX = trackLeftTop + trackTopW * 0.666;
      const d2BottomX = trackLeftBottom + trackBottomW * 0.666;
      ctx.beginPath();
      ctx.moveTo(d2TopX, horizonY);
      ctx.lineTo(d2BottomX, height);
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash

      // ----------------------------------------------------------------------
      // 5. DRAW TRACK OBSTACLES & GEMS IN 3D PERSPECTIVE
      // ----------------------------------------------------------------------
      const renderDistanceView = 500; // Visible meters ahead

      // Filter visible items
      const visibleObstacles = obstacles.filter(
        (ob) => ob.z >= playerDistance - 15 && ob.z <= playerDistance + renderDistanceView
      );

      const visibleGems = gems.filter(
        (g) => !g.collected && g.z >= playerDistance - 15 && g.z <= playerDistance + renderDistanceView
      );

      // Sort back-to-front by z distance for proper depth sorting
      const renderQueue = [
        ...visibleObstacles.map((o) => ({ type: 'obstacle', data: o, z: o.z })),
        ...visibleGems.map((g) => ({ type: 'gem', data: g, z: g.z })),
      ].sort((a, b) => b.z - a.z);

      renderQueue.forEach((item) => {
        const relZ = item.z - playerDistance;
        const depth = 1 - relZ / renderDistanceView; // 0 (far) to 1 (near)
        if (depth < 0.05) return;

        const currentTrackW = trackTopW + (trackBottomW - trackTopW) * depth;
        const currentY = horizonY + (height - horizonY) * Math.pow(depth, 1.4);
        const itemLane = item.data.lane;
        const itemX = getLaneX(itemLane, currentTrackW, width / 2);

        if (item.type === 'gem') {
          const gem = item.data as TrackGem;
          const gemScale = 14 + depth * 22;

          // Bobbing float animation
          const bob = Math.sin(frameCount * 0.1 + gem.id) * 6;

          // Collision detection with player
          if (
            relZ < 25 &&
            relZ > -10 &&
            Math.abs(currentLaneX - itemLane) < 0.45 &&
            !gem.collected
          ) {
            gem.collected = true;
            if (gem.type === 'ouro') {
              collectedGold++;
              playSfx('coin');
              setRaceGems((prev) => ({ ...prev, ouro: prev.ouro + 1 }));
            } else if (gem.type === 'rubi') {
              collectedRuby++;
              playSfx('gem');
              setRaceGems((prev) => ({ ...prev, rubi: prev.rubi + 1 }));
            } else if (gem.type === 'diamante') {
              collectedDiamond++;
              playSfx('gem');
              setRaceGems((prev) => ({ ...prev, diamante: prev.diamante + 1 }));
            }
          }

          // Draw Gem shape
          ctx.save();
          ctx.translate(itemX, currentY + bob);
          if (gem.type === 'ouro') {
            ctx.fillStyle = '#FEDF19';
            ctx.shadowColor = '#FEDF19';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(0, 0, gemScale * 0.7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FFF';
            ctx.font = `bold ${Math.max(8, gemScale * 0.6)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', 0, 0);
          } else if (gem.type === 'rubi') {
            ctx.fillStyle = '#EF4444';
            ctx.shadowColor = '#EF4444';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(0, -gemScale * 0.8);
            ctx.lineTo(gemScale * 0.7, 0);
            ctx.lineTo(0, gemScale * 0.8);
            ctx.lineTo(-gemScale * 0.7, 0);
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.fillStyle = '#38BDF8';
            ctx.shadowColor = '#38BDF8';
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.moveTo(-gemScale * 0.6, -gemScale * 0.4);
            ctx.lineTo(gemScale * 0.6, -gemScale * 0.4);
            ctx.lineTo(0, gemScale * 0.7);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        } else if (item.type === 'obstacle') {
          const ob = item.data as TrackObstacle;
          const obScale = 20 + depth * 65;

          // Collision detection with player
          if (
            relZ < 30 &&
            relZ > -15 &&
            Math.abs(currentLaneX - ob.lane) < 0.45 &&
            !ob.hit
          ) {
            if (ob.type === 'booster') {
              ob.hit = true;
              speedBoostTimer = 90;
              playSfx('boost');
            } else if (!activeSession.is_influencer) {
              if (ob.type === 'cube_red' || ob.type === 'boulder') {
                if (!isJumping || jumpY < 25) {
                  ob.hit = true;
                  hitSlowTimer = 70;
                  playSfx('hit');
                }
              } else if (ob.type === 'lava') {
                if (!isJumping || jumpY < 20) {
                  ob.hit = true;
                  hitSlowTimer = 80;
                  playSfx('hit');
                }
              }
            }
          }

          // Draw Obstacle based on type
          ctx.save();
          ctx.translate(itemX, currentY);

          if (ob.type === 'lava') {
            // Flowing Magma pit across lane
            const lavaW = currentTrackW * 0.32;
            const lavaGrad = ctx.createLinearGradient(0, -10, 0, 20);
            lavaGrad.addColorStop(0, '#FF4500');
            lavaGrad.addColorStop(0.5, '#FFD700');
            lavaGrad.addColorStop(1, '#FF1493');
            ctx.fillStyle = lavaGrad;
            ctx.shadowColor = '#FF4500';
            ctx.shadowBlur = 16;
            ctx.fillRect(-lavaW / 2, -12 * depth, lavaW, 24 * depth);
            // Lava bubbles
            ctx.fillStyle = '#FFF';
            ctx.beginPath();
            ctx.arc(
              Math.sin(frameCount * 0.1) * (lavaW * 0.25),
              0,
              4 * depth,
              0,
              Math.PI * 2
            );
            ctx.fill();
          } else if (ob.type === 'booster') {
            // Neon Green Chevron >>>
            ctx.fillStyle = '#22C55E';
            ctx.shadowColor = '#22C55E';
            ctx.shadowBlur = 14;
            const arrowW = obScale * 0.7;
            ctx.beginPath();
            ctx.moveTo(0, -arrowW * 0.4);
            ctx.lineTo(arrowW * 0.5, 0);
            ctx.lineTo(0, arrowW * 0.4);
            ctx.stroke();
            ctx.font = `bold ${Math.max(10, obScale * 0.4)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⚡ 2X', 0, 0);
          } else if (ob.type === 'boulder') {
            // Falling rock
            ctx.fillStyle = '#4B5563';
            ctx.strokeStyle = '#1F2937';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, -obScale * 0.3, obScale * 0.45, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          } else {
            // 3D Neon Barrier Cube with X
            const cubeW = obScale * 0.85;
            const cubeH = obScale * 0.95;
            const isRed = ob.type === 'cube_red';
            const isGreen = ob.type === 'cube_green';
            const color = isRed ? '#EF4444' : isGreen ? '#22C55E' : '#F59E0B';

            // Cube body
            ctx.fillStyle = '#1F2937';
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            ctx.fillRect(-cubeW / 2, -cubeH, cubeW, cubeH);
            ctx.strokeRect(-cubeW / 2, -cubeH, cubeW, cubeH);

            // Glowing X symbol
            ctx.fillStyle = color;
            ctx.font = `black ${Math.max(12, cubeW * 0.65)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('X', 0, -cubeH * 0.5);
          }
          ctx.restore();
        }
      });

      // ----------------------------------------------------------------------
      // 6. DRAW RIVAL ROBOTS RACING AHEAD / BEHIND
      // ----------------------------------------------------------------------
      activeRivals.forEach((bot, bIdx) => {
        const relZ = bot.progress - playerDistance;
        // Visible within render window
        if (relZ >= -30 && relZ <= renderDistanceView) {
          const depth = Math.max(0.08, Math.min(1.1, 1 - relZ / renderDistanceView));
          const currentTrackW = trackTopW + (trackBottomW - trackTopW) * depth;
          const botY = horizonY + (height - horizonY) * Math.pow(depth, 1.4);
          const botX = getLaneX(bot.lane, currentTrackW, width / 2);

          const botW = Math.max(22, 95 * depth);
          const botH = Math.max(26, 110 * depth);

          ctx.save();
          ctx.translate(botX, botY);

          // Jetpack thrusters
          const flameSize = 10 * depth * (1 + Math.sin(frameCount * 0.3 + bIdx) * 0.3);
          ctx.fillStyle = '#00F0FF';
          ctx.shadowColor = '#00F0FF';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(-botW * 0.22, botH * 0.2, flameSize, 0, Math.PI * 2);
          ctx.arc(botW * 0.22, botH * 0.2, flameSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Draw Bot Image
          const bImg = rivalImages[bIdx % rivalImages.length];
          if (bImg.complete && bImg.naturalWidth > 0) {
            ctx.drawImage(bImg, -botW / 2, -botH, botW, botH);
          } else {
            ctx.fillStyle = '#60A5FA';
            ctx.beginPath();
            ctx.arc(0, -botH / 2, botW / 2, 0, Math.PI * 2);
            ctx.fill();
          }

          // Rival Player Name tag
          ctx.fillStyle = '#FEDF19';
          ctx.font = `bold ${Math.max(8, 12 * depth)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.shadowColor = '#000';
          ctx.shadowBlur = 4;
          ctx.fillText(bot.name, 0, -botH - 4);
          ctx.shadowBlur = 0;

          ctx.restore();
        }
      });

      // ----------------------------------------------------------------------
      // 7. DRAW PLAYER ROBOT (Authentic Back View with Jet Thrusters)
      // ----------------------------------------------------------------------
      const playerY = height - 130 - jumpY;
      const playerTrackW = trackBottomW;
      const playerX = getLaneX(currentLaneX, playerTrackW, width / 2);

      const pW = 105;
      const pH = 120;

      ctx.save();
      ctx.translate(playerX, playerY);

      // Shadow on track (shrinks when jumping)
      const shadowScale = Math.max(0.3, 1 - jumpY / 120);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      ctx.ellipse(0, 15 + jumpY * 0.8, pW * 0.35 * shadowScale, 10 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dual Blue Jetpack Thruster Flames
      const thrusterPulse = 14 + Math.sin(frameCount * 0.4) * 5;
      const thrusterGrad = ctx.createLinearGradient(0, 0, 0, 30);
      thrusterGrad.addColorStop(0, '#00F0FF');
      thrusterGrad.addColorStop(0.7, '#3B82F6');
      thrusterGrad.addColorStop(1, 'transparent');

      ctx.fillStyle = thrusterGrad;
      ctx.shadowColor = '#00F0FF';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(-pW * 0.22, 8, thrusterPulse * 0.6, 0, Math.PI * 2);
      ctx.arc(pW * 0.22, 8, thrusterPulse * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw Player Robot Character
      if (charImg.complete && charImg.naturalWidth > 0) {
        ctx.drawImage(charImg, -pW / 2, -pH, pW, pH);
      } else {
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(0, -pH / 2, pW / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Loop
      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      clearInterval(cdInterval);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [gameState, activeSession, selectedTab, selectedChar]);

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#060D2A] flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-[#FEDF19] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-lilita text-lg uppercase tracking-wider">Carregando Arena Clash...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#060D2A] font-sans select-none overflow-hidden">
      {/* -------------------------------------------------------------------- */}
      {/* 1. LOBBY VIEW (Matching game-01-1_webp_71.webp) */}
      {/* -------------------------------------------------------------------- */}
      {gameState === 'lobby' && (
        <div
          className="relative min-h-screen flex flex-col justify-between bg-cover bg-center overflow-y-auto"
          style={{ backgroundImage: "url('/images/game-01-1_webp_71.webp')" }}
        >
          {/* Subtle overlay for crisp contrast */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-0" />

          {/* TOP BAR: Profile Card & Balance */}
          <header className="relative z-10 px-4 pt-3 flex items-center justify-between">
            {/* User Profile */}
            <div className="flex items-center gap-3 bg-black/60 border border-white/20 px-3 py-1.5 rounded-2xl backdrop-blur-md shadow-lg">
              <div className="relative w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-700 rounded-full border-2 border-white flex items-center justify-center font-lilita text-xl text-white shadow-md">
                {user?.nome ? user.nome.charAt(0).toUpperCase() : 'U'}
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-black" />
              </div>
              <div>
                <div className="font-lilita text-white text-base tracking-wide flex items-center gap-1.5">
                  {user?.nome || 'Piloto Arena'}
                  {user?.is_admin && (
                    <span className="text-[10px] bg-red-600 text-white font-extrabold px-1.5 py-0.5 rounded uppercase">
                      Admin
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-emerald-400 font-bold">Online na Arena</div>
              </div>
            </div>

            {/* Wallet Cash Balance */}
            <div className="bg-[#2D1606]/90 border-2 border-[#FEDF19]/60 px-4 py-1.5 rounded-2xl flex flex-col items-end shadow-lg backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span className="font-lilita text-xl text-[#FEDF19] tracking-wider">
                  R$ {(user?.saldo ?? 0).toFixed(2).replace('.', ',')}
                </span>
                <span className="text-xl">💵</span>
              </div>
              <div className="text-[10px] text-white/70 font-bold">
                Bônus: R$ {(user?.saldo_bonus ?? 0).toFixed(2).replace('.', ',')}
              </div>
            </div>
          </header>

          {/* LEFT & RIGHT QUICK ACTION BUTTONS */}
          <div className="relative z-10 px-4 flex justify-between items-start pointer-events-none mt-2">
            {/* Left Column: SACAR / DEPOSITAR */}
            <div className="flex flex-col gap-2.5 pointer-events-auto">
              <button
                onClick={() => router.push('/profile/me?tab=saque')}
                className="w-24 h-11 bg-gradient-to-b from-gray-100 to-gray-300 hover:from-white hover:to-gray-200 border-2 border-black rounded-xl font-lilita text-xs uppercase tracking-wider text-black flex items-center justify-center gap-1 shadow-md active:scale-95 transition-all"
              >
                <span className="text-red-600 text-sm">▲</span> SACAR
              </button>

              <button
                onClick={() => router.push('/profile/me?tab=deposito')}
                className="w-24 h-11 bg-gradient-to-b from-gray-100 to-gray-300 hover:from-white hover:to-gray-200 border-2 border-black rounded-xl font-lilita text-xs uppercase tracking-wider text-black flex items-center justify-center gap-1 shadow-md active:scale-95 transition-all"
              >
                <span className="text-emerald-600 text-sm">▼</span> DEPOSITAR
              </button>
            </div>

            {/* Right Column: Campeões / Mensagens */}
            <div className="flex flex-col gap-2.5 pointer-events-auto items-end">
              <button
                onClick={() => router.push('/profile/me?tab=ranking')}
                className="w-11 h-11 bg-blue-600/90 border-2 border-white rounded-xl flex items-center justify-center shadow-md active:scale-95 transition-all text-xl"
                title="Ranking Campeões"
              >
                🏆
              </button>
              <button
                onClick={() => window.open('https://wa.link/5obr8i', '_blank')}
                className="w-11 h-11 bg-cyan-600/90 border-2 border-white rounded-xl flex items-center justify-center shadow-md active:scale-95 transition-all text-xl"
                title="Mensagens / Suporte"
              >
                📢
              </button>
            </div>
          </div>

          {/* CENTER: 3D PEDESTAL & ROBOT SHOWCASE */}
          <div className="relative z-10 flex flex-col items-center justify-center my-auto py-4">
            <div className="relative flex flex-col items-center">
              {/* Character Floating on Base */}
              <div className="relative w-44 h-48 flex items-center justify-center animate-bounce duration-1000">
                <img
                  src={`/images/character_${selectedChar}_${selectedChar + 24}.webp`}
                  alt="Robot Runner"
                  className="w-36 h-auto drop-shadow-[0_15px_25px_rgba(0,0,0,0.8)]"
                />
              </div>

              {/* Pedestal Base */}
              <div className="-mt-10 w-56 h-auto">
                <img src="/images/base_24.webp" alt="Pedestal" className="w-full h-auto drop-shadow-2xl" />
              </div>

              {/* Character Selector Chips */}
              <div className="flex gap-2 mt-4 bg-black/60 p-1.5 rounded-full border border-white/20 backdrop-blur-md">
                {[1, 2, 3, 4].map((id) => (
                  <button
                    key={id}
                    onClick={() => setSelectedChar(id)}
                    className={`w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center font-lilita text-xs ${
                      selectedChar === id
                        ? 'border-[#FEDF19] bg-[#FEDF19] text-black scale-110 shadow-lg'
                        : 'border-white/30 bg-black/40 text-white'
                    }`}
                  >
                    #{id}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* BOTTOM BUTTONS & ACTIONS */}
          <div className="relative z-10 px-4 pb-2 space-y-3 max-w-md mx-auto w-full">
            {/* Mode Actions */}
            <div className="grid grid-cols-2 gap-3">
              {/* VS Jogar com Amigos */}
              <button
                onClick={() => setShowPartyModal(true)}
                className="h-16 bg-[#2B7BE4] hover:bg-[#256ecf] text-white font-lilita text-base uppercase rounded-2xl border-4 border-black flex items-center justify-center gap-1.5 shadow-[0_6px_0_#17488b] active:translate-y-1 active:shadow-none transition-all"
              >
                <span className="text-xl">🎮</span>
                <span className="text-center leading-tight">Jogar com<br />Amigos</span>
              </button>

              {/* Big Yellow JOGAR Button */}
              <button
                onClick={() => setShowModeModal(true)}
                className="h-16 bg-gradient-to-b from-[#FEDF19] to-[#E6A800] hover:from-[#FFE642] hover:to-[#FEDF19] text-black font-lilita text-2xl uppercase tracking-wider rounded-2xl border-4 border-black flex items-center justify-center gap-2 shadow-[0_6px_0_#996f00] active:translate-y-1 active:shadow-none transition-all animate-pulse"
              >
                <span>⚔️</span> JOGAR
              </button>
            </div>

            {/* Bottom Nav Bar (Itens, Ranking, Loja, Amigos, Missões) */}
            <nav className="h-14 bg-black/70 border-2 border-white/20 rounded-2xl backdrop-blur-md flex items-center justify-around px-2 shadow-2xl">
              <button
                onClick={() => router.push('/profile/me')}
                className="flex flex-col items-center gap-0.5 text-white/80 hover:text-white"
              >
                <span className="text-base">🎒</span>
                <span className="font-lilita text-[10px] uppercase">Itens</span>
              </button>
              <button
                onClick={() => router.push('/profile/me?tab=ranking')}
                className="flex flex-col items-center gap-0.5 text-[#FEDF19] hover:text-yellow-300"
              >
                <span className="text-base">👑</span>
                <span className="font-lilita text-[10px] uppercase">Ranking</span>
              </button>
              <button
                onClick={() => router.push('/profile/me?tab=afiliado')}
                className="flex flex-col items-center gap-0.5 text-white/80 hover:text-white"
              >
                <span className="text-base">👥</span>
                <span className="font-lilita text-[10px] uppercase">Afiliados</span>
              </button>
              <button
                onClick={() => router.push('/profile/me')}
                className="flex flex-col items-center gap-0.5 text-white/80 hover:text-white"
              >
                <span className="text-base">⚙️</span>
                <span className="font-lilita text-[10px] uppercase">Painel</span>
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 2. MODE SELECTOR MODAL (Matching game-02-1, game-03-1, game-04) */}
      {/* -------------------------------------------------------------------- */}
      {showModeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="relative w-full max-w-md bg-[#0A2540] border-4 border-black rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex flex-col gap-4">
            {/* Close Button */}
            <button
              onClick={() => setShowModeModal(false)}
              className="absolute -top-3 -right-3 w-10 h-10 bg-red-600 border-2 border-black rounded-full text-white font-lilita text-lg flex items-center justify-center shadow-lg active:scale-95"
            >
              ✕
            </button>

            {/* Modal Header Tabs */}
            <div className="flex border-b-2 border-white/20 pb-2 gap-2">
              <button
                onClick={() => setSelectedTab('maratona')}
                className={`flex-1 py-1.5 rounded-xl font-lilita text-sm uppercase transition-all ${
                  selectedTab === 'maratona'
                    ? 'bg-[#FEDF19] text-black border-2 border-black shadow-md'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                Maratona 5x
              </button>
              <button
                onClick={() => setSelectedTab('trio')}
                className={`flex-1 py-1.5 rounded-xl font-lilita text-sm uppercase transition-all ${
                  selectedTab === 'trio'
                    ? 'bg-[#FEDF19] text-black border-2 border-black shadow-md'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                Trio Clash
              </button>
              <button
                onClick={() => setSelectedTab('x1')}
                className={`flex-1 py-1.5 rounded-xl font-lilita text-sm uppercase transition-all ${
                  selectedTab === 'x1'
                    ? 'bg-[#FEDF19] text-black border-2 border-black shadow-md'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                X1
              </button>
            </div>

            {/* Banner of Runners */}
            <div className="relative rounded-2xl overflow-hidden border-2 border-white/20 bg-gradient-to-r from-blue-900 to-indigo-900 p-3 flex flex-col items-center">
              <div className="font-lilita text-white text-xs uppercase tracking-widest mb-1.5">
                {selectedTab === 'maratona' ? 'MARATONA 5 (5 JOGADORES)' : selectedTab === 'trio' ? 'TRIO CLASH (3 JOGADORES)' : 'DUELO X1 (1 VS 1)'}
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <img src="/images/character_1_25.webp" className="w-12 h-12 object-contain" />
                <span className="font-lilita text-[#FEDF19] text-xs">VS</span>
                <img src="/images/character_2_26.webp" className="w-12 h-12 object-contain" />
                {selectedTab !== 'x1' && (
                  <>
                    <span className="font-lilita text-[#FEDF19] text-xs">VS</span>
                    <img src="/images/character_3_27.webp" className="w-12 h-12 object-contain" />
                  </>
                )}
                {selectedTab === 'maratona' && (
                  <>
                    <span className="font-lilita text-[#FEDF19] text-xs">VS</span>
                    <img src="/images/character_4_28.webp" className="w-12 h-12 object-contain" />
                  </>
                )}
              </div>
            </div>

            {/* Mode description text */}
            <div className="bg-black/30 border border-white/10 rounded-xl p-3 text-center text-xs text-white/90 font-montserrat">
              {selectedTab === 'maratona' && (
                <p>Nesta modalidade são 5 corredores competindo em uma mesma pista e os <strong>3 primeiros colocados</strong> serão premiados (1º = 3.5x | 2º = 1.5x | 3º = 1.0x).</p>
              )}
              {selectedTab === 'trio' && (
                <p>Nesta modalidade são 3 competidores em alta velocidade e <strong>apenas o 1º colocado</strong> leva o prêmio da corrida (2.5x).</p>
              )}
              {selectedTab === 'x1' && (
                <p>Aqui é para quem se garante! Duelo direto entre você e outro piloto. <strong>O campeão leva tudo!</strong> (1.8x).</p>
              )}
            </div>

            {/* Bet values selection */}
            <div>
              <label className="block text-[11px] font-bold text-white/80 uppercase mb-1.5 text-center">
                Selecione o valor da entrada:
              </label>
              <div className="grid grid-cols-5 gap-2">
                {['1', '2', '5', '10', '20'].map((val) => (
                  <button
                    key={val}
                    onClick={() => setBetAmount(val)}
                    className={`py-2 rounded-xl font-lilita text-xs uppercase border-2 transition-all ${
                      betAmount === val
                        ? 'bg-[#FEDF19] text-black border-black scale-105 shadow-md'
                        : 'bg-black/40 text-white border-white/20 hover:border-white/50'
                    }`}
                  >
                    R$ {val}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                className="w-full mt-2.5 px-3 py-2 bg-black/50 border border-white/20 rounded-xl text-center text-white font-lilita text-lg focus:outline-none focus:border-[#FEDF19]"
                placeholder="Outro valor..."
              />
            </div>

            {/* ENTRAR button */}
            <button
              onClick={handleStartRace}
              disabled={startingRace}
              className="w-full h-14 bg-[#25D366] hover:bg-[#20ba5a] text-black font-lilita text-2xl uppercase tracking-wider rounded-2xl border-4 border-black flex items-center justify-center gap-2 shadow-[0_6px_0_#128c3e] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
            >
              {startingRace ? 'ENTRANDO NA ARENA...' : 'ENTRAR NA CORRIDA ⚡'}
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 3. JOGAR COM AMIGOS MODAL (game-05_webp_75.webp) */}
      {/* -------------------------------------------------------------------- */}
      {showPartyModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-sm bg-[#092B5A] border-4 border-black rounded-3xl p-5 shadow-2xl flex flex-col gap-4">
            <button
              onClick={() => setShowPartyModal(false)}
              className="absolute -top-3 -right-3 w-10 h-10 bg-red-600 border-2 border-black rounded-full text-white font-lilita text-lg flex items-center justify-center shadow-lg"
            >
              ✕
            </button>
            <h2 className="font-lilita text-xl text-white uppercase text-center">Jogar com amigos</h2>

            <div className="bg-[#0D3875] border-2 border-black rounded-2xl p-4 text-center">
              <h3 className="font-lilita text-white text-base uppercase mb-1">Criar partida</h3>
              <p className="text-xs text-white/70 mb-3">Personalize uma corrida e convide seus amigos!</p>
              <button
                onClick={() => {
                  setShowPartyModal(false);
                  setShowModeModal(true);
                }}
                className="w-full py-2.5 bg-[#25D366] text-black font-lilita text-base uppercase rounded-xl border-2 border-black shadow"
              >
                Criar
              </button>
            </div>

            <div className="bg-[#0D3875] border-2 border-black rounded-2xl p-4 text-center">
              <h3 className="font-lilita text-white text-base uppercase mb-1">Participar de uma partida</h3>
              <p className="text-xs text-white/70 mb-3">Insira o código da corrida:</p>
              <input
                type="text"
                placeholder="CÓDIGO (ex: ARENA77)"
                className="w-full mb-3 px-3 py-2 bg-black/40 border border-white/20 rounded-xl text-center text-white font-lilita uppercase tracking-widest text-sm focus:outline-none"
              />
              <button
                onClick={() => alert('Buscando sala... Sala não encontrada no momento.')}
                className="w-full py-2.5 bg-[#FEDF19] text-black font-lilita text-base uppercase rounded-xl border-2 border-black shadow"
              >
                Participar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 4. CANVAS IN-GAME RACE (Pixel Perfect to game-14, 16, 19, 21) */}
      {/* -------------------------------------------------------------------- */}
      {gameState === 'playing' && (
        <div className="relative w-full h-screen overflow-hidden bg-black">
          {/* Main 60 FPS 3D Perspective Canvas */}
          <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />

          {/* TOP HUD: Position (Left) & Gems (Right) */}
          <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none z-30">
            {/* Position: 1º / 2º / 3º */}
            <div className="flex items-center gap-1">
              <span className="font-lilita text-5xl text-white stroke-black-4 tracking-tighter drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
                {currentRank}º
              </span>
            </div>

            {/* Collected Gems HUD (game-14) */}
            <div className="flex items-center gap-3 bg-black/60 px-3 py-1.5 rounded-full border border-white/20 backdrop-blur-md shadow-xl">
              {/* Diamante */}
              <div className="flex items-center gap-1">
                <span className="text-lg">💎</span>
                <span className="font-lilita text-sm text-[#38BDF8]">{raceGems.diamante}</span>
              </div>
              {/* Rubi */}
              <div className="flex items-center gap-1">
                <span className="text-lg">🔴</span>
                <span className="font-lilita text-sm text-[#EF4444]">{raceGems.rubi}</span>
              </div>
              {/* Ouro */}
              <div className="flex items-center gap-1">
                <span className="text-lg">🟡</span>
                <span className="font-lilita text-sm text-[#FEDF19]">{raceGems.ouro}</span>
              </div>
            </div>
          </div>

          {/* LEFT HUD: Vertical Track Progress Bar (game-14, 16, 19) */}
          <div className="absolute left-3 top-20 bottom-24 w-6 pointer-events-none z-30 flex flex-col items-center">
            {/* Finish Line Flag Icon Top */}
            <div className="text-sm mb-1">🏁</div>

            {/* Progress Track Line */}
            <div className="relative w-1.5 flex-1 bg-white/40 rounded-full overflow-hidden">
              <div
                className="absolute bottom-0 inset-x-0 bg-[#22C55E] transition-all duration-100 rounded-full"
                style={{ height: `${playerRaceProgress}%` }}
              />
            </div>

            {/* Moving Player Circle Avatar on the bar */}
            <div
              className="absolute left-1/2 -translate-x-1/2 w-6 h-6 rounded-full border-2 border-white bg-blue-600 flex items-center justify-center font-lilita text-[10px] text-white shadow-lg transition-all duration-75"
              style={{ bottom: `calc(${playerRaceProgress}% * 0.85)` }}
            >
              {user?.nome ? user.nome.charAt(0).toUpperCase() : 'U'}
            </div>
          </div>

          {/* START COUNTDOWN OVERLAY (3, 2, 1, VAI!) */}
          {countdownText && (
            <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none animate-ping duration-500">
              <span className="font-lilita text-7xl sm:text-9xl text-[#FEDF19] stroke-black-4 drop-shadow-[0_10px_30px_rgba(0,0,0,0.9)]">
                {countdownText}
              </span>
            </div>
          )}

          {/* BOTTOM CONTROLS: 3 Cyan Reticles for 3 Lanes (game-14, 16, 19) */}
          <div className="absolute bottom-6 inset-x-0 flex justify-center items-center gap-8 z-30">
            {[0, 1, 2].map((laneIdx) => (
              <button
                key={laneIdx}
                onClick={() => {
                  setActiveLaneIndex(laneIdx);
                  const evt = new KeyboardEvent('keydown', {
                    key: laneIdx === 0 ? 'ArrowLeft' : laneIdx === 2 ? 'ArrowRight' : 'ArrowLeft',
                  });
                  window.dispatchEvent(evt);
                }}
                className={`relative w-16 h-16 rounded-full border-2 transition-all flex items-center justify-center active:scale-90 ${
                  activeLaneIndex === laneIdx
                    ? 'border-[#00F0FF] bg-[#00F0FF]/20 shadow-[0_0_20px_#00F0FF]'
                    : 'border-cyan-400/40 bg-black/40 hover:border-cyan-400/80'
                }`}
              >
                {/* Concentric rings */}
                <div className="w-10 h-10 rounded-full border border-cyan-400/60 flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-cyan-400/80" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 5. VICTORY / RESULT MODAL (Matching game-17_webp_87.webp) */}
      {/* -------------------------------------------------------------------- */}
      {gameState === 'gameover' && raceResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/bg_103.jpg')" }}
        >
          {/* Cosmic backdrop with confetti */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

          {/* Dialog Card */}
          <div className="relative z-10 w-full max-w-sm bg-[#0E3D75] border-4 border-black rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.9)] flex flex-col items-center animate-scaleUp">
            {/* Top User Avatar in Circle */}
            <div className="-mt-14 w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-800 border-4 border-black flex items-center justify-center font-lilita text-3xl text-white shadow-2xl">
              {user?.nome ? user.nome.charAt(0).toUpperCase() : 'U'}
            </div>

            {/* Orange Banner with Player Name */}
            <div className="w-full -mt-2 bg-gradient-to-r from-[#F97316] via-[#FB923C] to-[#F97316] border-2 border-black rounded-xl py-1 text-center font-lilita text-white text-base tracking-wider shadow-md uppercase">
              {user?.nome || 'Diego'}
            </div>

            {/* Medal Trophy */}
            <div className="my-4 flex flex-col items-center">
              <span className="text-6xl drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)] animate-bounce">
                {raceResult.posicao === 1 ? '🥇' : raceResult.posicao === 2 ? '🥈' : raceResult.posicao === 3 ? '🥉' : '🏁'}
              </span>
              <h2 className="font-lilita text-3xl text-white stroke-black-2 uppercase tracking-wider mt-2">
                {raceResult.posicao}º LUGAR
              </h2>
              <p className="text-sm font-montserrat text-emerald-300 font-bold tracking-wide">
                {raceResult.posicao <= 3 ? 'PARABÉNS! VOCÊ VENCEU!' : 'TENTE NOVAMENTE!'}
              </p>
            </div>

            {/* Reward Summary */}
            <div className="w-full bg-black/40 border border-white/20 rounded-2xl p-3 mb-5 space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-white/70 font-semibold">Prêmio Conquistado:</span>
                <span className="font-lilita text-lg text-emerald-400">
                  R$ {(raceResult.valor_premio ?? 0).toFixed(2).replace('.', ',')}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-white/70">Coletáveis da Pista:</span>
                <div className="flex gap-2 font-lilita">
                  <span className="text-[#FEDF19]">🟡 +{raceGems.ouro}</span>
                  <span className="text-[#EF4444]">🔴 +{raceGems.rubi}</span>
                  <span className="text-[#38BDF8]">💎 +{raceGems.diamante}</span>
                </div>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-white/70">Novo Saldo Total:</span>
                <span className="font-lilita text-white">
                  R$ {((user?.saldo ?? 0) + (raceResult.valor_premio ?? 0)).toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>

            {/* Green CONTINUAR Button */}
            <button
              onClick={() => {
                setGameState('lobby');
                // Refresh balance
                fetch('/api/auth/me')
                  .then((r) => r.json())
                  .then((d) => setUser(d.user));
              }}
              className="w-full h-14 bg-[#25D366] hover:bg-[#20ba5a] text-black font-lilita text-2xl uppercase tracking-wider rounded-2xl border-4 border-black flex items-center justify-center gap-2 shadow-[0_6px_0_#128c3e] active:translate-y-1 active:shadow-none transition-all"
            >
              CONTINUAR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
