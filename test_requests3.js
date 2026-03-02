import http from 'http';

function makeRequest(path) {
  return new Promise((resolve) => {
    http.get({ hostname: 'localhost', port: 8080, path }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ path, status: res.statusCode, data }));
    }).on('error', err => resolve({ path, error: err.message }));
  });
}

async function test() {
  console.log(await makeRequest('/%c0%ae%c0%ae/')); // Overlong encoded dot
  console.log(await makeRequest('/%'));
  process.exit(0);
}

test();
