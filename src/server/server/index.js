const http = require('http')
const https = require('https')
const conf = require('nconf')
const log = require("sharedb-logger")

let start = Date.now()
let server = null
let wsServer = null
  //var ShareDB = require('sharedb');
  //var db1 = require('sharedb-mongo')('mongodb://71an.com:2706/atest');
  //let backend = ShareDB({db: db1});
  //var WebSocket = require('ws');
  //var WebSocketJSONStream = require('websocket-json-stream');

module.exports = (options) => {
  // React apps routes
  let appRoutes = options.appRoutes

  // Init backend and all apps
  let backend = require('./backend')(options)


  //let backend = ShareDB({db: db1});



  // Init error handling route
  let error = options.error(options)

  require('./express')(backend, appRoutes, error, options, ({
    expressApp
  }) => {
    // wsServer = wss
    // log(backend)
      // Create server and setup websockets connection
    if (options.https) {
      server = https.createServer(options.https, expressApp)
    } else {
      server = http.createServer(expressApp)
    }


    //if (options.websockets) server.on('upgrade', upgrade)

    let listenServer = () => {
      server.listen(conf.get('PORT'), (err) => {
        if (err) {
          console.error('Server failed to start. Exiting...')
          return process.exit()
        }

        options.ee.emit('listen',server,backend)



        let time = (Date.now() - start) / 1000
        console.log(
            '%d listening. Go to: http://localhost:%d/ in %d sec',
            process.pid, conf.get('PORT'), time)
          // ----------------------------------------------->       done       <#
        options.ee.emit('done')
      })
    }

    // Start Server
    if (options.beforeStart != null) {
      options.beforeStart(backend, listenServer)
    } else {
      listenServer()
    }
  })
}

// Handle graceful shutdown of the server

function gracefulShutdown(code) {
  console.log('Exiting...')
  if (server) {
    console.log('Http server closing...')
    server.close(() => {
      console.log('Http server closed')
    })
  }
  // if (wsServer && wsServer._server) {
  //   console.log('Ws server closing...')
  //   wsServer._server.close(() => {
  //     console.log('Ws server closed')
  //   })
  // }
  setTimeout(() => {
    process.exit(code)
  }, 3000)
}

process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)
process.on('SIGQUIT', gracefulShutdown)

process.on('uncaughtException', (err) => {
  console.log('uncaught:', err, err.stack)
  gracefulShutdown(100)
})
