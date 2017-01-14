"use strict";

let _ = require("lodash")
let fs = require('hexo-fs');
module.exports = function (backend, config, req, res, next) {

    var connection = backend.connect();

    var asset = connection.get('assets', ""+req.query.id);

    let callback = function () {
        console.log(asset.data)

        if (!_.includes(["texture", 'audio', 'font'], asset.data.type)) {
            getDocument(function (doc) {


                var mimetype = asset.data.file.mimetype
                console.log(mimetype)
                res.set('Content-Type', mimetype);
                res.send(doc.data);

            })
        } else {


            fs.exists(asset.data.file.path, function (exist) {
                if (exist) {
                    var mimetype = asset.data.file.mimetype
                    res.set('Content-Type', mimetype);
                    res.sendfile(asset.data.file.path);

                }
            });
        }


    }
    asset.fetch(function (err) {
        if (err) throw err;
        if (asset.type === null) {

        }
        callback();
    });

    function getDocument(callback) {

        var doc = connection.get('documents', ""+req.query.id);

        doc.fetch(function (err) {
            if (err) throw err;
            if (doc.type === null) {
                doc.create("\n", "text", callback);
                return;
            }
            callback(doc);
        });

    }


};

