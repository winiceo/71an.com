/**
 * Created by leven on 17/1/8.
 */

var express = require('express');

var sockjs = require('sockjs');
var http = require('http');

module.exports = (expressApp) => {
    var sockjs_opts = {sockjs_url: "http://cdn.jsdelivr.net/sockjs/1.0.1/sockjs.min.js"};

    var sockjs = sockjs.createServer(sockjs_opts);

    var app = express();
    app.use(express.static(__dirname));
    app.use(express.static(__dirname + '/../node_modules/codemirror/lib'));

    app.get("/messages/info", function (req, res) {
        "use strict";

        var data = {"websocket": true, "origins": ["*:*"], "cookie_needed": false, "entropy": 2810807755}


        res.json(data)
    })
    var server = http.createServer(app);
    sockjs.installHandlers(server, {prefix: '/messages'});

    server.listen(3300, function (err) {
        if (err) {
            throw err;
        }
        console.log('Listening on http://%s:%s', server.address().address, server.address().port);
    });

    sockjs.on('connection', function (conn) {
        console.log('connection' + conn);
        conn.on('close', function () {
            console.log('close ' + conn);
        });
        conn.on('data', function (message) {

            var msg = JSON.parse(message)
            console.log(msg)
            var mclient = require("./mclient")(conn, msg)
            console.log('message ' + conn,
                message);
        });
    });

}