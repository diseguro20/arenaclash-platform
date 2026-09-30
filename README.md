# 🏁 Arena Clash - Plataforma Oficial de Jogos de Corrida por Habilidade

Plataforma completa de jogos multiplayer online por habilidade em tempo real, inspirada no Arena Clash.

## 🚀 Tecnologias

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Motor do Jogo**: Canvas HTML5 / WebGL com física de pista 3D em perspectiva, 4 corredores multiplayer, obstáculos e sistema de colisão dinâmico
- **Backend**: Next.js Serverless Routes, Firestore (Google Cloud Firebase Admin SDK)
- **Autenticação**: JWT HttpOnly Cookies (`hw_session`) + bcrypt
- **Gateways de Pagamento**: Vizzion Pay (80%) + Omega Pay (20%) com fallback e reconciliação automática
- **Sistema de Afiliados**: Níveis N1/N2/N3 com 10% de comissão direta no PIX

## 🛠️ Variáveis de Ambiente (.env.local)

```env
# Gateways
VIZZION_PUBLIC_KEY=diseguro20_bbe5bjhaxoz0zcay
VIZZION_SECRET_KEY=p4mgth35kidq4ozvbwnj9qmud1qu5p4mj1pgl80bufkz1nbt5p06s66f8vpwhulx
VIZZION_BASE_URL=https://app.vizzionpay.com.br

OMEGA_PUBLIC_KEY=diseguro20_jfja0nvfswymuvpt
OMEGA_SECRET_KEY=49b376xndh2s4n9h1rc3suzm5tnjgw3s3o26lx4rp94gi0dl5vl338dzal47eur2
OMEGA_BASE_URL=https://app.omegapayments.com.br

# Firebase
FIREBASE_SERVICE_ACCOUNT_JSON=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=saltocash-platform-2026

# Auth
JWT_SECRET=arenaclash_super_secure_jwt_secret_2026_key
ADMIN_MASTER_SECRET=arenaclash_admin_master_secret_2026
```

## 🎮 Mecânica do Jogo

- **Objetivo**: Correr na pista com 4 adversários, desviar de obstáculos (barreiras, caixas e lasers) e cruzar a linha de chegada no menor tempo.
- **Premiação no Pódio**:
  - 🥇 1º Lugar: Multiplicador 3.5x do valor apostado
  - 🥈 2º Lugar: Multiplicador 1.5x do valor apostado
  - 🥉 3º Lugar: Multiplicador 1.0x (devolve valor de entrada)
  - 4º e 5º Lugares: Derrota
- **Modo Influenciador**: Ativação automática no painel admin para garantir vitórias consecutivas em 1º lugar durante transmissões e gravações de vídeos.
