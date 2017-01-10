"use strict";

var request = require("request");
var querystring = require("querystring");

var HttpError = require("../../lib/http-error");


const _=require("lodash")
module.exports = function(backend,config, req, res, next) {


  let model = backend.createModel()
  let query = model.query("assets", {"project": {$eq: req.params.d}}).fetch(function () {
    "use strict";
    let results = []
    _.mapKeys(query.idMap, function (key, value) {
      results.push({id: value})

    })
    res.json(results)



  })



};

