import { NextResponse } from 'next/server';
import { generateCsrf } from '@/lib/auth';

export async function GET() {
  const config = {
    teste_gratis_ativo: true,
    deposito_minimo: 20,
    site_nome: 'Arena Clash',
    site_suporte: 'https://wa.link/5obr8i',
    site_promo: '',
    site_logo_url: '/uploads/site_logo.jpg',
    site_favicon_url: '/uploads/site_favicon.png',
    front_primary_color: '#B80C4C',
    front_secondary_color: '#FFFFFF',
    front_accent_color: '#B80C4C',
    front_background_color: '#000000',
    front_surface_color: '#000000',
    front_topbar_color: '#030C08',
    front_sidebar_color: '#030C08',
    front_footer_color: '#030C08',
    game_background_color: '#023B1B',
    game_platform_color: '#B80C4C',
    game_ball_color: '#FFFFFF',
    game_ui_color: '#023B1B',
    front_background_image_url: '/img/game-bg.png',
    game_killer_floor_color: '#145A32',
    game_pillar_color: '#023B1B',
    game_safe_floor_color: '#C7CCC9',
    game_lose_floor_color: '#062815',
    csrf: generateCsrf(),
  };

  return NextResponse.json(config, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
