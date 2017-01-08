/**
 * Created by leven on 17/1/4.
 */
var http = require('http');
var express = require('express');
var ShareDB = require('sharedb');
var WebSocket = require('ws');
var WebSocketJSONStream = require('websocket-json-stream');
var stream = require('./stream');
var Duplex = require('stream').Duplex



var db = require('sharedb-mongo')('mongodb://71an.com:2706/atest');
var backend = new ShareDB({db: db});
//var backend = new ShareDB();
createDoc(startServer);

// Create initial document then fire callback
function createDoc(callback) {
    var connection = backend.connect();
    var doc = connection.get('examples', 'textarea');
    doc.fetch(function(err) {
        if (err) throw err;
        if (doc.type === null) {
            doc.create('', callback);
            return;
        }
        callback();
    });
}

function startServer() {
    // Create a web server to serve files and listen to WebSocket connections
    var app = express();
    app.use(express.static('static'));
    var server = http.createServer(app);
    //stream(backend,{server: server} )
    // Connect any incoming WebSocket connection to ShareDB
     var wss = new WebSocket.Server({server: server});
    wss.on('connection', function(ws, req) {
        var stream = new WebSocketJSONStream(ws);
        backend.listen(stream);
    });


    server.listen(9999,function(){
        "use strict";


    });
    console.log('Listening on http://localhost:8080');
}
