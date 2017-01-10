"use strict";

var request = require("request");
var querystring = require("querystring");

var HttpError = require("../../lib/http-error");


const _=require("lodash")
module.exports = function(backend,config, req, res, next) {

  var connection = backend.connect();
  var doc = connection.get('scenes', req.params.d);
  let callback = function () {
    "use strict";
    res.send(doc.data)

  }
  doc.fetch(function (err) {
    if (err) throw err;

    console.log(doc.type)
    if (doc.type === null) {
      doc.create({data: ""}, callback);
      return;
    }
    callback();
  });



};

