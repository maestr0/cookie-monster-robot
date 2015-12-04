var Config = {
    name: "Cookie Monster",
    buzzerWorkerInterval: 200,
    buzzerDefaultLength: 200,
    soundDetectionThreshold: 700,
    soundDetectionBreakDuration: 5000,
    soundDetectionPauseDuration: 500,
    voiceSynthesizerWorkerInterval: 500,
    moveWorkerInterval: 500,
    audioWorkerInterval: 500,
    audioWorkerBreakDuration: 1000,
    moveDuration: 300,
    isUnMuted: true,
    isSoundDetectionEnabled: true,
    isProximityDetectionEnabled: false,
    proximityDetectionBreakDuration: 5000,
    isDevMode: true,
    logLevel: 'debug',
    scriptLocation: "/home/root/git/intel-edison/",
    startAPI: false,
    dancePlaylist: ["waiting_for_tonight", "coco", "dunalli", "dil_doooba"],
    audioVolume: 2,
    servos: {
        "pins": {
            "head": 0,
            "body": 3,
            "leftHand": 15,
            "rightHand": 11
        },
        "ranges": {
            "min": 150,
            "max": 600
        }
    },
    slack: {
        slackToken: process.env.SLACK_TOKEN,
        autoReconnect: true,
        autoMark: true,
        adminId: "U026P8Q1D"
    },
    sayings: ["I would do anything for a cookie.",
        "Lunch time. Lunch alert. Lunch alert",
        "C is for Cookie and cookie is for me!"
    ]
};

module.exports = Config;