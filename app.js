'use strict';

const throng = require('throng');
const thimble = require('./server');
const workers = process.env.WEB_CONCURRENCY || 1;


var Duplex = require('stream').Duplex;
var inherits = require('util').inherits;

var ShareDB = require('sharedb');
var WebSocketServer = require('ws').Server;
var otText = require('ot-text');

ShareDB.types.map['json0'].registerSubtype(otText.type);

const db = require('sharedb-mongo')('mongodb://71an.com:2706/playcanvas');
const shareDB = new ShareDB({
  db
});
//var shareDB = ShareDB();




const start = function() {

  const server = thimble.listen(process.env.PORT, function() {
    console.log("Express server listening on " + process.env.APP_HOSTNAME);
  });

  const shutdown = function() {
    server.close(function() {
      process.exit(0);
    });
  };


    var webSocketServer = new WebSocketServer({server: server});

    webSocketServer.on('connection', function (socket) {
        var stream = new WebsocketJSONOnWriteStream(socket);
        shareDB.listen(stream);
    });

    function WebsocketJSONOnWriteStream(socket) {
        Duplex.call(this, {objectMode: true});

        this.socket = socket;
        var stream = this;
      function clientSend(message) {
        if (client.readyState === client.OPEN) {
          client.send(message);
        }
      }
        socket.on('message', function(message) {


          try {
            if (/^{/.test(message)) {
             var data = JSON.parse(message);
              stream.push(data);
            }else{
              if (message === 'ping') {
                clientSend('pong');
                //log('server -> client\n', 'pong\n');
                return;
              }
              //console.log("==============")

              //console.log(msg)
              if (message==="auth") {
                return true;
              }

              if (/^auth/.test(message)) {
                return clientSend('auth{"id":10695}');
              }

              if (/^selection/.test(message)) {
                return //clientSend('auth{"id":10695}');
              }

              if (/^project/.test(message)) {
                return //clientSend('auth{"id":10695}');
              }
            }

          } catch (err) {
            stream.emit('error', err);
            return;
          }

        });

        socket.on("close", function() {
            stream.push(null);
        });

        this.on("error", function(msg) {
            console.warn('WebsocketJSONOnWriteStream error', msg);
            socket.close();
        });

        this.on("end", function() {
            socket.close();
        });
    }
    inherits(WebsocketJSONOnWriteStream, Duplex);

    WebsocketJSONOnWriteStream.prototype._write = function(value, encoding, next) {
        this.socket.send(JSON.stringify(value));
        next();
    };

    WebsocketJSONOnWriteStream.prototype._read = function() {};


    process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

throng(workers, start);
