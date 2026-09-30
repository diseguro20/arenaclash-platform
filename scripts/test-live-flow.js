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
        const setCookie = res.headers['set-cookie'] || [];
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          setCookie,
          body: raw
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
          body: raw
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTest() {
  const BASE_URL = 'https://elegant-darwin-mu.vercel.app';
  console.log('--- 1. Testing Registration on Live Vercel ---');
  const phoneSuffix = Math.floor(10000000 + Math.random() * 90000000);
  const telefone = `119${phoneSuffix}`;
  const regRes = await post(`${BASE_URL}/api/auth/register`, {
    nome: 'Piloto Arena Original',
    telefone,
    senha: 'Password123!'
  });

  console.log('Registration Status:', regRes.statusCode);
  console.log('Registration Body:', regRes.body);

  let cookies = '';
  if (regRes.setCookie && regRes.setCookie.length > 0) {
    cookies = regRes.setCookie.map(c => c.split(';')[0]).join('; ');
  }

  console.log('\n--- 2. Testing /api/auth/me with Auth Cookie ---');
  const meRes = await get(`${BASE_URL}/api/auth/me`, cookies);
  console.log('Me Status:', meRes.statusCode);
  console.log('Me Body:', meRes.body);

  console.log('\n--- 3. Testing Deposit Generation (Vizzion/Omega Gateway Split) ---');
  const depRes = await post(`${BASE_URL}/api/financeiro/deposito`, {
    valor: 30
  }, cookies);
  console.log('Deposit Status:', depRes.statusCode);
  console.log('Deposit Body:', depRes.body);

  console.log('\n--- 4. Testing Game Start Session ---');
  const gameStartRes = await post(`${BASE_URL}/api/game/iniciar`, {
    aposta: 5,
    tipo_moeda: 'ouro'
  }, cookies);
  console.log('Game Start Status:', gameStartRes.statusCode);
  console.log('Game Start Body:', gameStartRes.body);

  if (gameStartRes.statusCode === 200) {
    const startData = JSON.parse(gameStartRes.body);
    const corridaId = startData.corrida_id;

    console.log('\n--- 5. Testing Game Finish (1st Place Victory: 3.5x payout) ---');
    const finishRes = await post(`${BASE_URL}/api/game/finalizar`, {
      corrida_id: corridaId,
      posicao_final: 1,
      moedas_coletadas: 15,
      rubis_coletados: 2,
      diamantes_coletados: 1,
      distancia_percorrida: 1250,
      tempo_total: 42
    }, cookies);
    console.log('Game Finish Status:', finishRes.statusCode);
    console.log('Game Finish Body:', finishRes.body);
  }

  console.log('\n--- 6. Verifying Updated User HUD/Balances ---');
  const meUpdated = await get(`${BASE_URL}/api/auth/me`, cookies);
  console.log('Updated Me Status:', meUpdated.statusCode);
  console.log('Updated Me Body:', meUpdated.body);
}

runTest().catch(console.error);
