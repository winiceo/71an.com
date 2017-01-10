var Duplex = require('stream').Duplex;
var util = require('util');
var WebSocket = require('ws');

module.exports = createWebSocketStream;

/**
 * @param {EventEmitters} client is a browserchannel client session for a given
 * browser window/tab that is has a connection
 * @return {Duplex} stream
 */
function createWebSocketStream(client) {
  var stream = new ClientStream(client);

  client.on('message', function onMessage(message) {
    var data;
    function clientSend(message) {
      if (client.readyState === client.OPEN) {
        client.send(message);
      }
    }
    try {
      if (/^{/.test(message)) {
        data = JSON.parse(message);
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
    stream.push(data);
  });

  client.on('close', function() {
    // Signal data writing is complete. Emits the 'end' event
    stream.push(null);
  });

  return stream;
}

function ClientStream(client) {
  this.client = client;
  Duplex.call(this, {objectMode: true});

  var self = this;

  this.on('error', function(error) {
    console.warn('WebSocket client message stream error', error);
    self._stopClient();
  });

  // The server ended the writable stream. Triggered by calling stream.end()
  // in agent.close()
  this.on('finish', function() {
    self._stopClient();
  });
}
util.inherits(ClientStream, Duplex);

ClientStream.prototype._read = function() {};

ClientStream.prototype._write = function(chunk, encoding, callback) {
  // Silently drop messages after the session is closed
  if (this.client.readyState !== WebSocket.OPEN) return callback();
  this.client.send(JSON.stringify(chunk), function(err){
    if (err) console.error('[racer-highway] send:', err);
  });
  callback();
};

ClientStream.prototype._stopClient = function() {
  var client = this.client;
  client.close();
};