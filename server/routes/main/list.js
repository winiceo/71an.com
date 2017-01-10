"use strict";

var request = require("request");
var querystring = require("querystring");

var HttpError = require("../../lib/http-error");
let _=require("lodash")
module.exports = function(backend,config, req, res, next) {

  let model = backend.createModel()

  let query = model.query("projects", {})
  query.subscribe(function () {
    "use strict";

    var tmp = []

    _.each(query.get(), function (b) {


      tmp.push(b)
    })
    res.render("editor/projects.html", {projects: tmp})
  })

};
