"use strict";

let _ = require("lodash")
module.exports = function (backend, config, req, res, next) {

    var data = {"websocket": true, "origins": ["*:*"], "cookie_needed": false, "entropy": 2810807755}


   res.json(data)


};
