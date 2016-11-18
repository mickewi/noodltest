define({
    inputs: {
        dateTime: 'object',
        latitude: 'number'
    },
    outputs: {
        elevation: 'number'
    },
    run: function(inputs, outputs) {
        if(inputs.dateTime)
        {
            var latitudeRadians = inputs.latitude * Math.PI / 180;
            var julian = Math.floor((inputs.dateTime / 86400000) - (inputs.dateTime.getTimezoneOffset()/1440) + 2440587.5);
             
            var solarTime = Math.PI/12*(inputs.dateTime.getHours()-12
                + 0.17 * Math.sin(4 * Math.PI * (julian - 80) / 373)
                - 0.129 * Math.sin(2 * Math.PI * (julian - 8) / 355));
             
            var declination = 0.4093 * Math.sin(2 * Math.PI * (julian - 81) / 368);
            var zenith = Math.acos(Math.sin(latitudeRadians)*Math.sin(declination) + Math.cos(latitudeRadians)*Math.cos(declination)*Math.cos(solarTime));
            var azimuth = solarTime;

            outputs.elevation = Math.PI / 2 - zenith;
        }
    }
});