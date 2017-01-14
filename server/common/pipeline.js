"use strict";


const _ = require("lodash")
module.exports = function (backend, obj, event) {

    var connection = backend.connect();


    var asset = connection.get('assets', obj.data.source);
    let callback = function () {


        // var options = {
        //     "new": false,
        //     "format": "jpeg",
        //     "size": {
        //         "width": 4096,
        //         "height": 2048
        //     }
        // }


        if (obj.name == "convert") {
            var ops = []
            // ops.push({
            //     "p": [
            //         "task"
            //     ],
            //     "oi": null,
            //     "od": null
            // })
            //Todo
            //原来这数据是从客户端传过来的
            // ops.push( {
            //     "p": [
            //         "file"
            //     ],
            //     "oi": {
            //         "filename": "2017.jpg",
            //         "hash": "461237647e4a1c2fb578bc778976ea79",
            //         "size": 5026808,
            //         "variants": {}
            //     },
            //     "od": null
            // })
            ops.push( {
                p: [
                    'meta',
                    'width'
                ],
                oi: obj.data.options.width,
                od: null
            })
            ops.push( {
                'p': [
                    'meta',
                    'height'
                ],
                oi: obj.data.options.height,
                od: null
            })


            //asset.submitOp({p: ['has_thumbnail'], oi: false, od: null});
            _.each(ops, function (op) {
               // asset.submitOp(op);
            })
            //asset.submitOp({p: ['has_thumbnail'], oi: false, od: null});
        } else if (obj.name == "thumbnails") {
            //asset.submitOp({p: ['has_thumbnail'], oi: true, od: null});
           // {"a":"op","c":"assets","d":"6339997","v":4,"src":"","op":[{"p":["has_thumbnail"],"oi":true,"od":null}]}
        }

    }
    asset.fetch(function (err) {
        if (err) throw err;
        if (asset.type === null) {

        }
        callback();
    });


    // var ids = []
    // _.each(obj.ids, function (n) {
    //     ids.push("" + n)
    // })
    // var oss = {
    //     "name": "assets.delete",
    //
    //     "env": ["dashboard", "designer", "preview"],
    //     "data": {"assets": obj.ids}
    // }
    //
    // var connection = backend.connect()
    //
    // var assets = connection.createSubscribeQuery('assets', {
    //     "_id": {$in: ids}
    // }, {}, function (err) {
    //
    //
    //     _.each(assets.results, function (asset) {
    //
    //         if (obj.op == "move") {
    //             //console.log(obj)
    //             // assets.move(asset.id, obj.to);
    //             var to = obj.to == null ? [] : [parseInt(obj.to)]
    //             asset.submitOp({p: ['path'], oi: to});
    //         }
    //         if (obj.op == "delete") {
    //
    //
    //             oss.target= asset.scope
    //
    //
    //             asset.del()
    //         }
    //     })
    //
    //     if(obj.op=="delete"){
    //         //通知消息处理前端
    //         event.emit("oss",oss)
    //     }
    //
    // });
};
