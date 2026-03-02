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
  console.log(await makeRequest('/test%00.html'));
  console.log(await makeRequest('/%00/../../etc/passwd'));
  console.log(await makeRequest('/%2e%2e/%2e%2e/etc/passwd'));
  console.log(await makeRequest('/%'));
  console.log(await makeRequest('/%c0%ae%c0%ae/'));
  process.exit(0);
}

test();
