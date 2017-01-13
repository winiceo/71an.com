/**
 * Created by leven on 17/1/8.
 */

var express = require('express');

var sockjs = require('sockjs');
var http = require('http');

module.exports = (backend,event) => {
    var sockjs_opts = {sockjs_url: "http://cdn.jsdelivr.net/sockjs/1.0.1/sockjs.min.js"};
    
    var sockjsServer = sockjs.createServer(sockjs_opts);

    var app = express();
    app.use(express.static(__dirname));
    app.use(express.static(__dirname + '/../node_modules/codemirror/lib'));

    app.get("/messages/info", function (req, res) {
        "use strict";

        var data = {"websocket": true, "origins": ["*:*"], "cookie_needed": false, "entropy": 2810807755}


        res.json(data)
    })
    var server = http.createServer(app);
    sockjsServer.installHandlers(server, {prefix: '/messages'});

    server.listen(3300, function (err) {
        if (err) {
            throw err;
        }
        console.log('Listening on http://%s:%s', server.address().address, server.address().port);
    });

    sockjsServer.on('connection', function (conn) {
        console.log('connection' + conn);

        event.on('oss', function (msg) {
            conn.write(JSON.stringify(msg))
        });

        conn.on('close', function () {
            console.log('close ' + conn);
        });
        conn.on('data', function (message) {

            var msg = JSON.parse(message)
            console.log(msg)
            require("./msg_client")(conn, msg,event)
            console.log('message ' + conn,
                message);
        });
    });

}