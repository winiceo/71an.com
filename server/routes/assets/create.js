"use strict";

let _=require("lodash")
module.exports = function(backend,config, req, res, next) {

    var data = req.body

    var connection = backend.connect();



    let model = backend.createModel()
    // let createNull
    let uid = model.id()


    console.log(data)

    var assets = connection.get('assets',uid);


    let obj = {
        "scope": {
            "type": "project",
            "id": data.project
        },
        "user_id": 10695,
        "source_asset_id": null,
        "source": false,
        "tags": [],

        "revision": 1,
        "preload": true,
        "meta": null,
        "data": null,

        "file": {
            "filename": data.filename,
            "size": 1,
            "hash": "68b329da9893e34099c7d8ad5cb9c940"
        },
        "region": "eu-west-1",
        "path": [],
        "task": null
    }

    let callback = function () {
        "use strict";
       // res.send(doc.data)

        console.log(assets.data)
        res.json({"asset": {"id": uid}})

    }
    assets.fetch(function (err) {
        if (err) throw err;
        if (assets.type === null) {
            assets.create({data: _.assign(obj, data)}, callback);
            return;
        }
        callback();
    });
    var doc = connection.get('documents', "" + uid);

    doc.fetch(function (err) {
        if (err) throw err;
        if (doc.type === null) {

            // doc.create([{
            //     insert: '\n'
            // }],"rich-text");

            doc.create("afasdf", 'text');
            // console.log(doc.data)
            // [{insert: 'Hi!'}], 'rich-text'
            // doc.create({data:"\n"}, callback);
            return;
        }
        ;
    });




};



