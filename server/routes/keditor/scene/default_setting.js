"use strict";

let _=require("lodash")
module.exports = function(backend,config, req, res, next) {

    var data = {
      "camera_far_clip": 1000.0,
      "icons_size": 0.2,
      "help": true,
      "local_server": "http://localhost:3100",
      "pack_id": req.params.d,
      "camera_near_clip": 0.1,
      "modified_at": "2017-01-04T15:09:29.140000",
      "camera_clear_color": [0.118, 0.118, 0.118, 1.0],
      "grid_divisions": 8,
      "grid_division_size": 1.0,
      "version": 1,
      "snap_increment": 1.0,
      "user_id": 10695,
      "_id": "586d1029fe30c41891959722",
      "created_at": "2017-01-04T15:09:29.140000"
    }


    res.json(data)





};
