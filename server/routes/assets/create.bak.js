"use strict";

let _ = require("lodash")
const utils = require('utility');
let nunjucks = require("nunjucks");
module.exports = function (backend, config, req, res, next) {


    console.error((req))

    console.error("============")
    var data = req.body

    let file = req.file

    let type = data.type?data.type:"texture"


    if (data.data) {
        data.data = JSON.parse(data.data)
    }else{
        if(type=="texture"){
            data.data={
                "addressu": "repeat",
                "addressv": "repeat",
                "minfilter": "linear_mip_linear",
                "magfilter": "linear",
                "anisotropy": 1,
                "rgbm": false,
                "mipmaps": true
            }

        }
    }



    console.log(data)
    var connection = backend.connect();
    let model = backend.createModel()

    let uid = model.id()


    var assets = connection.get('assets', "" + uid);



    let obj = {
        "scope": {
            "type": "project",
            "id": data.project
        },
        "user_id": 10695,
        "source_asset_id": null,
        "source": false,
        "tags": [],
        "name": file.originalname,
        "revision": 1,
        "preload": true,


        "type": type,
        "file": {
            "filename": file.originalname,
            "size": file.size,
            "hash": file.filename,
            "path": file.path,
            "variants": {}
        },
        "region": "eu-west-1",
        "path": [],
        "task": null
    }
    if(type=='texture'){
        obj.has_thumbnail= true
        obj.meta=   {
            "compress": {
                "alpha": false,
                "dxt": false,
                "pvr": false,
                "pvrBpp": 4,
                "etc1": false
            },
            "format": "png",
            "type": "PaletteAlpha",
            "width": 128,
            "height": 128,
            "alpha": true,
            "depth": 8,
            "srgb": true,
            "interlaced": false
        }

    }
    // var file = {
    //     fieldname: 'file',
    //     originalname: '444.png',
    //     encoding: '7bit',
    //     mimetype: 'image/png',
    //     destination: '/abc/kevio/kevio/public/uploads/',
    //     filename: '0ba09340ae7eca74182df619ff221d0b',
    //     path: '/abc/kevio/kevio/public/uploads/0ba09340ae7eca74182df619ff221d0b',
    //     size: 6496
    // }



    let content = "\n"


    let callback = function () {
        "use strict";
        // res.send(doc.data)


        if (assets.data.type == 'script') {

            content = writeJs(assets.data.name)
        }

        if (assets.data.type == 'json') {

            content = "{ }"
        }

        if (assets.data.type != 'texture') {

            createDocument();
        }


        res.json({"asset": {"id": uid}})

    }
    assets.fetch(function (err) {
        if (err) throw err;
        if (assets.type === null) {
            assets.create(obj, callback);
            return;
        }
        callback();
    });
    var createDocument = function () {
        var doc = connection.get('documents', "" + uid);

        doc.fetch(function (err) {
            if (err) throw err;
            if (doc.type === null) {

                doc.create(content, 'text');

                return;
            }
            ;
        });
    }


    function writeJs(name) {
        var reg = new RegExp('(.+)(.js)', "gmi");

        var className = name.replace(reg, "$1")


        return nunjucks.render(__dirname + '/js_template.html', {className: className});


    }


};



