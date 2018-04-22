#!/usr/bin/env nodejs

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const bodyParser = require('body-parser');

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
            res.statusCode = 500;
            res.send('Database Error');
	} else {
	    res.statusCode = 204;
	    res.send();
	}
    });
});

function checkHmac(req, res) {
    var ts = parseInt(req.query.t);
    var signature = req.headers['x-signature'];
    if (!(Math.abs(ts + 20000 - Date.now()) < 40000) || !signature) {
        res.statusCode = 401;
        res.type('text/plain')
        res.send('Current Signature Required\n');
        return false;
    }
    var id = req.params.id;
    var sigCheck = crypto.createHmac("sha256", serverSecret)
        .update(req.method + ':' + id + ':' + ts).digest('base64');
    if (sigCheck != signature) {
        res.statusCode = 403;
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
        console.log('Simple server shutdown complete');
    });
}
                 
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
