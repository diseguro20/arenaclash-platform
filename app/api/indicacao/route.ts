import { NextRequest } from 'next/server';
import { GET as getInfo } from './info/route';

export async function GET(req: NextRequest) {
  return getInfo(req);
}
