const https = require('https');

function post(url, data, cookies = '') {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = JSON.stringify(data);
    const req = https.request({
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Cookie': cookies
      }
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          setCookie: res.headers['set-cookie'] || [],
          body: JSON.parse(raw || '{}')
        });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function get(url, cookies = '') {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        'Cookie': cookies
      }
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: JSON.parse(raw || '{}')
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function verifyDiego() {
  const BASE_URL = 'https://elegant-darwin-mu.vercel.app';
  console.log('Testing Login with Diego account: 11982854183 / diego2001...');
  
  const loginRes = await post(`${BASE_URL}/api/auth/login`, {
    telefone: '11982854183',
    senha: 'diego2001'
  });

  console.log('Login Status:', loginRes.statusCode);
  console.log('Login User Data:', loginRes.body);

  const cookies = loginRes.setCookie.map(c => c.split(';')[0]).join('; ');

  console.log('\nTesting /api/auth/me for Diego...');
  const meRes = await get(`${BASE_URL}/api/auth/me`, cookies);
  console.log('Diego /api/auth/me:', meRes.body);

  console.log('\nTesting Dashboard for Diego...');
  const dashRes = await get(`${BASE_URL}/api/user/dashboard`, cookies);
  console.log('Diego Dashboard:', dashRes.body);

  console.log('\nTesting starting a race with R$ 10 bet from Diego\'s balance...');
  const raceStart = await post(`${BASE_URL}/api/game/iniciar`, {
    valor_entrada: 10,
    modalidade: 'classica',
    personagem: 1
  }, cookies);
  console.log('Race Start:', raceStart.body);

  if (raceStart.statusCode === 200) {
    const corridaId = raceStart.body.corrida_id;
    console.log('\nTesting finishing race (1st place 3.5x = R$ 35,00)...');
    const finishRes = await post(`${BASE_URL}/api/game/finalizar`, {
      corrida_id: corridaId,
      posicao: 1,
      ouro_coletado: 25,
      rubi_coletado: 5,
      diamante_coletado: 2
    }, cookies);
    console.log('Race Finish:', finishRes.body);

    const meAfter = await get(`${BASE_URL}/api/auth/me`, cookies);
    console.log('\nDiego Balances after 1st place win:', {
      saldo: meAfter.body.user?.saldo,
      ouro: meAfter.body.user?.saldo_ouro,
      rubi: meAfter.body.user?.saldo_rubi,
      diamante: meAfter.body.user?.saldo_diamante,
      is_admin: meAfter.body.user?.is_admin
    });
  }
}

verifyDiego().catch(console.error);
