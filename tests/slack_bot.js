var Slack = require('slack-client');
var exec = require('child_process').exec;

var Config = {
    slack: {
        slackToken: process.env.SLACK_TOKEN,
        autoReconnect: true,
        autoMark: true
    }
};

var slack = new Slack(Config.slack.slackToken, Config.slack.autoReconnect, Config.slack.autoMark);


var makeMention = function (userId) {
    return '<@' + userId + '>: ';
};

var isDirect = function (userId, messageText) {
    var userTag = makeMention(userId);
    return messageText &&
        messageText.length >= userTag.length &&
        messageText.substr(0, userTag.length) === userTag;
};

slack.on('message', function (message) {
    var channel = slack.getChannelGroupOrDMByID(message.channel);
    var user = slack.getUserByID(message.user);

    if (message.type === 'message' && isDirect(slack.self.id, message.text)) {
        var trimmedMessage = message.text.substr(makeMention(slack.self.id).length).trim();
        if (trimmedMessage.substr(0, "execute ".length) === "execute ") {
            var cmd = trimmedMessage.substr("execute ".length, trimmedMessage.length);
            exec(cmd, function(err, out, code){
                channel.send(out);
            });
        } else {
            console.log(message);
            channel.send("Echo " + trimmedMessage);
        }
    }
});

slack.on('error', function (err) {
    console.error("Error", err);
});

slack.on('open', function (err) {
    console.log("Connected to " + slack.team.name + " as @" + slack.self.name);
});

slack.login();
