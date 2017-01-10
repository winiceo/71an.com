const _ = require('lodash')
const path = require('path')
const EventEmitter = require('events').EventEmitter


module.exports = (options,cb) => {

    options.ee = new EventEmitter()
    cb && cb(options.ee, options)


    // Init backend and all apps
    let backend = require('./backend')(options)



    require('./express')(backend, options, ({ expressApp }) => {
        expressApp.use(backend.modelMiddleware())
        options.ee.emit('done',expressApp,backend)
    })
}