var app = require("./app")
var route = require("./r")
var middleware = require("./middleware")
const richText = require('rich-text');
var Duplex = require('stream').Duplex;
var inherits = require('util').inherits;
const WebSocket = require('ws');
const WebSocketJSONStream = require('websocket-json-stream');
var WebSocketServer = require('ws').Server;

app({
    appRoutes: {
        "blog": "/blog",
        "assets": "/assets"
    }

}, function (event, options) {
    "use strict";

    event.on("routes", function (app, backend) {
        route(app, backend)
    })

    event.on("middleware", function (app, backend) {
        middleware(app, backend)
    })

    event.on("backend", function (backend) {
        console.log("backend finish")
        console.error(backend)
        // backend.types.register(richText.type);


    })
    event.on("listen", function (server, backend) {
        // var wss = new WebSocket.Server({
        //     server: server
        // });
        // wss.on('connection', function(ws, req) {
        //     var stream = new WebSocketJSONStream(ws);
        //     backend.listen(stream);
        // });


        var webSocketServer = new WebSocketServer({
            server: server
        });

        webSocketServer.on('connection', function (socket) {
            var stream = new WebsocketJSONOnWriteStream(socket);
            backend.listen(stream);
        });

        function WebsocketJSONOnWriteStream(socket) {
            Duplex.call(this, {
                objectMode: true
            });

            this.socket = socket;
            var stream = this;

            function clientSend(message) {
                if (socket.readyState === socket.OPEN) {
                    socket.send(message);
                }
            }

            socket.on('message', function (message) {
                try {
                    if (/^{/.test(message)) {
                        var data = JSON.parse(message);
                    } else {
                        if (message === 'ping') {
                            clientSend('pong');
                            //log('server -> client\n', 'pong\n');
                            return;
                        }
                        //console.log("==============")

                        //console.log(msg)
                        if (message === "auth") {
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
                stream.push(data);
            });

            socket.on("close", function () {
                stream.push(null);
            });

            this.on("error", function (msg) {
                console.warn('WebsocketJSONOnWriteStream error', msg);
                socket.close();
            });

            this.on("end", function () {
                socket.close();
            });
        }

        inherits(WebsocketJSONOnWriteStream, Duplex);

        WebsocketJSONOnWriteStream.prototype._write = function (value, encoding, next) {
            console.log("web write")
            this.socket.send(JSON.stringify(value));
            next();
        };

        WebsocketJSONOnWriteStream.prototype._read = function () {
        };


    })

})
