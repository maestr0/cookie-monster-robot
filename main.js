var Cylon = require('cylon');
var Config = require('./cookie-monster/cm-config');
var CM = require('./cookie-monster/cookie-monster-engine');

Cylon.config({
    logger: function (msg) {
        CM.log(msg);
    }
});


if (Config.startAPI) {

    Cylon.api({
        host: "0.0.0.0",
        port: "3000"
    })
}

Cylon.robot(CM)
    .on('error', CM.error)
    .start();
