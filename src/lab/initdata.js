
var ROOT_PATH = process.cwd()

// Initialize nconf with proper config
 //require('../server/nconf')(ROOT_PATH)

const _ = require('lodash')
//const conf = require('nconf')
const shareDbMongo = require('sharedb-mongo')
const shareDbAccess = require('sharedb-access')
const racerSchema = require('racer-schema')
const shareDbHooks = require('sharedb-hooks')
const redisPubSub = require('sharedb-redis-pubsub')
const racer = require('racer')
const redis = require('redis-url')
const async = require('async')


let mongoUrl = "mongodb://71an.com:2706/playcanvas"
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
let user = model.at('user_data.487210_10695')
let userdata={"accessed_at":"2017-01-03T08:53:18.360Z","cameras":{"perspective":{"position":[111.68462371826172,22.362058639526367,-35.30546951293945],"rotation":[-11.19999885559082,88.7999267578125,-4.7605803388250933e-7],"focus":[-5.145729064941406,-0.7760467529296875,-37.752864837646484]},"top":{"position":[0,1000,0],"rotation":[-90,0,0],"focus":[0,0,0],"orthoHeight":5},"bottom":{"position":[0,-1000,0],"rotation":[90,0,0],"focus":[0,0,0],"orthoHeight":5},"front":{"position":[0,0,1000],"rotation":[0,0,0],"focus":[0,0,0],"orthoHeight":3.1587822596735524},"back":{"position":[0,0,-1000],"rotation":[-180,0,-180],"focus":[0,0,0],"orthoHeight":5},"left":{"position":[-1000,0,0],"rotation":[0,-90,0],"focus":[0,0,0],"orthoHeight":5},"right":{"position":[1000,0,0],"rotation":[0,90,0],"focus":[0,0,0],"orthoHeight":5}},"scene":487210,"user":10695}


model.fetch(user, () => {
   async.series([ (cb) => {
      if (user.get() != null) {
         cb()
      } else {
         model.add('user_data',{id:"487210_10695", userdata}, cb)
      }
   } ], () => {

      console.log('Admins:', user.get('accessed_at'))
      model.close()
   })
})
let user1 = model.at('users.10695')

model.fetch(user1, () => {
   async.series([ (cb) => {
      if (user1.get() != null) {
         cb()
      } else {
         model.add('users',
             {"username":"leven","email_hash":"40352887d9d92e6a981739e6cdbdb90a","full_name":"Leven Zhao","skills":["coder","designer","musician","artist"],"organization":false, "id":10695,"plan_type":"free"},cb);
      }
   } ], () => {

      console.log('Admins:', user1.get('accessed_at'))
      model.close()
   })
})




let projects = model.at('projects.448674')

model.fetch(projects, () => {
        var ss=require("./json/project.json")
        model.add('projects',ss)


      model.close()

})

let scenes = model.at('scenes.487784')

model.fetch(scenes, () => {
         var ss=require("./json/scence.json")
         model.add('scenes', ss );

      model.close()

})








  