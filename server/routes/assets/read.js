"use strict";

let _=require("lodash")
module.exports = function(backend,config, req, res, next) {

    var connection = backend.connect();
    console.log(req.params.id)

    var doc = connection.get('documents', req.params.id);
    let callback = function () {
        "use strict";
        console.log(doc.data)
        res.send(doc.data)

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

