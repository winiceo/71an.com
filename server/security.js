"use strict";

let helmet = require("helmet");
let csurf = require("csurf");

const ONE_YEAR = 31536000000;

let defaultCSPDirectives = {
  defaultSrc: [ "'self'" ],
  connectSrc: [
    "'self'",
    "https://pontoon.mozilla.org"
  ],
  frameSrc: [
    "'self'",
    "https://docs.google.com"
  ],
  childSrc: [
    "'self'",
    "https://pontoon.mozilla.org",
    "https://s3-eu-west-1.amazonaws.com"
  ],
  frameAncestors: [
    "https://pontoon.mozilla.org",
    "https://s3-eu-west-1.amazonaws.com"
  ],

  fontSrc: [ "*" ],
  imgSrc: [ "*" ],
  mediaSrc: [ "*" ],
  scriptSrc: ["*"],
  styleSrc: [
    "*"
  ]
};

function Security(server) {
  this.server = server;
}

Security.prototype = {
  csp(directiveList) {
    directiveList = directiveList || {};
    Object.keys(defaultCSPDirectives).forEach(function(directive) {
      let domainsToAdd = directiveList[directive];
      let defaultDomains = defaultCSPDirectives[directive];

      if(domainsToAdd && defaultDomains.indexOf("*") !== -1) {
        directiveList[directive] = domainsToAdd;
      } else {
        directiveList[directive] = defaultDomains.concat((domainsToAdd || []));
      }
    });

    this.server.use(helmet.contentSecurityPolicy({
      directives: directiveList
    }));

    return this;
  },
  ssl() {
    this.server.use(helmet.hsts({ maxAge: ONE_YEAR }));
    this.server.enable("trust proxy");

    return this;
  },
  xss() {
    this.server.use(helmet.xssFilter());
    return this;
  },
  mimeSniff() {
    this.server.use(helmet.noSniff());
    return this;
  },
  csrf() {
    this.server.use(csurf());
    return this;
  },
  xframe() {
    this.server.use(helmet.frameguard({ action: "DENY" }));
    return this;
  }
};

module.exports = Security;
