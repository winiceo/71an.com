module.exports = {
    init: function (app, middleware, backend, config) {

        app.post("api/channel/active",
            require("./active").bind(app, backend, config));



    }
};
