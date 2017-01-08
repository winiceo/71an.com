
var ROOT_PATH = process.cwd()

// Initialize nconf with proper config
 require('../server/nconf')("/abc/keditor")

const _ = require('lodash')
const conf = require('nconf')
const shareDbMongo = require('sharedb-mongo')
const shareDbAccess = require('sharedb-access')
const racerSchema = require('racer-schema')
const shareDbHooks = require('sharedb-hooks')
const redisPubSub = require('sharedb-redis-pubsub')
const racer = require('racer')
const redis = require('redis-url')
const async = require('async')


let mongoUrl = conf.get('MONGO_URL')
if (/auto_reconnect/.test(mongoUrl)) {
   if (/\?/.test(mongoUrl)) {
      mongoUrl += '&'
   } else {
      mongoUrl += '?'
   }
   mongoUrl += 'auto_reconnect'
}

let mongo = shareDbMongo(mongoUrl, {
   safe: true,
   allowAllQueries: true
})

var backend=racer.createBackend({
   db: mongo

})

let model = backend.createModel()




let query = model.query("scenes", {"project_id":449204})
query.subscribe(function(results){
    "use strict";


    console.log(query.get())
    console.log(results)
})

//console.log(query.data)





  