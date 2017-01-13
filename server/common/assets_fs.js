"use strict";


const _ = require("lodash")
module.exports = function (backend, obj, event) {


    var ids = []
    _.each(obj.ids, function (n) {
        ids.push("" + n)
    })
    var oss = {
        "name": "assets.delete",

        "env": ["dashboard", "designer", "preview"],
        "data": {"assets": obj.ids}
    }

    var connection = backend.connect()

    var assets = connection.createSubscribeQuery('assets', {
        "_id": {$in: ids}
    }, {}, function (err) {


        _.each(assets.results, function (asset) {

            if (obj.op == "move") {
                //console.log(obj)
                // assets.move(asset.id, obj.to);
                var to = obj.to == null ? [] : [parseInt(obj.to)]
                asset.submitOp({p: ['path'], oi: to});
            }
            if (obj.op == "delete") {


                oss.target= asset.scope


                asset.del()
            }
        })

        if(obj.op=="delete"){
            //通知消息处理前端
            event.emit("oss",oss)
        }

    });
};
