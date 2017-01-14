"use strict";

let _ = require("lodash")
let fs = require('hexo-fs');
module.exports = function (backend, config, req, res, next) {

    var connection = backend.connect();

    var asset = connection.get('assets', req.params.aid);
    let callback = function () {
        console.log(asset.data)
        if (_.includes(["texture", 'audio', 'font'], asset.data.type)) {


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


};

