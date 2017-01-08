module.exports = {
  init: function(app, middleware, config) {
    // Home page for the application
    app.get("/",
      middleware.clearRedirects,
      middleware.setUserIfTokenExists,
      require("./homepage").bind(app, config));

  }
};
