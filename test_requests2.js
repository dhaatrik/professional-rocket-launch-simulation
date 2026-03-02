import http from 'http';

function makeRequest(path) {
  return new Promise((resolve) => {
    http.get({ hostname: 'localhost', port: 8080, path }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ path, status: res.statusCode }));
    }).on('error', err => resolve({ path, error: err.message }));
  });
}

async function test() {
  console.log(await makeRequest('/%00/../../etc/passwd'));
  process.exit(0);
}

test();
