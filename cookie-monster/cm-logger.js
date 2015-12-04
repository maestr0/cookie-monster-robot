var Config = require('./cm-config');

var winston = require('winston');
require('winston-loggly');
winston.level = Config.logLevel;

winston.add(winston.transports.Loggly, {
    token: process.env.LOGGY_TOKEN,
    subdomain: "maestr0",
    tags: ["cookie-monster"],
    json: true,
    isBulk: true,
    level: Config.logLevel
});

winston.add(winston.transports.File, {filename: 'cookie.log'});

module.exports = winston;