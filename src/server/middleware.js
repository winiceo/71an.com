/**
 * Created by leven on 17/1/5.
 */

let _ = require('lodash')
let conf = require('nconf')

let stylus = require('stylus')
let nib = require('nib')
let nunjucks = require("nunjucks")
var cors = require('cors')

module.exports = (app, backend) => {
    "use strict";
    app.use(cors())

    app.use(stylus.middleware({

        src: conf.get("RESOURCES"),
        dest: conf.get("CSS"),
        compile: compile,
        debug: true,
        force: true,
    }));

    // nunjucks.configure('views', {
    //     autoescape: true,
    //     express: app
    // });




    var _templates = conf.get( 'TEMPLATE') ;
    nunjucks.configure( _templates, {
        autoescape: true,
        cache: false,
        express: app
    } ) ;
// Set Nunjucks as rendering engine for pages with .html suffix
    app.engine( 'html', nunjucks.render ) ;
    app.set( 'view engine', 'html' ) ;

}


function compile(str, path) {
    return stylus(str)
        .set('filename', path)
        .set('compress', true)
        .use(nib());
}

