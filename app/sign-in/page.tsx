'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignInPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefone: identifier,
          senha: password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao entrar na conta.');
      }

      // Store in localStorage if needed and redirect to profile
      if (data.user) {
        localStorage.setItem('arena_user', JSON.stringify(data.user));
      }
      router.push('/profile/me');
    } catch (err: any) {
      setError(err.message || 'Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#060D2A] flex flex-col justify-center items-center px-4 overflow-hidden">
      {/* Background Graphic */}
      <div className="absolute inset-0 z-0 opacity-40">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/bg_103.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060D2A] via-[#060D2A]/80 to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        {/* Logo */}
        <Link href="/" className="mb-4 transition-transform hover:scale-105">
          <img
            src="/images/arena_clash_45.webp"
            alt="Arena Clash"
            className="w-56 h-auto drop-shadow-[0px_10px_25px_rgba(0,0,0,0.6)]"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </Link>

        {/* Title */}
        <h1
          className="text-4xl sm:text-5xl text-white uppercase text-center mb-1 font-lilita stroke-black-2 tracking-wider"
        >
          ENTRAR
        </h1>
        <p className="text-white/80 text-sm text-center mb-6 font-montserrat">
          Acesse seu perfil e volte direto para a pista.
        </p>

        {error && (
          <div className="w-full mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-xs font-semibold text-center animate-shake">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="TELEFONE OU EMAIL"
              className="w-full px-4 py-3 bg-black/40 border border-white/20 rounded-lg text-white font-bold placeholder:text-white/60 placeholder:font-medium text-sm focus:outline-none focus:border-[#de9612] transition-colors"
            />
          </div>

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="SENHA"
              className="w-full px-4 py-3 bg-black/40 border border-white/20 rounded-lg text-white font-bold placeholder:text-white/60 placeholder:font-medium text-sm focus:outline-none focus:border-[#de9612] transition-colors pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-xs font-bold px-1"
            >
              {showPassword ? 'OCULTAR' : 'VER'}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 mt-2 border-4 border-black bg-[#de9612] hover:bg-[#e8a31e] rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(222,150,18,0.3)] active:scale-95 transition-all disabled:opacity-50"
          >
            <span
              className="text-white uppercase font-lilita text-xl tracking-widest stroke-black-4"
            >
              {loading ? 'ENTRANDO...' : 'ENTRAR AGORA'}
            </span>
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/90">
          Não possui uma conta?{' '}
          <Link href="/sign-up" className="font-bold text-[#FEDF19] hover:underline">
            Registre-se
          </Link>
        </p>

        <div className="mt-4">
          <Link href="/" className="text-xs text-white/50 hover:text-white transition-colors">
            ← Voltar para o início
          </Link>
        </div>
      </div>
    </div>
  );
}
