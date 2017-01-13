/**
 * Created by leven on 17/1/8.
 */
var http = require('http');
var path = require('path');
var Duplex = require('stream').Duplex;
var inherits = require('util').inherits;
var express = require('express');
var ShareDB = require('../src/server/vendor/sharedb');
var WebSocketServer = require('ws').Server;
var otText = require('ot-text');
var richText = require('rich-text');

const log = require("sharedb-logger")
ShareDB.types.register(otText.type);
//
//ShareDB.types.map['json0'].registerSubtype(otText.type);
// ShareDB.types.map['json0'].registerSubtype(richText.type);
//
//console.log(ShareDB.types.map)

const db = require('sharedb-mongo')('mongodb://71an.com:2706/playcanvas');

module.exports = (backend, event) => {
    //ShareDB.types.map['json0'].registerSubtype(otText.type);

    // var shareDB = ShareDB();


    var shareDB = new ShareDB({
        db
    });
    log(shareDB)
    var app = express();
    app.use(express.static(__dirname));
    app.use(express.static(__dirname + '/../node_modules/codemirror/lib'));

    var server = http.createServer(app);
    server.listen(3200, function (err) {
        if (err) {
            throw err;
        }
        console.log('Listening on http://%s:%s', server.address().address, server.address().port);
    });

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
            if (socket.readyState === socket.OPEN) {
                socket.send(message);
            }
        }

        socket.on('message', function (message) {


            try {
                if (/^{/.test(message)) {
                    var data = JSON.parse(message);
                    stream.push(data);
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



                    if (/^fs/.test(message)) {
                        var reg = new RegExp('(fs)(.+)', "gmi");

                        var a = message.replace(reg, "$2");
                        // console.log(a)
                        var obj = JSON.parse(a)
                        console.log(obj)
                        require('./common/assets_fs')(shareDB, obj, event)

                        return //clientSend('auth{"id":10695}');
                    }

                    if (/^doc:save/.test(message)) {
                        var reg = new RegExp('(doc:save:")(.+)(")', "gmi");

                        var id = message.replace(reg, "$2")
                        var connection = shareDB.connect();
                        var doc = connection.get('assets', id);
                        doc.fetch(function (err) {
                            if (err) throw err;
                            console.error(doc)
                            // if (doc.type === null) {
                            //   doc.create(user);

                            //   console.log(doc)
                            //   return;
                            // }
                            return clientSend(JSON.stringify(doc.data))
                        });


                        return //clientSend('auth{"id":10695}');
                    }
                    console.log(message)
                    //{"id":449755,"path":"settings.scripts","value":[6316184,6316185,6316189,6316292,6316293]}
                    if (/^project:save/.test(message)) {
                        console.log("****************")
                        console.log(message)

                        var reg = new RegExp('(project:save)(.+)', "gmi");

                        var obj = JSON.parse(message.replace(reg, "$2"))


                        console.log(obj)
                       
                        var connection = shareDB.connect();
                        var project = connection.get('projects', ""+obj.id);
                        project.fetch(function (err) {
                            if (err) throw err;

                            project.submitOp({p: ['settings','scripts'], oi:  (obj.value)});

                            var oss = {
                                "name": "project.update",
                                "target": {
                                    "type": "project",
                                    "id": obj.id
                                },
                                "env": [
                                    "dashboard",
                                    "designer"
                                ],
                                "data": {
                                    "settings.scripts": obj.value
                                }
                            }
                            event.emit("oss",oss)

                        });


                        return //clientSend('auth{"id":10695}');
                    }


                    if (/^project{/.test(message)) {
                        return //clientSend('auth{"id":10695}');
                    }
                }

            } catch (err) {
                stream.emit('error', err);
                return;
            }

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
        this.socket.send(JSON.stringify(value));
        next();
    };

    WebsocketJSONOnWriteStream.prototype._read = function () {
    };
}