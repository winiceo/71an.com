"use strict";

let _=require("lodash")
module.exports = function(backend,config, req, res, next) {

    var connection = backend.connect();

    var doc = connection.get('assets', req.query.id);
    let callback = function () {
        "use strict";
        console.error(doc.data.data)
        res.send((doc.data.data))

    }
    doc.fetch(function (err) {
        if (err) throw err;
        if (doc.type === null) {
            doc.create({data: ""}, callback);
            return;
        }
        callback();
    });

};



