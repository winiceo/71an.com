'use strict';
var spawn = require('child_process').spawn,
    node,
    fs=require("fs");
var _=require("lodash")

var browserify = require('browserify');
var source = require('vinyl-source-stream');
//var json=require("../src/client/file.json")

/**
 * Live reload server.
 */
module.exports = function(gulp, plugins) {
    var editorjson= JSON.parse(fs.readFileSync('./src/client/editor.json', "utf8"));
    var launchjson= JSON.parse(fs.readFileSync('./src/client/launch.json', "utf8"));
    var codejson= JSON.parse(fs.readFileSync('./src/client/code.json', "utf8"));


    var editors=[],launchs=[],codes=[]
    _.each(editorjson,function(n){
        editors.push("./src/client/app/"+n)
    })
    _.each(launchjson,function(n){
        launchs.push("./src/client/app/"+n)
    })

     _.each(codejson,function(n){
        codes.push("./src/client/app/"+n)
    })
     var b = browserify({
        entries: "./src/client/index.js",
        debug: true
    });

      gulp.task('client:clean', function() {
        return plugins.del(['./public/static']);
    });

     
    gulp.task('client:sharedb', function() {
        return b
            .bundle()

            //Pass desired output filename to vinyl-source-stream
            .pipe(source('sharedb.js'))
            // Start piping stream to tasks!
            .pipe(gulp.dest('./public/static/js/'));
    });

    gulp.task('client:editor',function() {

        gulp.src(editors)
            .pipe(plugins.concat('editor.js'))
            .pipe(gulp.dest('./public/static/js/'));
    });

    gulp.task('client:launch',function() {

        gulp.src(launchs)
            .pipe(plugins.concat('launch.js'))
            .pipe(gulp.dest('./public/static/js/'));
    });

     gulp.task('client:code',function() {

        gulp.src(codes)
            .pipe(plugins.concat('code-editor.js'))
            .pipe(gulp.dest('./public/static/js/'));
    });

    gulp.task('client:watch', function() {
        // Compile LESS files
         gulp.watch('./src/client/app/**/*.js', ['client:build']);

        // gulp.watch([
        //     './src/client/app/**/*.js'

        // ]).on('change', plugins.browserSync.reload);
    });
    gulp.task("client:build",['client:editor','client:launch','client:code'],function(){
        plugins.browserSync.reload()
    })

    gulp.task('client:start',['client:clean','client:editor','client:launch','client:code','client:sharedb'], function() {
        plugins.browserSync.init({
            proxy: "http://192.168.1.103:4444/"
        });
    });

    // gulp.task('serve:start', function() {
    //     return plugins.browserSync.init({
    //         server : (plugins.util.env.root || 'app'),
    //         port   : (plugins.util.env.port || 9000),
    //     });
    // });

};
