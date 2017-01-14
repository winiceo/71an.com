"use strict";

let _=require("lodash")
module.exports = function(backend,config, req, res, next) {

    var connection = backend.connect();
    var doc = connection.get('scenes', req.params.sid);
    let callback = function () {
        "use strict";
        res.send(doc.data)

    }
    doc.fetch(function (err) {
        if (err) throw err;
        doc.del()
        callback();
    });


};

