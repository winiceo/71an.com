"use strict";

var request = require("request");
var querystring = require("querystring");

var HttpError = require("../../lib/http-error");


const _ = require("lodash")
module.exports = function(backend, config, req, res, next) {



  var connection = backend.connect()

  var doc = connection.createSubscribeQuery('assets', {
    "project": req.params.d
  }, {}, function(err) {

    var tmp = []

    _.each(doc.results, function(b) {
      tmp.push({
        id: b.id
      })
    })

    res.json(tmp)

  });
};
