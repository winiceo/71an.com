/**
 * Created by leven on 17/1/9.
 */
var http = require('http');
var Duplex = require('stream').Duplex;
var browserChannel = require('browserchannel').server;
var express = require('express');
var livedb = require('livedb');
var sharejs = require('share');

var livedbmongo = require('livedb-mongo');
var mongo = livedbmongo('mongodb://71an.com:2706/playcavans?auto_reconnect', {safe:true});

var livedb = require('livedb').client(mongo);


var backend = livedb.client(mongo);
var share = sharejs.server.createClient({backend: backend});

var app = express();
app.use(express.static(__dirname));

app.use(express.static(sharejs.scriptsDir));
app.use(browserChannel(function (client) {
    var stream = new Duplex({objectMode: true});
    stream._write = function (chunk, encoding, callback) {
        if (client.state !== 'closed') {
            client.send(chunk);
        }
        callback();
    };
    stream._read = function () {
    };
    stream.headers = client.headers;
    stream.remoteAddress = stream.address;
    client.on('message', function (data) {
        stream.push(data);
    });
    stream.on('error', function (msg) {
        client.stop();
    });
    client.on('close', function (reason) {
        stream.emit('close');
        stream.emit('end');
        stream.end();
    });
    return share.listen(stream);
}));

var server = http.createServer(app);
server.listen(3300, function (err) {
    if (err) throw err;

    console.log('Listening on http://%s:%s', server.address().address, server.address().port);
});
