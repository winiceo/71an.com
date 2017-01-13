'use strict';

const throng = require('throng');
const thimble = require('./server');
const workers = process.env.WEB_CONCURRENCY || 1;
var Duplex = require('stream').Duplex;
var inherits = require('util').inherits;
var sockjs = require('sockjs');
var WebSocketServer = require('ws').Server;

const racerHighway = require('./server/lib/racer-highway')

thimble({}, function (event, options) {
    "use strict";

    event.on("done", function (app, backend) {
        // let hwHandlers = racerHighway(backend)
        // app.use(hwHandlers.middleware)
        // app.on('upgrade', hwHandlers.upgrade)
        const start = function () {

            const server = app.listen(process.env.PORT, function () {
                event.emit("websocket", app, backend)
                console.log("Express server listening on " + process.env.APP_HOSTNAME);
            });

            const shutdown = function () {
                server.close(function () {
                    process.exit(0);
                });
            };

            process.on('SIGINT', shutdown);
            process.on('SIGTERM', shutdown);
        }


        throng(workers, start);
    })

    event.on("websocket", function (server, backend) {
        require('./server/socket')(backend,event)
        require('./server/message_socket')(backend,event)

    })

})

