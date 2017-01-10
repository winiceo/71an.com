"use strict";

let _=require("lodash")

let createScenes=require("../../common/scenes")
module.exports = function(backend,config, req, res, next) {
    var data = req.body
    data.id=data.project_id
    createScenes(data,backend, function (scene) {


        res.json(scene.data)

    })
};


//
// app.post('/api/scenes', function (req, res, next) {
//     var data = req.body
//     let model = backend.createModel()
//     // let createNull
//     let uid = model.id()
//
//     let obj = {
//         "project_id": 449204,
//         "name": " asjdfkasj\uff1b\u57ce",
//         "settings": {
//             "physics": {
//                 "gravity": [
//                     0.0,
//                     -9.8,
//                     0.0
//                 ]
//             },
//             "render": {
//                 "fog_end": 1000.0,
//                 "fog_start": 1.0,
//                 "skyboxIntensity": 1,
//                 "global_ambient": [
//                     0.2,
//                     0.2,
//                     0.2
//                 ],
//                 "tonemapping": 0,
//                 "fog_color": [
//                     0.0,
//                     0.0,
//                     0.0
//                 ],
//                 "lightmapMode": 1,
//                 "skyboxMip": 0,
//                 "fog": "none",
//                 "lightmapMaxResolution": 2048,
//                 "skybox": null,
//                 "fog_density": 0.01,
//                 "gamma_correction": 1,
//                 "lightmapSizeMultiplier": 16,
//                 "exposure": 1.0
//             }
//         },
//         "scene": 488048,
//         "modified": "2017-01-05T12:53:46.528416",
//         "entities": {
//             "fef8a994-d345-11e6-89b2-22000ac481df": {
//                 "scale": [
//                     1,
//                     1,
//                     1
//                 ],
//                 "name": "Root",
//                 "parent": null,
//                 "resource_id": "fef8a994-d345-11e6-89b2-22000ac481df",
//                 "enabled": true,
//                 "components": {},
//                 "position": [
//                     0,
//                     0,
//                     0
//                 ],
//                 "rotation": [
//                     0,
//                     0,
//                     0
//                 ],
//                 "children": [
//                     "fef8ac50-d345-11e6-89b2-22000ac481df",
//                     "fef8ae1c-d345-11e6-89b2-22000ac481df",
//                     "fef8afd4-d345-11e6-89b2-22000ac481df",
//                     "fef8b182-d345-11e6-89b2-22000ac481df"
//                 ]
//             },
//             "fef8ae1c-d345-11e6-89b2-22000ac481df": {
//                 "scale": [
//                     1,
//                     1,
//                     1
//                 ],
//                 "name": "Light",
//                 "parent": "fef8a994-d345-11e6-89b2-22000ac481df",
//                 "resource_id": "fef8ae1c-d345-11e6-89b2-22000ac481df",
//                 "enabled": true,
//                 "components": {
//                     "light": {
//                         "bake": false,
//                         "vsmBlurSize": 11,
//                         "shadowUpdateMode": 2,
//                         "normalOffsetBias": 0.04,
//                         "color": [
//                             1,
//                             1,
//                             1
//                         ],
//                         "type": "directional",
//                         "shadowResolution": 1024,
//                         "outerConeAngle": 45,
//                         "enabled": true,
//                         "intensity": 1,
//                         "castShadows": true,
//                         "innerConeAngle": 40,
//                         "range": 8,
//                         "affectLightmapped": false,
//                         "vsmBlurMode": 1,
//                         "affectDynamic": true,
//                         "shadowBias": 0.04,
//                         "shadowDistance": 16.0,
//                         "falloffMode": 0,
//                         "shadowType": 0,
//                         "vsmBias": 0.01
//                     }
//                 },
//                 "position": [
//                     2,
//                     2,
//                     -2
//                 ],
//                 "rotation": [
//                     45,
//                     135,
//                     0
//                 ],
//                 "children": []
//             },
//             "fef8b182-d345-11e6-89b2-22000ac481df": {
//                 "scale": [
//                     8,
//                     1,
//                     8
//                 ],
//                 "name": "Plane",
//                 "parent": "fef8a994-d345-11e6-89b2-22000ac481df",
//                 "resource_id": "fef8b182-d345-11e6-89b2-22000ac481df",
//                 "enabled": true,
//                 "components": {
//                     "model": {
//                         "materialAsset": null,
//                         "lightMapped": false,
//                         "receiveShadows": true,
//                         "castShadowsLightMap": false,
//                         "enabled": true,
//                         "castShadows": true,
//                         "castShadowsLightmap": true,
//                         "lightMapSizeMultiplier": 1,
//                         "lightmapSizeMultiplier": 1,
//                         "type": "plane",
//                         "lightmapped": false,
//                         "asset": null
//                     }
//                 },
//                 "position": [
//                     0,
//                     0,
//                     0
//                 ],
//                 "rotation": [
//                     0,
//                     0,
//                     0
//                 ],
//                 "children": []
//             },
//             "fef8ac50-d345-11e6-89b2-22000ac481df": {
//                 "scale": [
//                     1,
//                     1,
//                     1
//                 ],
//                 "name": "Camera",
//                 "parent": "fef8a994-d345-11e6-89b2-22000ac481df",
//                 "resource_id": "fef8ac50-d345-11e6-89b2-22000ac481df",
//                 "enabled": true,
//                 "components": {
//                     "camera": {
//                         "orthoHeight": 4,
//                         "fov": 45,
//                         "clearDepthBuffer": true,
//                         "projection": 0,
//                         "frustumCulling": true,
//                         "clearColor": [
//                             0.118,
//                             0.118,
//                             0.118,
//                             1.0
//                         ],
//                         "enabled": true,
//                         "priority": 0,
//                         "farClip": 1000,
//                         "nearClip": 0.1,
//                         "rect": [
//                             0,
//                             0,
//                             1,
//                             1
//                         ],
//                         "clearColorBuffer": true
//                     }
//                 },
//                 "position": [
//                     4,
//                     3.5,
//                     4
//                 ],
//                 "rotation": [
//                     -30,
//                     45,
//                     0
//                 ],
//                 "children": []
//             },
//             "fef8afd4-d345-11e6-89b2-22000ac481df": {
//                 "scale": [
//                     1,
//                     1,
//                     1
//                 ],
//                 "name": "Box",
//                 "parent": "fef8a994-d345-11e6-89b2-22000ac481df",
//                 "resource_id": "fef8afd4-d345-11e6-89b2-22000ac481df",
//                 "enabled": true,
//                 "components": {
//                     "model": {
//                         "materialAsset": null,
//                         "lightMapped": false,
//                         "receiveShadows": true,
//                         "castShadowsLightMap": false,
//                         "enabled": true,
//                         "castShadows": true,
//                         "castShadowsLightmap": true,
//                         "lightMapSizeMultiplier": 1,
//                         "lightmapSizeMultiplier": 1,
//                         "type": "box",
//                         "lightmapped": false,
//                         "asset": null
//                     }
//                 },
//                 "position": [
//                     0,
//                     0.5,
//                     0
//                 ],
//                 "rotation": [
//                     0,
//                     0,
//                     0
//                 ],
//                 "children": []
//             }
//         },
//
//         "id": 488048
//     }
//
//
//     var connection = backend.connect();
//
//     var doc = connection.get('scenes', uid);
//     let callback = function () {
//         //console.log(doc.data)
//         res.json(doc.data)
//     }
//     doc.fetch(function (err) {
//         if (err) throw err;
//         if (doc.type === null) {
//             doc.create(_.assign(obj, data), callback);
//             return;
//         }
//         callback();
//     });
//
// })