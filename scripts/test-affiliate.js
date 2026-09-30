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
      res.on('data', d => raw += d);
      res.on('end', () => resolve({
        status: res.statusCode,
        body: JSON.parse(raw || '{}'),
        cookies: res.headers['set-cookie']
      }));
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
      headers: { 'Cookie': cookies }
    }, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw || '{}') }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function testAffiliate() {
  const BASE = 'https://elegant-darwin-mu.vercel.app';
  const phone = '119' + Math.floor(10000000 + Math.random() * 90000000);
  console.log('Registering referral user with sponsor code TCYM9Y...');
  const res = await post(BASE + '/api/auth/register', {
    nome: 'Indicado de Sucesso',
    telefone: phone,
    senha: 'Password123!',
    codigo_indicacao: 'TCYM9Y'
  });
  console.log('Referral Register status:', res.status, res.body);

  const cookieStr = res.cookies ? res.cookies.map(c => c.split(';')[0]).join('; ') : '';
  const affInfo = await get(BASE + '/api/indicacao/info', cookieStr);
  console.log('Affiliate info status:', affInfo.status, affInfo.body);

  const dashInfo = await get(BASE + '/api/user/dashboard', cookieStr);
  console.log('User Dashboard status:', dashInfo.status, dashInfo.body);
}

testAffiliate().catch(console.error);
