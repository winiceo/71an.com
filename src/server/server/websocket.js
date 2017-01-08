/**
 * Created by leven on 17/1/4.
 */
var Duplex = require('stream').Duplex,
    WebSocketServer = require('ws').Server;


// Pass in pass through stream
// server option is passed to the WebSocketServer initialization
module.exports = function(store, serverOptions, clientOptions) {

    if (!clientOptions) clientOptions = {};
    store.on('model', function(model) {
        model.on('bundle', function(bundle) {
            bundle.racerWebSocket = clientOptions;
        });
    });

    store.on('bundle', function(browserify) {
        browserify.add(__dirname + '/browser');
    });

    var wss = new WebSocketServer(serverOptions);
    wss.on('connection', function(client) {
        store.emit('client', client);
        var stream = createWebSocketStream(client, store.logger);
        var agent = store.shareClient.listen(stream);
        store.emit('share agent', agent, stream);
    });

};

/**
 * @param {EventEmitters} client is a WebSocket client session for a given
 * browser window/tab that is has a connection
 * @return {Duplex} stream
 */
function createWebSocketStream(client, logger) {
    var stream = new Duplex({objectMode: true});


    stream._write = function _write(chunk, encoding, callback) {
        // Silently drop messages after the session is closed
        if (client.readyState !== 3 /* WebSocket.CLOSED */) {
            client.send(chunk);
            if (logger) {
                logger.write({type: 'S->C', chunk: chunk, client: client});
            }
        }
        callback();
    };
    // Ignore. You can't control the information, man!
    stream._read = function _read() {};

    client.onmessage =function (data) {
        // Ignore Racer channel messages
        if (data && data.racer) return;
        stream.push(data);
        if (logger) {
            logger.write({type: 'C->S', chunk: data, client: client});
        }
    };

    stream.on('error', function onError() {
        client.stop();
    });

    client.onclose= function () {
        stream.end();
        stream.emit('close');
        stream.emit('end');
        stream.emit('finish');
    };

    return stream;
}
