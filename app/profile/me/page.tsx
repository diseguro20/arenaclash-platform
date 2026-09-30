'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ProfileMePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'afiliado' | 'ranking' | 'saques' | 'depositos' | 'corridas'>('overview');
  const [rankingTab, setRankingTab] = useState<'semanal' | 'mensal'>('semanal');
  const [rankingData, setRankingData] = useState<any[]>([]);

  // Modals
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Deposit state
  const [depositAmount, setDepositAmount] = useState('30');
  const [depositCpf, setDepositCpf] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositPixData, setDepositPixData] = useState<any>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  // Withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState('20');
  const [withdrawKey, setWithdrawKey] = useState('');
  const [withdrawKeyType, setWithdrawKeyType] = useState('cpf');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState('');

  // Affiliate state
  const [affiliateData, setAffiliateData] = useState<any>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // History state
  const [historyDeposits, setHistoryDeposits] = useState<any[]>([]);
  const [historyWithdrawals, setHistoryWithdrawals] = useState<any[]>([]);
  const [historyRaces, setHistoryRaces] = useState<any[]>([]);

  const fetchUserData = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) {
        router.push('/sign-in');
        return;
      }
      const data = await res.json();
      setUser(data.user);
      if (data.user?.cpf) setDepositCpf(data.user.cpf);
    } catch {
      router.push('/sign-in');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  useEffect(() => {
    if (activeTab === 'ranking') {
      fetch(`/api/public/ranking?tipo=${rankingTab}`)
        .then((res) => res.json())
        .then((data) => setRankingData(data.ranking || []))
        .catch(() => {});
    } else if (activeTab === 'afiliado') {
      fetch('/api/indicacao/info')
        .then((res) => res.json())
        .then((data) => setAffiliateData(data))
        .catch(() => {});
    } else if (activeTab === 'depositos') {
      fetch('/api/financeiro/historico')
        .then((res) => res.json())
        .then((data) => setHistoryDeposits(data.depositos || []))
        .catch(() => {});
    } else if (activeTab === 'saques') {
      fetch('/api/financeiro/meus-saques')
        .then((res) => res.json())
        .then((data) => setHistoryWithdrawals(data.saques || []))
        .catch(() => {});
    }
  }, [activeTab, rankingTab]);

  const handleCreateDeposit = async () => {
    const val = Number(depositAmount);
    if (isNaN(val) || val < 10) {
      alert('Valor mínimo para depósito é R$ 10,00.');
      return;
    }

    setDepositLoading(true);
    try {
      const res = await fetch('/api/financeiro/deposito', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor: val, cpf: depositCpf }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar PIX.');
      setDepositPixData(data);
    } catch (err: any) {
      alert(err.message || 'Erro ao gerar pagamento.');
    } finally {
      setDepositLoading(false);
    }
  };

  const handleCreateWithdraw = async () => {
    const val = Number(withdrawAmount);
    if (isNaN(val) || val < 20) {
      alert('Valor mínimo para saque é R$ 20,00.');
      return;
    }
    if (!withdrawKey.trim()) {
      alert('Informe a chave PIX.');
      return;
    }

    setWithdrawLoading(true);
    setWithdrawMsg('');
    try {
      const res = await fetch('/api/financeiro/saque', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valor: val,
          chave_pix: withdrawKey,
          pix_type: withdrawKeyType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao solicitar saque.');
      setWithdrawMsg(data.message || 'Saque processado com sucesso!');
      fetchUserData();
    } catch (err: any) {
      alert(err.message || 'Erro ao processar saque.');
    } finally {
      setWithdrawLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: 'pix' | 'link') => {
    navigator.clipboard.writeText(text);
    if (type === 'pix') {
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060D2A] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-[#FEDF19] border-t-transparent rounded-full animate-spin" />
          <p className="font-lilita text-lg uppercase tracking-wider text-[#FEDF19]">Carregando Arena...</p>
        </div>
      </div>
    );
  }

  const userName = user?.nome || 'DIEGO SEGURO';
  const initial = userName[0].toUpperCase();

  return (
    <div className="min-h-screen bg-[#060D2A] text-white flex flex-col selection:bg-[#FEDF19] selection:text-black">
      {/* Top Header with User Info & Currency */}
      <header className="sticky top-0 z-40 bg-gradient-to-b from-[#060D2A] to-[#0A3456]/90 backdrop-blur-md border-b border-white/10 px-4 md:px-8 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* User Avatar + Name + Level Bar */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 border-2 border-white flex items-center justify-center font-lilita text-xl text-white shadow-md">
                {initial}
              </div>
            </div>

            <div className="flex flex-col">
              <span className="font-luckiest text-sm sm:text-base uppercase tracking-wider stroke-black-2 text-white">
                {userName}
              </span>
              {/* Progress Bar */}
              <div className="relative overflow-hidden rounded-full border border-white/60 bg-[#060D2A] h-2.5 w-32 sm:w-44 mt-0.5 shadow-inner">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full transition-all duration-500"
                  style={{ width: '65%' }}
                />
              </div>
            </div>
          </div>

          {/* Currencies (Ouro, Rubi, Diamante) & Saldo Real */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Ouro */}
            <div className="flex items-center gap-1 bg-black/40 border border-yellow-500/40 px-2 py-1 rounded-lg">
              <img src="/images/asset_7.svg" alt="Ouro" className="w-5 h-5 object-contain" />
              <span className="font-luckiest text-xs text-yellow-400 stroke-black-1">
                {user?.saldo_ouro || 0}
              </span>
            </div>

            {/* Rubi */}
            <div className="flex items-center gap-1 bg-black/40 border border-red-500/40 px-2 py-1 rounded-lg">
              <img src="/images/asset_8.svg" alt="Rubi" className="w-5 h-5 object-contain" />
              <span className="font-luckiest text-xs text-red-400 stroke-black-1">
                {user?.saldo_rubi || 0}
              </span>
            </div>

            {/* Diamante */}
            <div className="flex items-center gap-1 bg-black/40 border border-blue-500/40 px-2 py-1 rounded-lg">
              <img src="/images/asset_9.svg" alt="Diamante" className="w-5 h-5 object-contain" />
              <span className="font-luckiest text-xs text-cyan-400 stroke-black-1">
                {user?.saldo_diamante || 0}
              </span>
            </div>

            {/* Saldo Real em Dinheiro */}
            <div className="hidden sm:flex items-center gap-2 bg-[#053064] border border-[#FEDF19]/60 px-3 py-1 rounded-xl shadow-md">
              <span className="text-[10px] text-white/60 font-bold uppercase">SALDO:</span>
              <span className="font-lilita text-base text-[#FEDF19] stroke-black-1">
                R$ {Number(user?.saldo || 0).toFixed(2)}
              </span>
            </div>

            {/* Action Buttons: Depósito & Saque */}
            <button
              onClick={() => {
                setDepositPixData(null);
                setShowDepositModal(true);
              }}
              className="px-3 py-1.5 bg-[#25D366] hover:bg-[#20ba5a] text-black font-lilita text-xs uppercase rounded-lg border border-black shadow active:scale-95 transition-all"
            >
              + DEPOSITAR
            </button>
            <button
              onClick={() => setShowWithdrawModal(true)}
              className="hidden sm:block px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-lilita text-xs uppercase rounded-lg border border-black shadow active:scale-95 transition-all"
            >
              SACAR
            </button>
          </div>
        </div>
      </header>

      {/* Main Tabs Navigation */}
      <nav className="bg-[#053064] border-b border-black overflow-x-auto">
        <div className="max-w-6xl mx-auto flex items-center gap-1 px-4 py-2">
          {[
            { id: 'overview', label: 'Visão Geral', icon: '🏎️' },
            { id: 'afiliado', label: 'Afiliado', icon: '🤝' },
            { id: 'ranking', label: 'Ranking', icon: '🏆' },
            { id: 'saques', label: 'Saques', icon: '💸' },
            { id: 'depositos', label: 'Depósitos', icon: '💳' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl font-luckiest text-xs uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white border border-white/40 shadow-lg scale-105 stroke-black-1'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Content Body */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-6 pb-24">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Play CTA Banner */}
            <div className="relative rounded-3xl overflow-hidden p-6 sm:p-8 bg-gradient-to-r from-blue-700 via-indigo-800 to-cyan-700 border-4 border-black shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex flex-col items-center md:items-start text-center md:text-left z-10">
                <span className="bg-[#FEDF19] text-black text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider mb-2">
                  Multiplayer Ao Vivo
                </span>
                <h2 className="text-3xl sm:text-5xl font-lilita uppercase tracking-wide stroke-black-4 text-[#FEDF19] drop-shadow-lg">
                  PRONTO PARA CORRER?
                </h2>
                <p className="text-sm text-white/90 max-w-md mt-1">
                  Enfrente 4 pilotos na pista, desvie de obstáculos e garanta até 3.5x da sua aposta no PIX!
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-emerald-300">
                  <span>💰 Saldo Disponível:</span>
                  <span className="font-extrabold text-[#FEDF19] text-sm">
                    R$ {Number(user?.saldo || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Huge Play Button */}
              <div className="z-10 flex flex-col items-center gap-2 w-full md:w-auto">
                <Link
                  href="/game"
                  className="w-full md:w-64 h-16 bg-[#25D366] hover:bg-[#20ba5a] text-black font-lilita text-2xl uppercase tracking-widest rounded-2xl border-4 border-black flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(37,211,102,0.4)] active:scale-95 transition-all"
                >
                  <span>🕹️ JOGAR AGORA</span>
                </Link>
                <span className="text-[11px] text-white/70">Partidas 1v1 e salas multiplayer</span>
              </div>
            </div>

            {/* Placement Records (1º, 2º, 3º Lugares) */}
            <div className="grid grid-cols-3 gap-3 sm:gap-6">
              <div className="bg-[#0A3456]/80 border-2 border-yellow-500/50 rounded-2xl p-4 flex flex-col items-center text-center shadow-lg">
                <img src="/images/1_33.svg" alt="1º Lugar" className="w-14 sm:w-20 h-auto object-contain mb-1" />
                <span className="text-2xl sm:text-4xl font-luckiest text-[#FFD700] stroke-black-3">
                  {user?.vitorias_1 || 0}
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-white/80 uppercase font-luckiest tracking-wider mt-1">
                  1° LUGARES
                </span>
              </div>

              <div className="bg-[#0A3456]/80 border-2 border-slate-300/50 rounded-2xl p-4 flex flex-col items-center text-center shadow-lg">
                <img src="/images/2_34.svg" alt="2º Lugar" className="w-14 sm:w-20 h-auto object-contain mb-1" />
                <span className="text-2xl sm:text-4xl font-luckiest text-slate-200 stroke-black-3">
                  {user?.vitorias_2 || 0}
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-white/80 uppercase font-luckiest tracking-wider mt-1">
                  2° LUGARES
                </span>
              </div>

              <div className="bg-[#0A3456]/80 border-2 border-amber-600/50 rounded-2xl p-4 flex flex-col items-center text-center shadow-lg">
                <img src="/images/3_35.svg" alt="3º Lugar" className="w-14 sm:w-20 h-auto object-contain mb-1" />
                <span className="text-2xl sm:text-4xl font-luckiest text-amber-500 stroke-black-3">
                  {user?.vitorias_3 || 0}
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-white/80 uppercase font-luckiest tracking-wider mt-1">
                  3° LUGARES
                </span>
              </div>
            </div>

            {/* Quick Actions (Depositar / Sacar / WhatsApp) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-black/30 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <h4 className="font-lilita text-lg uppercase text-[#FEDF19]">Recarregar Saldo</h4>
                  <p className="text-xs text-white/70">Depósito PIX instantâneo com bônus de boas-vindas.</p>
                </div>
                <button
                  onClick={() => setShowDepositModal(true)}
                  className="px-4 py-2 bg-[#25D366] text-black font-lilita text-sm uppercase rounded-xl border-2 border-black"
                >
                  DEPOSITAR
                </button>
              </div>

              <div className="bg-black/30 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <h4 className="font-lilita text-lg uppercase text-cyan-400">Resgatar Ganhos</h4>
                  <p className="text-xs text-white/70">Saques via PIX direto para sua conta bancária.</p>
                </div>
                <button
                  onClick={() => setShowWithdrawModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white font-lilita text-sm uppercase rounded-xl border-2 border-black"
                >
                  SACAR
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AFILIADO TAB */}
        {activeTab === 'afiliado' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-[#053064] to-[#0A3456] border-2 border-white/20 rounded-3xl p-6 sm:p-8">
              <span className="text-xs font-black text-[#FEDF19] uppercase tracking-wider bg-black/40 px-3 py-1 rounded-full">
                Programa de Indicação Arena
              </span>
              <h3 className="text-2xl sm:text-4xl font-lilita uppercase tracking-wide stroke-black-2 mt-3 mb-2">
                GANHE ATÉ 10% EM TODOS OS DEPÓSITOS!
              </h3>
              <p className="text-xs sm:text-sm text-white/80 max-w-xl mb-6">
                Envie seu link exclusivo para seus amigos. Toda vez que eles depositarem e correrem, você recebe comissão direto no seu saldo de afiliado para sacar via PIX!
              </p>

              {/* Referral Link Box */}
              <div className="bg-black/50 border border-white/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex flex-col w-full overflow-hidden text-left">
                  <span className="text-[10px] text-white/60 font-bold uppercase">SEU LINK EXCLUSIVO:</span>
                  <span className="font-mono text-xs sm:text-sm text-[#FEDF19] truncate font-bold">
                    {affiliateData?.link || `https://arenaclash.com.br/#cadastro?ref=${user?.codigo_convite}`}
                  </span>
                </div>
                <button
                  onClick={() => copyToClipboard(affiliateData?.link || `https://arenaclash.com.br/#cadastro?ref=${user?.codigo_convite}`, 'link')}
                  className="w-full sm:w-auto px-6 py-2.5 bg-[#FEDF19] hover:bg-yellow-400 text-black font-lilita text-sm uppercase rounded-xl border-2 border-black whitespace-nowrap"
                >
                  {copiedLink ? '✓ COPIADO!' : 'COPIAR LINK'}
                </button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                <div className="bg-black/30 p-4 rounded-xl border border-white/10 text-center">
                  <span className="text-xs text-white/60 font-bold uppercase">Saldo Afiliado</span>
                  <p className="text-xl font-lilita text-emerald-400 mt-1">
                    R$ {Number(affiliateData?.saldo_afiliado || user?.saldo_afiliado || 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-black/30 p-4 rounded-xl border border-white/10 text-center">
                  <span className="text-xs text-white/60 font-bold uppercase">Total Indicados</span>
                  <p className="text-xl font-lilita text-white mt-1">
                    {affiliateData?.total_indicados || 0}
                  </p>
                </div>
                <div className="bg-black/30 p-4 rounded-xl border border-white/10 text-center">
                  <span className="text-xs text-white/60 font-bold uppercase">Nível 1 (10%)</span>
                  <p className="text-xl font-lilita text-cyan-400 mt-1">
                    {affiliateData?.indicados_n1 || 0}
                  </p>
                </div>
                <div className="bg-black/30 p-4 rounded-xl border border-white/10 text-center">
                  <span className="text-xs text-white/60 font-bold uppercase">Comissão Total</span>
                  <p className="text-xl font-lilita text-[#FEDF19] mt-1">
                    R$ {Number(user?.total_comissao || 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RANKING TAB */}
        {activeTab === 'ranking' && (
          <div className="space-y-4">
            <div className="flex justify-center gap-2 bg-[#053064] p-1.5 rounded-2xl border border-black max-w-sm mx-auto">
              <button
                onClick={() => setRankingTab('semanal')}
                className={`flex-1 py-2 font-luckiest text-xs uppercase rounded-xl transition-all ${
                  rankingTab === 'semanal' ? 'bg-[#FEDF19] text-black' : 'text-white/70 hover:text-white'
                }`}
              >
                Ranking Semanal
              </button>
              <button
                onClick={() => setRankingTab('mensal')}
                className={`flex-1 py-2 font-luckiest text-xs uppercase rounded-xl transition-all ${
                  rankingTab === 'mensal' ? 'bg-[#FEDF19] text-black' : 'text-white/70 hover:text-white'
                }`}
              >
                Ranking Mensal
              </button>
            </div>

            <div className="space-y-2">
              {rankingData.map((item, idx) => (
                <div
                  key={idx}
                  className={`grid grid-cols-[auto_1fr_auto] items-center p-3 rounded-2xl border border-black ${
                    idx === 0
                      ? 'bg-[#FDBD0F] text-black'
                      : idx === 1
                      ? 'bg-slate-300 text-black'
                      : idx === 2
                      ? 'bg-amber-700/80 text-white'
                      : 'bg-[#0A3456] text-white'
                  }`}
                >
                  <div className="w-10 font-luckiest text-xl text-center">
                    {item.posicao}º
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center font-lilita text-lg">
                      {item.avatar}
                    </div>
                    <span className="font-luckiest text-sm sm:text-base uppercase tracking-wider">
                      {item.nome}
                    </span>
                  </div>
                  <div className="font-luckiest text-base sm:text-xl pr-3">
                    {item.pontos} <span className="text-xs">PTS</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DEPOSITOS TAB */}
        {activeTab === 'depositos' && (
          <div className="space-y-4">
            <h3 className="font-lilita text-xl uppercase text-[#FEDF19]">Histórico de Depósitos</h3>
            {historyDeposits.length === 0 ? (
              <div className="bg-black/30 p-8 rounded-2xl text-center text-white/60 text-sm">
                Nenhum depósito registrado ainda.
              </div>
            ) : (
              <div className="space-y-2">
                {historyDeposits.map((d, i) => (
                  <div key={i} className="bg-black/40 p-4 rounded-xl border border-white/10 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-emerald-400">R$ {Number(d.amount).toFixed(2)}</span>
                      <p className="text-xs text-white/50">{d.created_at || 'Recente'}</p>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${d.status === 'aprovado' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                      {d.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SAQUES TAB */}
        {activeTab === 'saques' && (
          <div className="space-y-4">
            <h3 className="font-lilita text-xl uppercase text-cyan-400">Histórico de Saques</h3>
            {historyWithdrawals.length === 0 ? (
              <div className="bg-black/30 p-8 rounded-2xl text-center text-white/60 text-sm">
                Nenhum saque solicitado ainda.
              </div>
            ) : (
              <div className="space-y-2">
                {historyWithdrawals.map((w, i) => (
                  <div key={i} className="bg-black/40 p-4 rounded-xl border border-white/10 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-cyan-400">R$ {Number(w.valor).toFixed(2)}</span>
                      <p className="text-xs text-white/50">Chave: {w.chave_pix}</p>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${w.status === 'aprovado' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                      {w.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* DEPOSIT MODAL */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-[#0A3456] rounded-3xl p-6 text-white border-4 border-black shadow-2xl">
            <button
              onClick={() => setShowDepositModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/40 text-white font-bold flex items-center justify-center"
            >
              ✕
            </button>

            <h3 className="text-2xl font-lilita uppercase text-[#FEDF19] stroke-black-2 mb-1">
              DEPÓSITO VIA PIX
            </h3>
            <p className="text-xs text-white/70 mb-4 font-montserrat">
              Crédito cai automaticamente na sua conta em segundos.
            </p>

            {!depositPixData ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-white/80 block mb-1">
                    Valor do Depósito (R$):
                  </label>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {['20', '30', '50', '100'].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setDepositAmount(val)}
                        className={`py-2 rounded-lg font-lilita text-sm uppercase border-2 transition-all ${
                          depositAmount === val
                            ? 'bg-[#FEDF19] text-black border-black scale-105'
                            : 'bg-black/30 text-white border-white/20'
                        }`}
                      >
                        R$ {val}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/20 rounded-lg text-white font-bold text-sm focus:outline-none focus:border-[#FEDF19]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-white/80 block mb-1">
                    CPF do Titular:
                  </label>
                  <input
                    type="text"
                    value={depositCpf}
                    onChange={(e) => setDepositCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/20 rounded-lg text-white font-bold text-sm focus:outline-none focus:border-[#FEDF19]"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleCreateDeposit}
                  disabled={depositLoading}
                  className="w-full h-14 bg-[#25D366] hover:bg-[#20ba5a] text-black font-lilita text-xl uppercase tracking-wider rounded-xl border-3 border-black flex items-center justify-center shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {depositLoading ? 'GERANDO PIX...' : 'GERAR QR CODE PIX'}
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <div className="bg-white p-3 rounded-2xl w-48 h-48 mx-auto flex items-center justify-center shadow-lg">
                  <img
                    src={depositPixData.qrcode_imagem}
                    alt="QR Code Pix"
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="text-xs font-bold text-white/80">
                  Valor: <span className="text-[#FEDF19] font-extrabold text-sm">R$ {Number(depositPixData.valor).toFixed(2)}</span>
                </div>

                <button
                  onClick={() => copyToClipboard(depositPixData.qrcode_texto, 'pix')}
                  className="w-full py-3 bg-[#FEDF19] hover:bg-yellow-400 text-black font-lilita text-base uppercase rounded-xl border-2 border-black flex items-center justify-center gap-2"
                >
                  {copiedPix ? '✓ CÓDIGO PIX COPIADO!' : 'COPIAR CÓDIGO PIX'}
                </button>

                <p className="text-[11px] text-white/60">
                  Abra o aplicativo do seu banco, escolha <strong>Pix Copia e Cola</strong> e conclua o pagamento.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* WITHDRAW MODAL */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-[#0A3456] rounded-3xl p-6 text-white border-4 border-black shadow-2xl">
            <button
              onClick={() => setShowWithdrawModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/40 text-white font-bold flex items-center justify-center"
            >
              ✕
            </button>

            <h3 className="text-2xl font-lilita uppercase text-cyan-400 stroke-black-2 mb-1">
              SOLICITAR SAQUE PIX
            </h3>
            <p className="text-xs text-white/70 mb-4 font-montserrat">
              Saldo disponível: <strong className="text-[#FEDF19]">R$ {Number(user?.saldo || 0).toFixed(2)}</strong>
            </p>

            {withdrawMsg ? (
              <div className="p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-emerald-300 text-center text-sm font-bold">
                {withdrawMsg}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-white/80 block mb-1">
                    Valor do Saque (R$):
                  </label>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/20 rounded-lg text-white font-bold text-sm focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-white/80 block mb-1">
                    Tipo de Chave:
                  </label>
                  <select
                    value={withdrawKeyType}
                    onChange={(e) => setWithdrawKeyType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/20 rounded-lg text-white font-bold text-sm focus:outline-none"
                  >
                    <option value="cpf">CPF</option>
                    <option value="phone">Telefone / Celular</option>
                    <option value="email">E-mail</option>
                    <option value="random">Chave Aleatória (EVP)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-white/80 block mb-1">
                    Chave PIX:
                  </label>
                  <input
                    type="text"
                    value={withdrawKey}
                    onChange={(e) => setWithdrawKey(e.target.value)}
                    placeholder="Sua chave PIX"
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/20 rounded-lg text-white font-bold text-sm focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleCreateWithdraw}
                  disabled={withdrawLoading}
                  className="w-full h-14 bg-cyan-500 hover:bg-cyan-400 text-black font-lilita text-xl uppercase tracking-wider rounded-xl border-3 border-black flex items-center justify-center shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {withdrawLoading ? 'ENVIANDO SAQUE...' : 'CONFIRMAR SAQUE'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
