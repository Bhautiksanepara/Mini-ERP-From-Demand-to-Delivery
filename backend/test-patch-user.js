const http = require('http');
const app = require('./src/app');
const { signAccessToken } = require('./src/utils/jwt');
const userModel = require('./src/models/user.model');

async function test() {
  const server = http.createServer(app);
  
  server.listen(0, async () => {
    const port = server.address().port;
    const adminUser = await userModel.findByIdWithRoles(12); // adminuser
    const token = signAccessToken(adminUser);

    console.log('Admin token signed.');

    const payload = JSON.stringify({
      full_name: 'Vijay Sharma Edit',
      position: 'Purchase Executive VP',
      role_codes: ['purchase_user', 'inventory_manager']
    });

    const req = http.request({
      hostname: 'localhost',
      port: port,
      path: '/api/users/7', // purch01 (Vijay Sharma)
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('STATUS:', res.statusCode);
        console.log('RESPONSE:', JSON.parse(data));
        server.close();
      });
    });

    req.on('error', (err) => {
      console.error(err);
      server.close();
    });

    req.write(payload);
    req.end();
  });
}

test();
