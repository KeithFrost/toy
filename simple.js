#!/usr/bin/env nodejs

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const bodyParser = require('body-parser');

const mmap = require('mmap-io');
const idmap_size = 128 * 1024 * 1024;
const idmap_mask = idmap_size - 1;
var idmap_fd = fs.openSync('ids.map', 'r+');
var idbuffer = mmap.map(
    idmap_size, mmap.PROT_WRITE, mmap.MAP_SHARED, idmap_fd);
fs.closeSync(idmap_fd);
var id_offset = (Math.random() * idmap_size) | 0;

const base32s = '0123456789abcdefghjkmnpqrstvwxyz';
const base32h = {
    '0':0, '1':1, '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9,
    'a':10, 'b':11, 'c':12, 'd':13, 'e':14, 'f':15, 'g':16, 'h':17, 'j':18,
    'k':19, 'm':20, 'n':21, 'p':22, 'q':23, 'r':24, 's':25, 't':26, 'v':27,
    'w':28, 'x':29, 'y':30, 'z':31
}

const id_regex = /^[0-9abcdefghjkmnpqrstvwxyz]{6}$/;

function encode_id(id) {
    var s = '';
    for (var b = 25; b >= 0; b -= 5) {
        s += base32s[(id >> b) & 31];
    }
    return s;
}

function decode_id(id_s) {
    var id = 0;
    for (var i = 0; i < 6; i++) {
        id |= base32h[id_s[i]] << (25 - i * 5);
    }
    return id;
}

const bit17 = 1 << 17;
const mask17 = bit17 - 1;
const bit13 = 1 << 13;
const mask13 = bit13 - 1;
const mask30 = (1 << 30) - 1;
var tidCounter = (Math.random() * bit17) & mask17;
function newTid() {
    const timestamp = Date.now();
    const msb30 = (timestamp / bit13) & mask30;
    const time13 = timestamp & mask13;
    tidCounter = (tidCounter + 1) & mask17;
    const lsb30 = (time13 << 17) | tidCounter;
    return encode_id(msb30) + '-' + encode_id(lsb30);
}

function newId() {
    const timestamp = Date.now();
    var id = -1;
    var tries = 0;
    while (id == -1 && tries < 25) {
        id_offset++;
        var index = (id_offset + timestamp) & idmap_mask;
        var x = idbuffer[index];
        if (x < 255) {
            var b0 = (id_offset ^ (id_offset >> 3)) & 7;
            for (var b = 0; b < 8; b++) {
                var bn = (b + b0) & 7;
                var bit = 1 << bn;
                if (0 == (bit & x)) {
                    idbuffer[index] |= bit;
                    id = (index << 3) | bn;
                    break;
                }
            }
        } else {
            tries++;
            id_offset += idmap_mask & ((1 + Math.random()) * (1 << tries));
        }
    }
    return id;
}

function isId(id) {
    if (id < 0 || id >= (idmap_size << 3)) {
        return false;
    } else {
        var index = id >> 3;
        var bit = id & 7;
        return !!(idbuffer[index] & (1 << bit));
    }
}

function deleteId(id) {
    if (id < 0 || id >= (idmap_size << 3)) {
        return false;
    } else {
        var index = id >> 3;
        var bit = id & 7;
        var mask = (1 << bit);
        var x = idbuffer[index];
        if (!(x & mask)) {
            return false;
        } else {
            idbuffer[index] = x & ~mask;
            return true;
        }
    }
}

const app = express();
app.use(bodyParser.text({ type: 'text/plain' }));

const serverSecret = fs.readFileSync('.secret').toString().trim();
const db = new sqlite3.Database('simple.db', sqlite3.OPEN_READWRITE);
var dbFetch = db.prepare('SELECT value FROM simple WHERE id = ?');
var dbPut = db.prepare('INSERT OR REPLACE INTO simple VALUES (?, ?)');

app.use(express.static('public'));

app.get('/api/health', function(req, res) {
    res.type('text/plain');
    res.send(req.url + ' ' + Date.now() + ' ok\n');
});

app.get('/api/rand', function(req, res) {
    crypto.randomBytes(384, function(err, buf) {
        res.type('text/plain');
        var s = buf.toString('base64');
        var body = Date.now() + '\n';
        for (var i = 0; i < 512; i += 64) {
            body += s.slice(i, i + 64) + '\n';
        }
        res.send(body);
    });
});

app.post('/api/id/new', function(req, res) {
    res.type('text/plain');
    var id = newId();
    if (id < 0) {
        res.status(500);
        res.send();
    } else {
        res.status(200);
        res.send(encode_id(id) + '\n');
    }
});

app.get('/api/tid/new', function(req, res) {
    res.type('text/plain');
    const tid = newTid();
    res.status(200);
    res.send(tid + '\n');;
});

app.get('/api/id/:id', function(req, res) {
    res.type('text/plain');
    var id = req.params.id;
    if (id_regex.test(id)  && isId(decode_id(id))) {
        res.status(200);
        res.send('ok\n');
    } else {
        res.status(404);
        res.send('not found\n');
    }
});

app.delete('/api/id/:id', function(req, res) {
    res.type('text/plain');
    var id = req.params.id;
    if (deleteId(decode_id(id))) {
        res.status(200);
        res.send('ok\n');
    } else {
        res.status(404);
        res.send('not found\n');
    }
});

app.get('/api/d/:id', function(req, res) {
    if (!checkHmac(req, res)) return;
    res.type('text/plain');
    var id = req.params.id;
    dbFetch.all([id], function(err, rows) {
        if (rows.length > 0) {
            res.send(rows[0].value)
        } else {
            res.send('')
        }
    });        
});

app.put('/api/d/:id', function(req, res) {
    if (!checkHmac(req, res)) return;
    var id = req.params.id;
    res.type('text/plain');
    dbPut.run([id, req.body], function(err) {
	if (err) {
            res.status(500);
            res.send('Database Error');
	} else {
	    res.status(204);
	    res.send();
	}
    });
});

function checkHmac(req, res) {
    var ts = parseInt(req.query.t);
    var signature = req.headers['x-signature'];
    if (!(Math.abs(ts + 20000 - Date.now()) < 40000) || !signature) {
        res.status(401);
        res.type('text/plain')
        res.send('Current Signature Required\n');
        return false;
    }
    var id = req.params.id;
    var sigCheck = crypto.createHmac("sha256", serverSecret)
        .update(req.method + ':' + id + ':' + ts).digest('base64');
    if (sigCheck != signature) {
        res.status(403);
        res.type('text/plain');
        res.send('Forbidden\n');
        return false;
    } else {
        return true;
    }
}

const server = app.listen(8080, 'localhost');
console.log('Simple server running at http://localhost:8080/');

function shutdown() {
    console.log('Simple server shutting down...');
    server.close(function () {
        dbFetch.finalize();
        dbPut.finalize();
        db.close();
        mmap.sync(idbuffer);
        idbuffer = null;
        console.log('Simple server shutdown complete');
    });
}
                 
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
