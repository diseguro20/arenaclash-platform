const https = require('https');

function post(url, data) {
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
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: JSON.parse(raw || '{}')
        });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function testRegister() {
  const BASE_URL = 'https://elegant-darwin-mu.vercel.app';
  const phone = '119' + Math.floor(10000000 + Math.random() * 90000000);
  console.log(`Testing registration with phone: ${phone}...`);
  const res = await post(`${BASE_URL}/api/auth/register`, {
    nome: 'Novo Jogador Arena',
    telefone: phone,
    senha: 'SenhaSegura123!'
  });
  console.log('Registration response status:', res.statusCode);
  console.log('Registration response body:', res.body);
}

testRegister().catch(console.error);
