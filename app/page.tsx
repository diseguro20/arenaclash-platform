'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1420);

  useEffect(() => {
    // Check if user is logged in
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
        }
      })
      .catch(() => {});

    // Simulated online count fluctuation
    const interval = setInterval(() => {
      setOnlineCount((prev) => prev + Math.floor(Math.random() * 7) - 3);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#060D2A] text-white flex flex-col selection:bg-[#FEDF19] selection:text-black">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#060D2A]/80 border-b border-white/10 px-4 md:px-8 py-3.5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <img
            src="/images/arena_clash_45.webp"
            alt="Arena Clash"
            className="h-10 md:h-12 w-auto object-contain"
          />
        </Link>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{onlineCount.toLocaleString('pt-BR')} CORRENDO AGORA</span>
          </div>

          {user ? (
            <Link
              href="/profile/me"
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 rounded-lg font-bold text-sm hover:brightness-110 active:scale-95 transition-all shadow-lg"
            >
              <span>🎮 PAINEL</span>
              <span className="bg-black/30 px-2 py-0.5 rounded text-xs text-[#FEDF19]">
                R$ {Number(user.saldo || 0).toFixed(2)}
              </span>
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/sign-in"
                className="px-3.5 py-1.5 rounded-lg border border-white/30 text-white font-bold text-xs uppercase hover:bg-white/10 transition-colors"
              >
                Entrar
              </Link>
              <Link
                href="/sign-up"
                className="px-4 py-1.5 rounded-lg bg-[#de9612] hover:bg-[#e8a31e] text-black font-lilita font-bold text-sm uppercase tracking-wider shadow-lg active:scale-95 transition-all"
              >
                Cadastrar
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-8 pb-16 md:py-24 px-4 flex flex-col items-center text-center">
        {/* Background Artwork */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-30">
          <img
            src="/images/bg_103.jpg"
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#060D2A]/60 via-[#060D2A] to-[#060D2A]" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 bg-[#FEDF19]/10 border border-[#FEDF19]/40 text-[#FEDF19] px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider mb-6">
            ⚡ O 1º MULTIPLAYER DE CORRIDA COM OBSTÁCULOS
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-lilita tracking-wider uppercase stroke-black-4 text-[#FEDF19] leading-tight mb-4 drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]">
            CORRA. DESAFIE. VENÇA.
          </h1>

          <p className="text-base sm:text-xl text-white/90 max-w-2xl font-montserrat font-medium mb-8 leading-relaxed">
            O multiplayer onde sua habilidade se transforma em <strong className="text-emerald-400 font-bold">dinheiro real na conta</strong>. Entre na arena, enfrente 4 adversários e garanta seu lugar no pódio!
          </p>

          {/* CTA Group */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <Link
              href={user ? '/game' : '/sign-up'}
              className="w-full sm:w-auto px-8 h-16 bg-[#25D366] hover:bg-[#20ba5a] text-black font-lilita text-2xl uppercase tracking-wider rounded-2xl flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(37,211,102,0.4)] active:scale-95 transition-all border-4 border-black"
            >
              <span>🚀 JOGAR AGORA</span>
            </Link>

            <button
              onClick={() => setShowModal(true)}
              className="w-full sm:w-auto px-6 h-16 bg-blue-600/30 hover:bg-blue-600/50 border-2 border-cyan-400 text-white font-bold text-sm uppercase rounded-2xl flex items-center justify-center gap-2 backdrop-blur-md transition-all active:scale-95"
            >
              <span>▶️ COMO FUNCIONA</span>
            </button>
          </div>

          {/* Runners Preview Characters */}
          <div className="mt-12 flex justify-center items-end gap-2 sm:gap-6">
            <div className="flex flex-col items-center">
              <img
                src="/images/character_1_25.webp"
                alt="Robô Azul"
                className="h-28 sm:h-40 w-auto object-contain hover:scale-105 transition-transform drop-shadow-[0_10px_20px_rgba(0,112,243,0.5)]"
              />
              <span className="text-[10px] sm:text-xs font-bold font-luckiest uppercase mt-1 text-cyan-400 stroke-black-1">
                Velocista
              </span>
            </div>
            <div className="flex flex-col items-center scale-110">
              <img
                src="/images/character_2_26.webp"
                alt="Robô Vermelho"
                className="h-32 sm:h-44 w-auto object-contain hover:scale-105 transition-transform drop-shadow-[0_10px_20px_rgba(255,0,0,0.5)]"
              />
              <span className="text-[10px] sm:text-xs font-bold font-luckiest uppercase mt-1 text-red-400 stroke-black-1">
                Campeão
              </span>
            </div>
            <div className="flex flex-col items-center">
              <img
                src="/images/character_3_27.webp"
                alt="Robô Amarelo"
                className="h-28 sm:h-40 w-auto object-contain hover:scale-105 transition-transform drop-shadow-[0_10px_20px_rgba(255,215,0,0.5)]"
              />
              <span className="text-[10px] sm:text-xs font-bold font-luckiest uppercase mt-1 text-yellow-400 stroke-black-1">
                Ágil
              </span>
            </div>
            <div className="flex flex-col items-center">
              <img
                src="/images/character_4_28.webp"
                alt="Robô Verde"
                className="h-28 sm:h-40 w-auto object-contain hover:scale-105 transition-transform drop-shadow-[0_10px_20px_rgba(37,211,102,0.5)]"
              />
              <span className="text-[10px] sm:text-xs font-bold font-luckiest uppercase mt-1 text-emerald-400 stroke-black-1">
                Blindado
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Game Modes */}
      <section className="py-12 px-4 max-w-5xl mx-auto w-full">
        <h2 className="text-2xl sm:text-4xl font-lilita text-center mb-8 uppercase tracking-wide stroke-black-2">
          ESCOLHA SUA PISTA E DISPUTE
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="bg-[#0A3456]/80 border-2 border-cyan-500/40 rounded-2xl p-6 flex flex-col justify-between hover:border-cyan-400 transition-all hover:-translate-y-1 shadow-xl">
            <div>
              <div className="text-xs font-extrabold text-cyan-400 uppercase tracking-widest mb-1">
                MODALIDADE 1
              </div>
              <h3 className="text-2xl font-lilita uppercase mb-2">Pistas Clássicas</h3>
              <p className="text-sm text-white/70 mb-4 font-montserrat">
                O aquecimento ideal para desafiar conhecidos e treinar seus primeiros desvios de obstáculos.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-xs font-bold text-white/60">Entradas: R$ 1 a R$ 10</span>
              <span className="text-sm font-extrabold text-emerald-400">Até 3.5x</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-[#0A3456]/80 border-2 border-[#FEDF19]/60 rounded-2xl p-6 flex flex-col justify-between hover:border-[#FEDF19] transition-all hover:-translate-y-1 shadow-xl relative overflow-hidden">
            <div className="absolute top-2 right-2 bg-[#FEDF19] text-black text-[10px] font-black px-2 py-0.5 rounded">
              POPULAR
            </div>
            <div>
              <div className="text-xs font-extrabold text-[#FEDF19] uppercase tracking-widest mb-1">
                MODALIDADE 2
              </div>
              <h3 className="text-2xl font-lilita uppercase mb-2">Velocidade Avançada</h3>
              <p className="text-sm text-white/70 mb-4 font-montserrat">
                Obstáculos frenéticos projetados para quem já tem bons reflexos e quer disputar prêmios maiores.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-xs font-bold text-white/60">Entradas: R$ 20 a R$ 100</span>
              <span className="text-sm font-extrabold text-[#FEDF19]">Até 3.5x</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-[#0A3456]/80 border-2 border-red-500/50 rounded-2xl p-6 flex flex-col justify-between hover:border-red-400 transition-all hover:-translate-y-1 shadow-xl">
            <div>
              <div className="text-xs font-extrabold text-red-400 uppercase tracking-widest mb-1">
                MODALIDADE 3
              </div>
              <h3 className="text-2xl font-lilita uppercase mb-2">Sobrevivência Extrema</h3>
              <p className="text-sm text-white/70 mb-4 font-montserrat">
                A arena dos campeões High Stakes. Errou um único comando, o seu adversário assume o topo do pódio!
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-xs font-bold text-white/60">Entradas: até R$ 3.000</span>
              <span className="text-sm font-extrabold text-red-400">Até 3.5x</span>
            </div>
          </div>
        </div>
      </section>

      {/* Rules / Highlights */}
      <section className="py-12 bg-gradient-to-b from-[#060D2A] to-[#041d40] px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-4xl font-lilita text-center mb-8 uppercase stroke-black-2 text-[#FEDF19]">
            A REGRA É CLARA: MULTIPLAYER 100% POR HABILIDADE
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-black/30 border border-white/10 p-5 rounded-xl flex items-start gap-4">
              <span className="text-3xl">⏱️</span>
              <div>
                <h4 className="font-bold text-base mb-1">Corrida em Tempo Real</h4>
                <p className="text-xs text-white/70">
                  Esqueça bots ou resultados pré-definidos. Corra sincronizado na mesma pista e prove quem tem os melhores reflexos.
                </p>
              </div>
            </div>

            <div className="bg-black/30 border border-white/10 p-5 rounded-xl flex items-start gap-4">
              <span className="text-3xl">🏆</span>
              <div>
                <h4 className="font-bold text-base mb-1">Pódio que Paga PIX</h4>
                <p className="text-xs text-white/70">
                  Terminou em 1º lugar? Leva 3.5x do valor. 2º lugar leva 1.5x. 3º lugar garante 100% de volta!
                </p>
              </div>
            </div>

            <div className="bg-black/30 border border-white/10 p-5 rounded-xl flex items-start gap-4">
              <span className="text-3xl">💎</span>
              <div>
                <h4 className="font-bold text-base mb-1">Colete Ouro, Rubi e Diamante</h4>
                <p className="text-xs text-white/70">
                  Cada corrida tem gemas espalhadas na pista. Colete todas para trocar por créditos e bônus no seu inventário!
                </p>
              </div>
            </div>

            <div className="bg-black/30 border border-white/10 p-5 rounded-xl flex items-start gap-4">
              <span className="text-3xl">⚡</span>
              <div>
                <h4 className="font-bold text-base mb-1">Saque Rápido via PIX</h4>
                <p className="text-xs text-white/70">
                  Solicitou o saque? A transferência cai via chave PIX na sua conta bancária sem burocracia.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modal Welcome */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-500 rounded-3xl p-6 sm:p-8 text-center text-white border-4 border-black shadow-2xl">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 text-white font-bold flex items-center justify-center transition-colors"
            >
              ✕
            </button>

            <img
              src="/images/arena_clash_45.webp"
              alt="Arena Clash"
              className="w-44 h-auto mx-auto mb-4 drop-shadow-lg"
            />

            <h3 className="text-2xl font-lilita uppercase mb-2 stroke-black-2 tracking-wide">
              BEM-VINDO AO ARENA CLASH!
            </h3>

            <p className="text-xs sm:text-sm text-white/90 mb-6 leading-relaxed">
              Assista o vídeo pra entender como funciona a corrida na pista e entre no nosso grupo VIP do WhatsApp pra receber dicas e torneios exclusivos.
            </p>

            <div className="flex flex-col gap-3">
              <a
                href="https://www.youtube.com/watch?v=uEhMxq7_EJo"
                target="_blank"
                rel="noreferrer"
                className="w-full py-3.5 bg-gradient-to-r from-orange-400 to-yellow-500 hover:brightness-110 font-lilita text-lg uppercase tracking-wider rounded-xl border-2 border-black flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 text-black"
              >
                <span>▶️ ASSISTIR VÍDEO EXPLICATIVO</span>
              </a>

              <a
                href="https://chat.whatsapp.com/LllNTZCHxpT8Z1IYWaemXu"
                target="_blank"
                rel="noreferrer"
                className="w-full py-3.5 bg-[#25D366] hover:bg-[#20ba5a] font-lilita text-lg uppercase tracking-wider rounded-xl border-2 border-black flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 text-black"
              >
                <span>💬 ENTRAR NO GRUPO WHATSAPP</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-auto border-t border-white/10 py-6 px-4 text-center text-xs text-white/50">
        <p>© 2026 Arena Clash. Todos os direitos reservados.</p>
        <p className="mt-1">Plataforma de jogos baseada em habilidade e reflexos. Proibido para menores de 18 anos.</p>
      </footer>
    </div>
  );
}
