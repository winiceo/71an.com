// 'use strict';
//
// const throng = require('throng');
// const thimble = require('./server');
// const workers = process.env.WEB_CONCURRENCY || 1;
//
//
// var Duplex = require('stream').Duplex;
// var inherits = require('util').inherits;
// const redis = require('redis-url')
// var ShareDB = require('sharedb');
// var WebSocketServer = require('ws').Server;
// var otText = require('ot-text');
// var _=require("lodash")
// ShareDB.types.map['json0'].registerSubtype(otText.type);
//
// const db = require('sharedb-mongo')('mongodb://71an.com:2706/playcanvas');
//
// let redisClient = redis.connect()
// let redisObserver = redis.connect()
//
// const redisPubSub = require('sharedb-redis-pubsub')
//
// let pubsub = redisPubSub({
//   client: redisClient,
//   observer: redisObserver
// })
//
//
// const shareDB = new ShareDB({
//   db,
//   pubsub: pubsub,
// });
//
// const EventEmitter = require('events').EventEmitter
//
// //var shareDB = ShareDB();
// var options={}
// options.ee = new EventEmitter()
// var backend=require("./server/backend")(options)
//
// // console.log(backend.pubsub.subscribe)
// //
// //   var doc = backend.pubsub.subscribe('assets', function(err,b) {
// //     if (err) {
// //       console.error(err)
// //     };
// //   console.log(b)
// // })
//
// //
// var doc = backend.querySubscribe('assets',  {"data.project":'1484156260811'},{},function(a,b) {
//
//   console.log([a,b])
//   _.each(doc.results, function (n) {
//      console.log(n)
//
//   })
// })
// //
// // //
// //
// // });
// // var user=          {"username":"leven","email_hash":"40352887d9d92e6a981739e6cdbdb90a","full_name":"Leven Zhao","skills":["coder","designer","musician","artist"],"organization":false, "id":10695,"plan_type":"free"}
// //
// //
// //
// // var connection = shareDB.connect();
// // var doc = connection.get('users', '10695');
// // doc.fetch(function(err) {
// //   if (err) throw err;
// //   if (doc.type === null) {
// //     doc.create(user);
// //
// //     console.log(doc)
// //     return;
// //   }
// //   console.log(doc)
// // });
// //
//
//
// var connection = shareDB.connect();
//
// var backend=shareDB.connect()
//
// // var doc = backend.createSubscribeQuery('assets',   {_id:{$in:[""+1484156280979,""+1484158016410]}},{},function(a,b){
// //
// //
// //
// //
// //
// //   _.each(doc.results,function(n){
// //     console.log(n.del())
// //
// //   })
// //
// //
// // });
//
// // var doc = backend.createSubscribeQuery('assets',  [""+1484158720861,""+1484158722419],{},function(a,b){
// //
// //
// //
// //
// //  console.log(doc)
// //
// // });
//
//
// var reg=new RegExp('(fs)(.+)',"gmi");
// var message='fs{"op":"delete","ids":[1484158722419]}'
// var a=JSON.parse(message.replace(reg,"$2"));
//
// console.log(a.ids )


var nunjucks=require("nunjucks");

var fs = require('hexo-fs');

var a=function(input ,data){
  return  (new Nunjucks.Template(input)).render(data)
}

var res = nunjucks.render('./server/routes/assets/js_template.html', {className:"leven"});
var reg = new RegExp('(.+)(.js)', "gmi");
var message="leven.js.js"
var obj = message.replace(reg, "$1")
//let temp=require("./server/routes/assets/js_template.html")

console.log(res)
console.log(obj)
//console.log(a(temp,{className:"leven"}))