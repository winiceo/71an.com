'use strict';
var spawn = require('child_process').spawn,
    node;
/**
 * Live reload server.
 */
module.exports = function(gulp, plugins) {


    gulp.task('serve:start', function() {
        if (node) node.kill()
        node = spawn('node', ['./src/server/index.js'], {stdio: 'inherit'})
        node.on('close', function (code) {
            if (code === 8) {
                gulp.log('Error detected, waiting for changes...');
            }
        });
    })

    gulp.task('serve:watch', function() {
        // // Compile LESS files
        // gulp.watch('app/styles/**/*.less', ['less']);
        //
        // gulp.watch([
        //     'app/**/*.html',
        //     'app/scripts/**/*.js',
        //     'app/locales/**/*.json',
        // ]).on('change', plugins.browserSync.reload);

        gulp.watch(['./src/server/**/*.js','./src/template/*'], function() {
            gulp.run('serve:start')
        })
    });



};
