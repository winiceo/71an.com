'use strict';

const throng = require('throng');
const thimble = require('./server');
const workers = process.env.WEB_CONCURRENCY || 1;


var Duplex = require('stream').Duplex;
var inherits = require('util').inherits;

var ShareDB = require('sharedb');
var WebSocketServer = require('ws').Server;
var otText = require('ot-text');
var _=require("lodash")
ShareDB.types.map['json0'].registerSubtype(otText.type);

const db = require('sharedb-mongo')('mongodb://71an.com:2706/playcanvas');
const shareDB = new ShareDB({
  db
});
//var shareDB = ShareDB();

var backend=shareDB.connect()

var doc = backend.createSubscribeQuery('assets',  {"data.project":'54312e7d-83e4-4209-827c-01d1e6adf9cd'},{},function(a,b){





  _.each(doc.results,function(n){
    console.log(n.id)

  })

//

});
var user=          {"username":"leven","email_hash":"40352887d9d92e6a981739e6cdbdb90a","full_name":"Leven Zhao","skills":["coder","designer","musician","artist"],"organization":false, "id":10695,"plan_type":"free"}



var connection = shareDB.connect();
var doc = connection.get('users', '10695');
doc.fetch(function(err) {
  if (err) throw err;
  if (doc.type === null) {
    doc.create(user);

    console.log(doc)
    return;
  }
  console.log(doc)
});


