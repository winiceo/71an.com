'use strict';
var spawn = require('child_process').spawn,
    node;


var json=require("./src/client/file.json")    
/**
 * Live reload server.
 */
module.exports = function(gulp, plugins) {


    gulp.task('js', function() {
        gulp.src("./src/client/sharedb.js")
             
            .pipe(order(json, { base: './src/client/app/' }))
            .pipe(concat('editor.js'))
            //.pipe(uglify({mangle: false}))
            .pipe(gulp.dest('./public/assets/js/'));
    });
    gulp.task('client:watch', function() {
        // Compile LESS files
        //gulp.watch('app/styles/**/*.less', ['less']);

        gulp.watch([
            './src/client/app'
           
        ]).on('change', [js,plugins.browserSync.reload]);
    });

    gulp.task('client:start', function() {
        browserSync.init({
            proxy: "http://localhost:444"
        });
    });

    // gulp.task('serve:start', function() {
    //     return plugins.browserSync.init({
    //         server : (plugins.util.env.root || 'app'),
    //         port   : (plugins.util.env.port || 9000),
    //     });
    // });

};
