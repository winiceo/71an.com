"use strict";

let _ = require("lodash")
const utils = require('utility');
let nunjucks = require("nunjucks");
var fs = require('hexo-fs');
const path = require("path")
module.exports = function (backend, config, req, res, next) {

    let data = req.body
    let file = req.file
    console.log("============")
    console.log(data)
    let fileExt
    if (!data.type) {
        fileExt = path.extname(file.originalname).replace(".", "")
        data.type = getType(fileExt)
    }

    let content = "\n"


    if (data.type == "scirpt") {
        content = writeJs(file.originalname)
    }
    if (data.type == "texture") {

        data.meta = {
            "compress": {
                "alpha": false,
                "dxt": false,
                "pvr": false,
                "pvrBpp": 4,
                "etc1": false
            },
            "format": fileExt,
            "type": "TrueColor",
            "width": 512,
            "height": 512,
            "alpha": false,
            "depth": 8,
            "srgb": true,
            "interlaced": false
        }
        data.has_thumbnail = true
    }


    if (!_.includes(["texture", 'audio', 'font','folder','cubemap','material'], data.type)) {
        content = fs.readFileSync(file.path)
    }
    console.log(content)

    let obj = {
        data: data,
        file: file,
        content: content
    }
    console.log(obj)
    createDocument(backend, obj, res)


};


function createDocument(backend, obj, res) {
    var data = obj.data, file = obj.file
    if (data.data) {
        data.data = JSON.parse(data.data)
    }


    var connection = backend.connect();
    let model = backend.createModel()
    let uid = model.id()
    var assets = connection.get('assets', "" + uid);
    let asset = {
        "scope": {
            "type": "project",
            "id": data.project
        },
        "user_id": 10695,
        "source_asset_id": null,

        "tags": [],
        "meta": {},

        "revision": 1,


       
        "region": "eu-west-1",
        "path": [],
        "task": null
    }
    console.log(file)
    if(file){
         asset.file= {
            "filename": file.originalname,
            "size": file.size,
            "hash": file.filename,
            "path": file.path,
            "mimetype": file.mimetype,
            "variants": {}
        }
    }


    let callback = function () {
        "use strict";

        var doc = connection.get('documents', "" + uid);

        doc.fetch(function (err) {
            if (err) throw err;
            if (doc.type === null) {

                doc.create(obj.content, 'text');

                return;
            }
            ;
        });


        res.json({"asset": {"id": uid}})

    }

    assets.fetch(function (err) {
        if (err) throw err;
        if (assets.type === null) {
            assets.create(_.assign(asset, data), callback);
            return;
        }
        callback();
    });


}


function getType(ext) {


    var typeToExt = {
        'scene': ['fbx', 'dae', 'obj', '3ds'],
        'text': ['txt', 'xml'],
        'html': ['html'],
        'css': ['css'],
        'json': ['json'],
        'texture': ['tif', 'tga', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'dds', 'hdr', 'exr'],
        'audio': ['wav', 'mp3', 'mp4', 'ogg'],
        'shader': ['glsl', 'frag', 'vert'],
        'script': ['js'],
        'font': ['ttf', 'otf']
    };
    var extToType = {};
    for (var type in typeToExt) {
        for (var i = 0; i < typeToExt[type].length; i++) {
            extToType[typeToExt[type][i]] = type;
        }
    }

    console.log(extToType)

    console.error(extToType[ext])
    return extToType[ext]
}


function writeJs(name) {
    var reg = new RegExp('(.+)(.js)', "gmi");

    var className = name.replace(reg, "$1")


    return nunjucks.render(__dirname + '/js_template.html', {className: className});


}