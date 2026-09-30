import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://arenaclash-platform.vercel.app'),
  title: 'Arena Clash - Aqui, sua habilidade vale prêmios!',
  description: 'O multiplayer de corrida com obstáculos onde sua habilidade se transforma em dinheiro real na conta. Entre na arena, enfrente 4 adversários e garanta seu lugar no pódio!',
  applicationName: 'Arena Clash',
  keywords: ['Arena Clash', 'jogos', 'habilidade', 'prêmios', 'corrida', 'obstáculos', 'multiplayer'],
  icons: {
    icon: '/images/asset_1.ico',
    shortcut: '/images/asset_3.png',
    apple: '/images/asset_4.png',
  },
  openGraph: {
    title: 'Arena Clash - Aqui, sua habilidade vale prêmios!',
    description: 'O multiplayer de corrida com obstáculos onde sua habilidade se transforma em dinheiro real na conta.',
    url: 'https://arenaclash.com.br',
    siteName: 'Arena Clash',
    images: [{ url: '/images/asset_64.webp', width: 1200, height: 630 }],
    locale: 'pt_BR',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark notranslate scheme-only-dark" translate="no">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Lilita+One&family=Luckiest+Guy&family=Montserrat:wght@400;600;700;800;900&family=Inter:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen bg-[#060D2A] text-white">
        {children}
      </body>
    </html>
  );
}
