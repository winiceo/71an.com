var config = require("./config");

// Content-fetching function used for generating the output
// on http://[...]/data routes via the index.rawData function.
function getPageData(req) {
    var content = "";
    if (req.pageData) {
        content = req.pageData;
        if (req.query.mode && req.query.mode === "remix") {
            content = content.replace(/<title([^>]*)>/, "<title$1>Remix of ");
        }
    }
    return content;
}

module.exports = function () {
    return {
        init: function (app, middleware, backend) {
            [


                require("./keditor"),
                require("./projects"),
                require("./assets"),
                require("./scenes"),
                require("./launch"),

            ].forEach(function (module) {
                module.init(app, middleware, backend, config);
            });
        },

        rawData: function (req, res) {
            res.type('text/plain; charset=utf-8');
            res.send(getPageData(req));
        }
    };
};
