/**
 * Created by leven on 17/1/8.
 */
var http = require('http');
var path = require('path');
var Duplex = require('stream').Duplex;
var inherits = require('util').inherits;
var express = require('express');
var ShareDB = require('./src/server/vendor/sharedb');
var WebSocketServer = require('ws').Server;
var otText = require('ot-text');
var richText = require('rich-text');

const log = require("sharedb-logger")
ShareDB.types.register(otText.type);
//
//ShareDB.types.map['json0'].registerSubtype(otText.type);
// ShareDB.types.map['json0'].registerSubtype(richText.type);
//
 //console.log(ShareDB.types.map)

const db = require('sharedb-mongo')('mongodb://71an.com:2706/playcanvas');

//module.exports = (cb) => {
    //ShareDB.types.map['json0'].registerSubtype(otText.type);

   // var shareDB = ShareDB();


    var  shareDB = new ShareDB({
        db
    });
log(shareDB)
// var id=1484255502700
//
//
// var connection = shareDB.connect();
// var doc = connection.get('projects', ""+id);
// doc.fetch(function (err) {
//     if (err) throw err;
//     console.error(doc.data)
//     doc.submitOp({p: ['settings','scripts'], oi:  [2,3,4]},function(){
//         "use strict";
//         console.log(doc.data)
//     });
//
// });

var message='project:save{"id":"1484256341844","path":"settings.scripts","value":[1484256359790,1484256426099]}';
var reg = new RegExp('(project:save)(.+)', "gmi");

var obj =  message.replace(reg, "$2")


var obj = JSON.parse(message.replace(reg, "$2"))


console.log(obj)

var connection = shareDB.connect();
var project = connection.get('projects', ""+obj.id);
project.fetch(function (err) {
    if (err) throw err;

    project.submitOp({p: obj.path.split("."), oi:  (obj.value)});

    var oss = {
        "name": "project.update",
        "target": {
            "type": "project",
            "id": obj.id
        },
        "env": [
            "dashboard",
            "designer"
        ],
        "data": {
            "settings.scripts": obj.value
        }
    }


});
