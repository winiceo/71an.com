'use strict';

const redis = require('redis-url')
var ShareDB = require('sharedb');
 var otText = require('ot-text');

ShareDB.types.map['json0'].registerSubtype(otText.type);

const db = require('sharedb-mongo')('mongodb://71an.com:2706/playcanvas');
//redis.debug_mode = true;
let redisClient = redis.connect()
let redisObserver = redis.connect()

const redisPubSub = require('sharedb-redis-pubsub')

const _=require("lodash")
redisClient.on('error', function (err) {
    console.log(err)
});
redisObserver.on('error', function (err) {
    console.log(err)
});
let pubsub = redisPubSub({
    client: redisClient,
    observer: redisObserver
})


const shareDB = new ShareDB({
    db,
    pubsub: pubsub,
});
var backend=shareDB.connect()
backend.debug=true
module.exports = (conn,msg) => {

    console.log(msg)
    if(msg.name=="authenticate"){
        var m={"name":"welcome","target":{"type":"user","id":10695},"env":["designer"],"data":{}}
        conn.write(JSON.stringify(m))
    }


    if(msg.name=="project.watch"){
        //var m={"name":"project.watch","target":{"type":"general"},"env":["*"],"data":{"id":450911}}

        var doc = backend.createSubscribeQuery('assets',  {"project":""+msg.data.id},{},function(a,b) {

            doc.on('insert',function(a,b){


                var asset=a[0].data
                console.log(asset)
                var m={
                    "name": "asset.new",
                    "target": asset.data.scope,
                    "env": [
                        "dashboard",
                        "designer",
                        "preview"
                    ],
                    "data": {
                        "asset": {
                            "id": a[0].id,
                            "source": false,
                            "type": asset.data.type,
                            "scope": asset.data.scope,
                        }
                    }
                }
                conn.write(JSON.stringify(m))

                console.log(m)
            })
            doc.on('move',function(a,b){
                console.log(a,b)
            })

            doc.on('error',function(err){
                console.log(err)
            })

        })

        //{"name":"user.usage","target":{"type":"user","id":10695},"env":["dashboard","designer"],"data":{"user":10695,"usage":{"assets":-3,"total":-3}}}

//{"name":"assets.delete","target":{"type":"project","id":450911},"env":["dashboard","designer","preview"],"data":{"assets":["6312883"]}}




        // conn.write(JSON.stringify(m))
    }









}

