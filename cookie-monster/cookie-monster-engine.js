var sys = require('sys');
var exec = require('exec-queue');
var Slack = require('slack-client');
var Config = require('./cm-config');
var logger = require('./cm-logger');

var CM = {
    speechQueue: [],
    buzzerQueue: [],
    audioQueue: [],
    moveQueue: [],
    lcdQueue: [],
    remoteCommands: [],
    detectSound: 0,
    isUnMuted: Config.isUnMuted,
    slack: new Slack(Config.slack.slackToken, Config.slack.autoReconnect, Config.slack.autoMark),

    work: function () {
        this.led.turnOn();
        this.bind();
        this.initWifi();
        this.initServos();
        this.initVoiceSynthesizer();
        this.initBuzzerWorker();
        this.initMoveWorker();
        this.initAudioPlayerWorker();
        this.initSlack();
        this.initSlackCommands();

        this.beep(700);
        this.beep(200);
        this.beep(200);

        this.log("CM start ok! " + new Date());
        this.writeMessage("start OK", "blue");
    },

    initSlackCommands: function () {

        var self = this;

        const ADMIN_ONLY = true;
        const EVERYONE_CAN_RUN = false;
        const WITH_PARAMS = true;
        const NO_PARAMS = false;

        this.bindSlackCommand("mute", "Mute all sounds", NO_PARAMS, EVERYONE_CAN_RUN, function (message, callback) {
            self.writeMessage("Muted", "red");
            self.isUnMuted = false;
            callback("I will shut up ;(");
        });

        this.bindSlackCommand("unmute", "Un-mute all sounds", NO_PARAMS, EVERYONE_CAN_RUN, function (message, callback) {
            self.writeMessage("Un-muted", "blue");
            self.isUnMuted = true;
            self.say("Cookies");
            callback(":)");
        });

        this.bindSlackCommand("playlist", "List all available audio files", NO_PARAMS, EVERYONE_CAN_RUN, function (message, callback) {
            self.listAudioFiles(callback)
        });

        this.bindSlackCommand("connect speaker", "Connect BT speaker", NO_PARAMS, ADMIN_ONLY, function (message, callback) {
            self.connectSpeaker(callback)
        });

        this.bindSlackCommand("dance", "Let's dance!", NO_PARAMS, EVERYONE_CAN_RUN, function (message, callback) {
            self.dance();
            callback("Let's dance!");
        });

        this.bindSlackCommand("lunch lunch", "Cookie time!", NO_PARAMS, EVERYONE_CAN_RUN, function (message, callback) {
            self.say("Lunch, lunch, lunch. Stop working, let's eat some cookies!");
            callback("I'm hungry. I would eat a cookie.");
        });

        this.bindSlackCommand("help", "Show available commands", NO_PARAMS, EVERYONE_CAN_RUN, function (message, callback) {
            var commands = "";
            for (var index in self.remoteCommands) {
                var cmd = self.remoteCommands[index];
                commands += "\n`" + cmd.phrase + "` - " + cmd.description + (cmd.admin ? "    `[admin only]`" : "");
            }
            callback("```WARNING!!! every interaction with CM is logged. Enjoy ;)```\n\nAvailable commands: " + commands);
        });

        this.bindSlackCommand("update audio", "Update audio library from GIT", NO_PARAMS, ADMIN_ONLY, function (message, callback, params) {
            var cmd = "cd " + Config.scriptLocation + " && git pull";
            exec(cmd, function (err, out, code) {
                if (out) callback(out);
                if (err) callback(err);
                if (code) callback(code);
            });
        });

        this.bindSlackCommand("execute", "Run shell command", WITH_PARAMS, ADMIN_ONLY, function (message, callback, params) {
            exec(params, function (err, out, code) {
                if (out) callback(out);
                if (err) callback(err);
                if (code) callback(code);
            });
        });

        this.bindSlackCommand("play", "Play audio file", WITH_PARAMS, EVERYONE_CAN_RUN, function (message, callback, params) {
            self.audioQueue.push(params);
            callback("Playing " + params);
        });

        this.bindSlackCommand("say", "Text To Speech", WITH_PARAMS, EVERYONE_CAN_RUN, function (message, callback, params) {
            self.say(params);
            callback("Got it!");
        });

        this.bindSlackCommand("config", "Update config", WITH_PARAMS, ADMIN_ONLY, function (message, callback, params) {
            var cfg = params.split(" ");
            Config[cfg[0]] = cfg[1];
            config("Config updated\n" + JSON.stringify(Config));
        });

        this.bindSlackCommand("show config", "Show config", NO_PARAMS, ADMIN_ONLY, function (message, callback) {
            callback("Config:\n" + JSON.stringify(Config));
        });

        this.bindSlackCommand("move", "Move body. Coma separated list of integers 0-10. DELAY is 0-2000 milliseconds. " +
            "HEAD, BODY, LEFT_HAND, RIGHT_HAND, DELAY. Example: `move 10,4,8,5,500`", WITH_PARAMS, EVERYONE_CAN_RUN, function (message, callback, params) {
            self.moveQueue.push(params);
            callback("Got it!");
        });
    },

    bindSlackCommand: function (phrase, description, withParams, admin, job) {
        const startWith = function (string, startWith) {
            return string.substr(0, startWith.length) === startWith;
        };

        var cmd = {
            execute: job,
            phrase: phrase,
            description: description,
            admin: admin,
            isValidCommand: function (msg) {
                return withParams ? startWith(msg, cmd.phrase) : msg === cmd.phrase;
            }
        };
        this.remoteCommands.push(cmd);
    },

    processSlackMessage: function (msg, isAdmin, callback) {
        const removePrefix = function (string, prefix) {
            return string.substr(prefix.length, string.length).trim();
        };

        for (var i = 0; i < this.remoteCommands.length; i++) {
            var command = this.remoteCommands[i];
            if (command.isValidCommand(msg, isAdmin)) {
                if (command.admin && isAdmin == false) {
                    callback("Who you are to give me orders?!");
                } else {
                    var params = removePrefix(msg, command.phrase).trim();
                    command.execute(msg, callback, params);
                }
                return;
            }
        }

        callback("I don't know what you want ;( Say `help` for help.");
    },

    listAudioFiles: function (callback) {
        var cmd = "ls " + Config.scriptLocation + "audio";
        exec(cmd, function (err, out, code) {
            callback(out);
        });

    },
    connectSpeaker: function (callback) {
        var cmd = "ls " + Config.scriptLocation + "bluetooth_speaker.sh";
        exec(cmd, function (err, out, code) {
            callback(out);
        });

    },

    moveWorker: function () {
        var my = this;
        if (this.moveQueue.length !== 0) {
            var msg = this.moveQueue.shift();
            this.performMove(msg, function () {
                // re-schedule worker
                setTimeout(my.moveWorker, Config.moveWorkerInterval);
            });
        } else {
            // re-schedule worker
            setTimeout(my.moveWorker, Config.moveWorkerInterval);
        }
    },

    performMove: function (command, callback) {
        var my = this;
        my.debug("Move " + command);
        const moves = command.split(",");
        if (moves && moves.length === 5) {
            my.blockSoundDetection();
            my.debug(moves[0], moves[1], moves[2], moves[3], moves[4]);
            this.servos.setPWM(Config.servos.pins.head, 0, (parseInt(moves[0])).fromScale(0, 10).toScale(Config.servos.ranges.min, Config.servos.ranges.max));
            this.servos.setPWM(Config.servos.pins.body, 0, (parseInt(moves[1])).fromScale(0, 10).toScale(Config.servos.ranges.min, Config.servos.ranges.max));
            this.servos.setPWM(Config.servos.pins.leftHand, 0, (parseInt(moves[2])).fromScale(0, 10).toScale(Config.servos.ranges.min, Config.servos.ranges.max));
            this.servos.setPWM(Config.servos.pins.rightHand, 0, (parseInt(moves[3])).fromScale(0, 10).toScale(Config.servos.ranges.min, Config.servos.ranges.max));

            this.screen.setColor((parseInt(moves[1])).fromScale(0, 10).toScale(0, 255),
                (parseInt(moves[2])).fromScale(0, 10).toScale(0, 255),
                (parseInt(moves[3])).fromScale(0, 10).toScale(0, 255));
            this.screen.clear();

            setTimeout(function () {
                my.releaseSoundDetection();
                callback();
            }, Config.moveDuration + parseInt(moves[4]));
        } else {
            my.log("Incorrect command");
            callback();
        }
    },

    initWifi: function () {
        var my = this;
        after((10).seconds(), function () {
            exec("configure_edison --showWiFiIP", function (err, out, code) {
                my.writeMessage("WIFI OK         IP " + out.trim(), "green");
            });
        });
    },

    speechWorker: function () {
        var my = this;
        this.led.turnOff();
        if (this.speechQueue.length !== 0) {
            this.blockSoundDetection();
            var msg = this.speechQueue.shift();
            this.led.turnOn();
            this.runVoiceSynthesizer(msg, function (err, out, code) {
                my.releaseSoundDetection();
                setTimeout(my.speechWorker, Config.voiceSynthesizerWorkerInterval);
            });
        } else {
            setTimeout(my.speechWorker, Config.voiceSynthesizerWorkerInterval);
        }
    },

    audioPlayerWorker: function () {
        var my = this;
        if (this.audioQueue.length !== 0) {
            this.blockSoundDetection();
            var audioFile = this.audioQueue.shift();
            this.executeAudioPlayer(audioFile, function (err, out, code) {
                if (out) my.debug(out);
                if (err) my.error(err);
                if (code) my.debug(code);

                my.releaseSoundDetection();
                setTimeout(my.audioPlayerWorker, Config.audioWorkerInterval);
            });
        } else {
            setTimeout(my.audioPlayerWorker, Config.audioWorkerInterval);
        }
    },

    bind: function () {
        var my = this;
        var ignoreSoundDetection = false;
        my.sound.on("upperLimit", function (amplitude) {
            if (Config.isSoundDetectionEnabled && ignoreSoundDetection === false && my.detectSound === 0) {
                ignoreSoundDetection = true;
                my.debug("sound amplitude = " + amplitude);
                my.soundDetected();
                setTimeout(function () {
                    my.debug("reset ignoreSoundDetection");
                    ignoreSoundDetection = false;
                }, Config.soundDetectionBreakDuration);
            } else {
                my.ignoreSoundDetection = true;
                setTimeout(function () {
                    ignoreSoundDetection = false;
                }, Config.soundDetectionPauseDuration);
            }
        });

        my.buttonLeft.on('push', function () {
            var item = my.sayings[Math.floor(Math.random() * my.sayings.length)];
            my.beep();
            my.say(item);
        });

        my.buttonRight.on('push', function () {
            my.beep();
            my.audioQueue.push("cookie");
        });

        var ignoreProximityDetection = false;
        my.proximity.on('lowerLimit', function (val) {
            if (Config.isProximityDetectionEnabled && ignoreProximityDetection === false) {
                ignoreProximityDetection = true;
                my.objectWithinRangeAction();
                setTimeout(function () {
                    my.debug("reset ignoreProximityDetection");
                    ignoreProximityDetection = false;
                }, Config.proximityDetectionBreakDuration);
            }
        });
    },

    objectWithinRangeAction: function () {
        this.say("you didn't wash your hands");
    },

    initMoveWorker: function () {
        this.moveWorker();
    },

    initVoiceSynthesizer: function () {
        this.speechWorker();
    },

    initAudioPlayerWorker: function () {
        this.audioPlayerWorker();
    },

    runVoiceSynthesizer: function (msg, callback) {
        if (this.isUnMuted) {
            var cmd = Config.scriptLocation + "speak-cm.sh " + Config.audioVolume + " \"" + msg.replace(/"/g, "") + "\"";
            this.debug("executing: " + cmd);
            exec(cmd, callback);
        } else {
            callback(null, "Muted", null);
        }
    },

    executeAudioPlayer: function (filename, callback) {
        // TODO: add check if file exists
        var my = this;
        if (this.isUnMuted) {
            var cmd = Config.scriptLocation + "playAudio.sh " + Config.audioVolume + " " + Config.scriptLocation + "audio/" + filename;
            my.debug("executing: " + cmd);
            exec(cmd, callback);
        } else {
            callback(null, "Muted", null);
        }
    },

    say: function (msg) {
        this.speechQueue.push(msg);
    },

    blockSoundDetection: function () {
        this.detectSound++;
    },

    slackMessageProcessor: function (message) {
        var makeMention = function (userId) {
            return '<@' + userId + '>: ';
        };

        var isDirect = function (userId, messageText) {
            var userTag = makeMention(userId);
            return messageText &&
                messageText.length >= userTag.length &&
                messageText.substr(0, userTag.length) === userTag;
        };

        var removePrefix = function (string, prefix) {
            return string.substr(prefix.length, string.length).trim();
        };

        function isAdmin() {
            return message.user.indexOf(Config.slack.adminId) !== -1;
        }

        if (message.text) {
            var channel = this.slack.getChannelGroupOrDMByID(message.channel);
            var trimmedMessage = removePrefix(message.text, makeMention(this.slack.self.id));

            if (message.type === 'message' && isDirect(this.slack.self.id, message.text)) {
                this.debug({
                    "slack_message": message.text,
                    from: message.user,
                    channel: message.channel
                });
                this.processSlackMessage(trimmedMessage, isAdmin(), function (msg) {
                    channel.send(msg);
                });
            }
        }
    },

    releaseSoundDetection: function () {
        this.detectSound--;
    },

    buzzerWorker: function () {
        var my = this;
        if (this.buzzerQueue.length !== 0) {
            this.blockSoundDetection();
            var interval = this.buzzerQueue.shift();
            if (this.isUnMuted) {
                setTimeout(function () {
                    my.buzzer.digitalWrite(1);
                }, 50);

                setTimeout(function () {
                    my.buzzer.digitalWrite(0);
                    setTimeout(function () {
                        my.releaseSoundDetection();
                    }, 100);
                    setTimeout(my.buzzerWorker, Config.buzzerWorkerInterval);
                }, interval + 50);
            }
        } else {
            setTimeout(this.buzzerWorker, Config.buzzerWorkerInterval);
        }
    },

    initBuzzerWorker: function () {
        this.buzzerWorker();
    },

    beep: function (interval) {
        if (!interval) {
            interval = Config.buzzerDefaultLength;
        }
        this.buzzerQueue.push(interval);
    },

    soundDetected: function () {
        var my = this;
        my.writeMessage("I hear something", "blue");
        my.say("Stop making noise");
        setTimeout(function () {
            my.clearLCD();
        }, Config.soundDetectionBreakDuration);
    },

    clearLCD: function () {
        this.screen.clear();
    },

    debug: function (msg) {
        if (Config.isDevMode) {
            logger.log('debug', msg);
        }
    },

    log: function (msg) {
        logger.log('info', msg);
    },

    error: function (msg) {
        logger.log('error', msg);
    },

    writeMessage: function (message, color) {
        var my = this;
        var line1 = message.toString().trim();
        while (line1.length < 16) {
            line1 = line1 + " ";
        }

        this.debug("write LCD msg: " + message);
        my.screen.clear();
        my.screen.setCursor(0, 0);
        my.screen.home();
        my.screen.write(line1);
        if (line1.length > 16) {
            var line2 = line1.substring(16);
            my.screen.setCursor(1, 0);
            my.screen.write(line2);
        }

        switch (color) {
            case "red":
                my.screen.setColor(255, 0, 0);
                break;
            case "green":
                my.screen.setColor(0, 255, 0);
                break;
            case "blue":
                my.screen.setColor(0, 0, 255);
                break;
            default:
                my.screen.setColor(255, 255, 255);
                break;
        }
    },

    name: Config.name,

    sayings: Config.sayings,

    connections: {
        edison: {
            adaptor: "intel-iot"
        }
    },

    devices: {
        buttonLeft: {
            driver: 'button',
            pin: 2
        },
        buzzer: {
            driver: "direct-pin",
            pin: 7,
            connection: "edison"
        },
        buttonRight: {
            driver: 'button',
            pin: 8
        },
        led: {
            driver: 'led',
            pin: 13
        },
        proximity: {
            driver: 'analog-sensor',
            pin: 0,
            lowerLimit: 50,
            upperLimit: 100
        },
        sound: {
            driver: "analog-sensor",
            pin: 1,
            connection: "edison",
            upperLimit: Config.soundDetectionThreshold
        },
        servos: {
            driver: 'pca9685'
        },
        screen: {
            driver: "upm-jhd1313m1",
            connection: "edison"
        }
    },

    dance: function () {
        this.blockSoundDetection();
        var song = Config.dancePlaylist[Math.floor(Math.random() * Config.dancePlaylist.length)];
        this.audioQueue.push(song);
        for (var i = 0; i < 20; i++) {
            var sequence = (Math.random() * 10) + "," + (Math.random() * 10) + "," + (Math.random() * 10) + "," + (Math.random() * 10) + "," + (Math.random() * 100);
            this.moveQueue.push(sequence);
        }
    },

    initServos: function () {
        // set the frequency to 50hz
        this.servos.setPWMFreq(50);
        var position = (50).fromScale(0, 100).toScale(Config.servos.ranges.min, Config.servos.ranges.max);
        // center servos
        this.servos.setPWM(Config.servos.pins.body, 0, position);
        this.servos.setPWM(Config.servos.pins.head, 0, position);
        this.servos.setPWM(Config.servos.pins.leftHand, 0, position);
        this.servos.setPWM(Config.servos.pins.rightHand, 0, position);
    },


    initSlack: function () {
        var my = this;
        this.slack.on('message', function (message) {
            if (message.type === 'message' && message.text) {
                my.slackMessageProcessor(message);
            } else {
                my.debug(message);
            }
        });

        this.slack.on('error', function (err) {
            my.error("Slack Error: " + JSON.stringify(err));
        });

        this.slack.on('open', function () {
            my.log("Connected to " + my.slack.team.name + " as @" + my.slack.self.name);
            my.writeMessage("Slack OK", "red");
            my.beep(200);
        });
        this.slack.login();
    }
};

module.exports = CM;