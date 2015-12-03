var Cylon = require('cylon');

Cylon
    .robot({name: 'Sound sensor test'})
    .connection('edison', {adaptor: 'intel-iot'})
    .device('sensor', {driver: 'analogSensor', pin: 1, connection: 'edison', upperLimit: 700})
    .on('ready', function (my) {
        var sensorVal = 0;
        var ready = false;
        var canDetect = true;
        my.sensor.on("upperLimit", function (val) {
            if (canDetect) {
                canDetect = false;
                console.log("Upper limit reached ===> " + val);
                setTimeout(function () {
                    canDetect = true;
                },5000);
            }
        });

    })
    .start();