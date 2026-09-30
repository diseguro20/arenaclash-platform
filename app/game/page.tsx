'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function GamePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Betting & Room setup
  const [gameState, setGameState] = useState<'lobby' | 'playing' | 'gameover'>('lobby');
  const [betAmount, setBetAmount] = useState('5');
  const [selectedChar, setSelectedChar] = useState<number>(1);
  const [modalidade, setModalidade] = useState<'classica' | 'avancada' | 'sobrevivencia'>('classica');
  const [startingRace, setStartingRace] = useState(false);

  // Active game session
  const [activeSession, setActiveSession] = useState<any>(null);
  const [position, setPosition] = useState(3);
  const [progress, setProgress] = useState(0); // 0 to 100%
  const [coinsCollected, setCoinsCollected] = useState({ ouro: 0, rubi: 0, diamante: 0 });
  const [raceResult, setRaceResult] = useState<any>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Fetch authenticated user
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

  // Start race
  const handleStartRace = async () => {
    const val = Number(betAmount);
    if (isNaN(val) || val < 1) {
      alert('Aposta mínima de R$ 1,00.');
      return;
    }
    if ((user?.saldo || 0) < val) {
      alert('Saldo insuficiente! Faça um depósito para correr.');
      return;
    }

    setStartingRace(true);
    try {
      const res = await fetch('/api/game/iniciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valor_entrada: val,
          modalidade,
          personagem: selectedChar,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao iniciar corrida.');

      setActiveSession(data);
      setUser((prev: any) => ({ ...prev, saldo: data.saldo_restante }));
      setCoinsCollected({ ouro: 0, rubi: 0, diamante: 0 });
      setProgress(0);
      setPosition(3);
      setGameState('playing');
    } catch (err: any) {
      alert(err.message || 'Erro ao entrar na corrida.');
    } finally {
      setStartingRace(false);
    }
  };

  // Canvas game engine
  useEffect(() => {
    if (gameState !== 'playing' || !canvasRef.current || !activeSession) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Load assets
    const charImg = new Image();
    charImg.src = `/images/character_${selectedChar}_${selectedChar + 24}.webp`;

    const baseImg = new Image();
    baseImg.src = '/images/base_24.webp';

    const goldImg = new Image();
    goldImg.src = '/images/asset_7.svg';

    const rubyImg = new Image();
    rubyImg.src = '/images/asset_8.svg';

    const diamondImg = new Image();
    diamondImg.src = '/images/asset_9.svg';

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Lanes (0: Left, 1: Center, 2: Right)
    let currentLane = 1; // Center
    let targetLaneX = width / 2;
    let playerX = width / 2;
    let playerY = height - 160;
    let isJumping = false;
    let jumpY = 0;
    let jumpVelocity = 0;

    let speed = 7;
    let distance = 0;
    const totalDistance = 1200; // Finish line

    // Track obstacles & coins
    const items: Array<{
      lane: number;
      y: number;
      type: 'box' | 'laser' | 'ouro' | 'rubi' | 'diamante' | 'boost';
      hit?: boolean;
    }> = [];

    // Pre-populate items along the track
    for (let d = 300; d < totalDistance; d += 80 + Math.random() * 60) {
      const lane = Math.floor(Math.random() * 3);
      const rand = Math.random();
      if (rand < 0.35) {
        items.push({ lane, y: -d * 8, type: 'box' });
      } else if (rand < 0.55) {
        items.push({ lane, y: -d * 8, type: 'laser' });
      } else if (rand < 0.8) {
        items.push({ lane, y: -d * 8, type: 'ouro' });
      } else if (rand < 0.92) {
        items.push({ lane, y: -d * 8, type: 'rubi' });
      } else {
        items.push({ lane, y: -d * 8, type: 'diamante' });
      }
    }

    // Bots simulation
    const bots = (activeSession.adversarios || []).map((b: any, i: number) => ({
      ...b,
      lane: (i + 1) % 3,
      distance: 0,
      speed: (activeSession.is_influencer ? 0.85 : 0.95 + Math.random() * 0.1) * speed,
    }));

    // Player inputs
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        if (currentLane > 0) currentLane--;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        if (currentLane < 2) currentLane++;
      } else if ((e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w' || e.key === 'W') && !isJumping) {
        isJumping = true;
        jumpVelocity = 16;
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Touch controls
    let touchStartX = 0;
    let touchStartY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };
    const handleTouchEnd = (e: TouchEvent) => {
      const deltaX = e.changedTouches[0].clientX - touchStartX;
      const deltaY = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
        if (deltaX < 0 && currentLane > 0) currentLane--;
        else if (deltaX > 0 && currentLane < 2) currentLane++;
      } else if (deltaY < -30 && !isJumping) {
        isJumping = true;
        jumpVelocity = 16;
      }
    };
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);

    let collectedGold = 0;
    let collectedRuby = 0;
    let collectedDiamond = 0;
    let raceFinished = false;

    // Finish race handler
    const finishRace = async (finalPos: number) => {
      if (raceFinished) return;
      raceFinished = true;

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
      } catch (err) {
        setRaceResult({ posicao: finalPos, valor_premio: 0, mensagem: 'Corrida finalizada!' });
        setGameState('gameover');
      }
    };

    // Animation loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Draw 3D Perspective Track
      const horizonY = height * 0.35;
      const trackTopW = width * 0.25;
      const trackBottomW = Math.min(width * 0.9, 600);

      // Track surface gradient
      const trackGrad = ctx.createLinearGradient(0, horizonY, 0, height);
      trackGrad.addColorStop(0, '#041630');
      trackGrad.addColorStop(1, '#082f64');

      ctx.beginPath();
      ctx.moveTo(width / 2 - trackTopW / 2, horizonY);
      ctx.lineTo(width / 2 + trackTopW / 2, horizonY);
      ctx.lineTo(width / 2 + trackBottomW / 2, height);
      ctx.lineTo(width / 2 - trackBottomW / 2, height);
      ctx.closePath();
      ctx.fillStyle = trackGrad;
      ctx.fill();
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Lane lines
      const laneStepTop = trackTopW / 3;
      const laneStepBottom = trackBottomW / 3;

      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(width / 2 - trackTopW / 2 + i * laneStepTop, horizonY);
        ctx.lineTo(width / 2 - trackBottomW / 2 + i * laneStepBottom, height);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 2;
        ctx.setLineDash([15, 15]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Moving track stripes
      const stripeOffset = (distance * 10) % 60;
      for (let y = horizonY; y < height; y += 40) {
        const py = y + (stripeOffset * (y - horizonY)) / (height - horizonY);
        if (py > horizonY && py < height) {
          ctx.beginPath();
          const progressY = (py - horizonY) / (height - horizonY);
          const currentW = trackTopW + (trackBottomW - trackTopW) * progressY;
          ctx.moveTo(width / 2 - currentW / 2, py);
          ctx.lineTo(width / 2 + currentW / 2, py);
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Update distance & progress
      distance += speed / 60;
      const currentPct = Math.min(100, Math.floor((distance / totalDistance) * 100));
      setProgress(currentPct);

      // Player lane position
      const laneCenterOffsets = [-laneStepBottom, 0, laneStepBottom];
      targetLaneX = width / 2 + laneCenterOffsets[currentLane];
      playerX += (targetLaneX - playerX) * 0.2;

      // Jumping physics
      if (isJumping) {
        jumpY += jumpVelocity;
        jumpVelocity -= 1.0;
        if (jumpY <= 0) {
          jumpY = 0;
          isJumping = false;
        }
      }

      // 2. Draw & Update Items
      const laneCenters = [
        width / 2 - laneStepBottom,
        width / 2,
        width / 2 + laneStepBottom,
      ];

      items.forEach((item) => {
        item.y += speed * 4;

        if (item.y > horizonY && item.y < height + 50 && !item.hit) {
          const itemProgress = (item.y - horizonY) / (height - horizonY);
          if (itemProgress >= 0 && itemProgress <= 1) {
            const currentItemW = trackTopW + (trackBottomW - trackTopW) * itemProgress;
            const itemStep = currentItemW / 3;
            const ix = width / 2 - currentItemW / 2 + (item.lane + 0.5) * itemStep;
            const itemSize = 25 + itemProgress * 35;

            // Draw Item
            if (item.type === 'box') {
              ctx.fillStyle = '#ff2a5f';
              ctx.strokeStyle = '#000';
              ctx.lineWidth = 2;
              ctx.fillRect(ix - itemSize / 2, item.y - itemSize, itemSize, itemSize);
              ctx.strokeRect(ix - itemSize / 2, item.y - itemSize, itemSize, itemSize);
            } else if (item.type === 'laser') {
              ctx.fillStyle = '#FEDF19';
              ctx.fillRect(ix - itemSize * 0.8, item.y - 8, itemSize * 1.6, 8);
            } else if (item.type === 'ouro' && goldImg.complete) {
              ctx.drawImage(goldImg, ix - itemSize / 2, item.y - itemSize, itemSize, itemSize);
            } else if (item.type === 'rubi' && rubyImg.complete) {
              ctx.drawImage(rubyImg, ix - itemSize / 2, item.y - itemSize, itemSize, itemSize);
            } else if (item.type === 'diamante' && diamondImg.complete) {
              ctx.drawImage(diamondImg, ix - itemSize / 2, item.y - itemSize, itemSize, itemSize);
            }

            // Collision Check with player
            if (
              item.y >= playerY - 30 &&
              item.y <= playerY + 30 &&
              Math.abs(ix - playerX) < 40
            ) {
              if (item.type === 'ouro') {
                item.hit = true;
                collectedGold++;
                setCoinsCollected((prev) => ({ ...prev, ouro: prev.ouro + 1 }));
              } else if (item.type === 'rubi') {
                item.hit = true;
                collectedRuby++;
                setCoinsCollected((prev) => ({ ...prev, rubi: prev.rubi + 1 }));
              } else if (item.type === 'diamante') {
                item.hit = true;
                collectedDiamond++;
                setCoinsCollected((prev) => ({ ...prev, diamante: prev.diamante + 1 }));
              } else if ((item.type === 'box' || item.type === 'laser') && !isJumping) {
                // Hit obstacle -> temporary slowdown unless influencer
                if (!activeSession.is_influencer) {
                  item.hit = true;
                  speed = Math.max(3.5, speed - 2.5);
                }
              }
            }
          }
        }
      });

      // Gradually recover speed
      if (speed < 7) speed += 0.03;

      // 3. Draw Player Runner
      const playerDrawY = playerY - jumpY;

      // Pedestal base
      if (baseImg.complete) {
        ctx.drawImage(baseImg, playerX - 45, playerDrawY + 40, 90, 25);
      }

      // Character Runner
      if (charImg.complete) {
        ctx.drawImage(charImg, playerX - 40, playerDrawY - 45, 80, 95);
      } else {
        // Fallback runner avatar
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.arc(playerX, playerDrawY, 30, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Bot Competitors along the road
      let aheadCount = 0;
      bots.forEach((bot: any) => {
        bot.distance += bot.speed / 60;
        if (bot.distance > distance) aheadCount++;
      });

      const currentPlace = aheadCount + 1;
      setPosition(currentPlace);

      // Check finish line
      if (distance >= totalDistance && !raceFinished) {
        const finalRank = activeSession.is_influencer ? 1 : currentPlace;
        finishRace(finalRank);
        return;
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [gameState, activeSession, selectedChar]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060D2A] flex items-center justify-center text-white font-lilita text-xl">
        CARREGANDO ARENA...
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#060D2A] text-white overflow-hidden select-none">
      {/* 1. LOBBY / ROOM SELECTION SCREEN */}
      {gameState === 'lobby' && (
        <div className="min-h-screen flex flex-col justify-between p-4 sm:p-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <Link href="/profile/me" className="flex items-center gap-2 text-white/80 hover:text-white font-bold text-sm">
              ← Voltar ao Perfil
            </Link>

            <div className="flex items-center gap-3">
              <span className="text-xs text-white/60 font-bold uppercase">Saldo:</span>
              <span className="font-lilita text-lg text-[#FEDF19]">
                R$ {Number(user?.saldo || 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Lobby Content */}
          <div className="my-auto py-6 space-y-6">
            <div className="text-center">
              <h1 className="text-3xl sm:text-5xl font-lilita uppercase tracking-wide stroke-black-3 text-[#FEDF19]">
                SALA DE CORRIDA MULTIPLAYER
              </h1>
              <p className="text-xs sm:text-sm text-white/80 max-w-lg mx-auto mt-1">
                Escolha seu robô, o valor da entrada e prepare seus reflexos para vencer 4 adversários!
              </p>
            </div>

            {/* Character Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-white/70 block text-center">
                Escolha seu Corredor:
              </label>
              <div className="grid grid-cols-4 gap-3 max-w-md mx-auto">
                {[
                  { id: 1, name: 'Azul', color: 'border-cyan-400', img: '/images/character_1_25.webp' },
                  { id: 2, name: 'Vermelho', color: 'border-red-500', img: '/images/character_2_26.webp' },
                  { id: 3, name: 'Amarelo', color: 'border-yellow-400', img: '/images/character_3_27.webp' },
                  { id: 4, name: 'Verde', color: 'border-emerald-400', img: '/images/character_4_28.webp' },
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedChar(c.id)}
                    className={`flex flex-col items-center p-2 rounded-2xl border-4 transition-all bg-black/40 ${
                      selectedChar === c.id ? `${c.color} scale-105 shadow-lg bg-white/10` : 'border-white/10 opacity-70'
                    }`}
                  >
                    <img src={c.img} alt={c.name} className="h-16 sm:h-20 w-auto object-contain" />
                    <span className="text-[10px] font-luckiest uppercase mt-1 text-white">{c.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Modalidade */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-white/70 block text-center">
                Modalidade de Pista:
              </label>
              <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-md mx-auto">
                {[
                  { id: 'classica', name: 'Clássica', mult: '3.5x' },
                  { id: 'avancada', name: 'Avançada', mult: '3.5x' },
                  { id: 'sobrevivencia', name: 'Sobrevivência', mult: '3.5x' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setModalidade(m.id as any)}
                    className={`py-2 px-1 rounded-xl font-lilita text-xs sm:text-sm uppercase border-2 transition-all ${
                      modalidade === m.id
                        ? 'bg-[#FEDF19] text-black border-black scale-105'
                        : 'bg-black/30 text-white border-white/20'
                    }`}
                  >
                    <div>{m.name}</div>
                    <div className="text-[10px] text-emerald-400 font-extrabold">{m.mult}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Bet Amount */}
            <div className="space-y-2 max-w-md mx-auto">
              <label className="text-xs font-bold uppercase text-white/70 block text-center">
                Valor da Entrada (R$):
              </label>
              <div className="grid grid-cols-5 gap-2">
                {['2', '5', '10', '20', '50'].map((val) => (
                  <button
                    key={val}
                    onClick={() => setBetAmount(val)}
                    className={`py-2 rounded-lg font-lilita text-sm uppercase border-2 transition-all ${
                      betAmount === val ? 'bg-[#FEDF19] text-black border-black scale-105' : 'bg-black/30 border-white/20 text-white'
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
                className="w-full mt-2 px-4 py-2.5 bg-black/40 border border-white/20 rounded-xl text-center text-white font-lilita text-xl focus:outline-none focus:border-[#FEDF19]"
              />
            </div>

            {/* Start Race Button */}
            <div className="max-w-md mx-auto pt-2">
              <button
                onClick={handleStartRace}
                disabled={startingRace}
                className="w-full h-16 bg-[#25D366] hover:bg-[#20ba5a] text-black font-lilita text-2xl uppercase tracking-widest rounded-2xl border-4 border-black flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(37,211,102,0.4)] active:scale-95 transition-all disabled:opacity-50"
              >
                {startingRace ? 'ENTRANDO NA ARENA...' : '⚡ ENTRAR NA CORRIDA'}
              </button>
            </div>
          </div>

          <div className="text-center text-xs text-white/40">
            Controles: Setas ou A/D para mudar de faixa • Espaço ou Seta Cima para pular obstáculos.
          </div>
        </div>
      )}

      {/* 2. PLAYING / CANVAS RACER SCREEN */}
      {gameState === 'playing' && (
        <div className="relative w-full h-screen overflow-hidden">
          {/* Canvas */}
          <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />

          {/* HUD Overlay */}
          <div className="absolute top-4 inset-x-4 flex items-center justify-between pointer-events-none z-30">
            {/* Position Rank */}
            <div className="bg-black/60 border-2 border-white/40 backdrop-blur-md px-4 py-2 rounded-2xl flex items-center gap-2 shadow-lg">
              <span className="text-xs text-white/70 font-bold uppercase">POSIÇÃO:</span>
              <span
                className={`font-luckiest text-2xl sm:text-3xl stroke-black-2 ${
                  position === 1 ? 'text-[#FFD700]' : position === 2 ? 'text-slate-200' : 'text-amber-500'
                }`}
              >
                {position}º
              </span>
            </div>

            {/* Collected Coins */}
            <div className="flex items-center gap-2 bg-black/60 border-2 border-white/40 backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-lg">
              <div className="flex items-center gap-1">
                <img src="/images/asset_7.svg" alt="" className="w-5 h-5" />
                <span className="font-luckiest text-xs text-yellow-400">{coinsCollected.ouro}</span>
              </div>
              <div className="flex items-center gap-1">
                <img src="/images/asset_8.svg" alt="" className="w-5 h-5" />
                <span className="font-luckiest text-xs text-red-400">{coinsCollected.rubi}</span>
              </div>
              <div className="flex items-center gap-1">
                <img src="/images/asset_9.svg" alt="" className="w-5 h-5" />
                <span className="font-luckiest text-xs text-cyan-400">{coinsCollected.diamante}</span>
              </div>
            </div>
          </div>

          {/* Progress Bar (Distance to finish) */}
          <div className="absolute bottom-20 sm:bottom-8 inset-x-8 max-w-md mx-auto pointer-events-none z-30 flex flex-col items-center gap-1">
            <div className="flex justify-between w-full text-[11px] font-bold text-white/80 uppercase">
              <span>LARGADA</span>
              <span>{progress}% CONCLUÍDO</span>
              <span>CHEGADA 🏁</span>
            </div>
            <div className="w-full h-3 bg-black/60 border border-white/40 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-gradient-to-r from-yellow-400 to-[#25D366] rounded-full transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Virtual Mobile Controls (Visible on small screens) */}
          <div className="sm:hidden absolute bottom-4 inset-x-4 flex justify-between gap-4 pointer-events-auto z-40">
            <button
              onTouchStart={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))}
              className="w-16 h-16 bg-black/50 border-2 border-white/50 rounded-2xl active:bg-white/30 text-white font-lilita text-2xl flex items-center justify-center backdrop-blur-md"
            >
              ◀
            </button>
            <button
              onTouchStart={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))}
              className="flex-1 h-16 bg-[#FEDF19]/80 border-2 border-black rounded-2xl active:bg-yellow-400 text-black font-lilita text-xl uppercase tracking-wider flex items-center justify-center shadow-lg"
            >
              PULAR ⬆
            </button>
            <button
              onTouchStart={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))}
              className="w-16 h-16 bg-black/50 border-2 border-white/50 rounded-2xl active:bg-white/30 text-white font-lilita text-2xl flex items-center justify-center backdrop-blur-md"
            >
              ▶
            </button>
          </div>
        </div>
      )}

      {/* 3. GAME OVER / PODIUM SCREEN */}
      {gameState === 'gameover' && raceResult && (
        <div className="min-h-screen bg-black/90 flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-[#0A3456] rounded-3xl p-6 sm:p-8 text-center text-white border-4 border-black shadow-2xl animate-fadeIn">
            {/* Crown or Result Medal */}
            <div className="w-24 h-24 mx-auto mb-3 flex items-center justify-center">
              {raceResult.posicao === 1 ? (
                <img src="/images/1_33.svg" alt="1º" className="w-full h-full object-contain animate-bounce" />
              ) : raceResult.posicao === 2 ? (
                <img src="/images/2_34.svg" alt="2º" className="w-full h-full object-contain" />
              ) : raceResult.posicao === 3 ? (
                <img src="/images/3_35.svg" alt="3º" className="w-full h-full object-contain" />
              ) : (
                <span className="text-6xl">🏁</span>
              )}
            </div>

            <h2
              className={`text-3xl sm:text-4xl font-lilita uppercase tracking-wide stroke-black-3 mb-1 ${
                raceResult.posicao === 1 ? 'text-[#FFD700]' : 'text-white'
              }`}
            >
              {raceResult.mensagem}
            </h2>

            <p className="text-xs text-white/70 mb-4">
              Você cruzou a linha de chegada em <strong>{raceResult.posicao}º Lugar</strong>!
            </p>

            {/* Prize Card */}
            <div className="bg-black/40 border border-white/20 rounded-2xl p-4 mb-4">
              <span className="text-[10px] text-white/60 font-bold uppercase">Premiação Conquistada:</span>
              <p className="text-3xl font-lilita text-emerald-400 mt-1 stroke-black-1">
                R$ {Number(raceResult.valor_premio || 0).toFixed(2)}
              </p>
              {raceResult.pontos_ranking > 0 && (
                <span className="text-xs font-bold text-[#FEDF19]">
                  +{raceResult.pontos_ranking} Pontos no Ranking!
                </span>
              )}
            </div>

            {/* Collected items reward */}
            <div className="flex items-center justify-center gap-4 bg-black/20 py-2 rounded-xl mb-6 text-xs font-bold">
              <span className="text-yellow-400">+{coinsCollected.ouro} Ouro</span>
              <span className="text-red-400">+{coinsCollected.rubi} Rubi</span>
              <span className="text-cyan-400">+{coinsCollected.diamante} Diamante</span>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setGameState('lobby')}
                className="w-full py-4 bg-[#25D366] hover:bg-[#20ba5a] text-black font-lilita text-xl uppercase tracking-wider rounded-xl border-3 border-black shadow-lg active:scale-95 transition-all"
              >
                CORRER NOVAMENTE
              </button>

              <Link
                href="/profile/me"
                className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-lilita text-sm uppercase rounded-xl border border-white/20 transition-all"
              >
                Voltar ao Painel
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
