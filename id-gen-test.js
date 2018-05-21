const http = require('http');

var counter = 0;
var timestamp = Date.now();

function reqChain(agent) {
    
    var data = ''
    const req = http.request(
        {
            agent: agent,
            hostname: 'localhost',
            port: 8080,
            path: '/api/id/new',
            method: 'POST',
            headers: {
                'Content-Length': 0
            }
        },
        (res) => {
            res.on('data', (chunk) => { data += chunk; });
            if (res.statusCode == 200) {
                res.on('end', () => {
                    console.log(data.trim());
                    counter++;
                    if (0 == (counter % 10000)) {
                        var now = Date.now();
                        console.error(10.0E6 / (now - timestamp) + " req/sec");
                        timestamp = now;
                    }
                    reqChain(agent);
                });
            } else {
                res.on('end', () => {
                    console.error(res.statusCode + "\n" + data.trim());
                });
            }
        });
    
    req.on('error', (e) => {
        console.error('request error: ' + e.message);
    });

    req.write('');
    req.end();
}

var agent = new http.Agent({keepAlive: true});
for (var i = 0; i < 100; i++) {
    reqChain(agent);
}
