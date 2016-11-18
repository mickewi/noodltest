define({
    inputs: {
        weatherForecastCollection: 'collection',
        daysCollection: 'collection',
        lon: 'number',
        lat: 'number',
        suncalcLoaded: 'boolean',
        locationUpdated: 'boolean',
        gotWeatherData: 'boolean'
    },
    outputs: {
        analysisStarted: 'boolean',
        eventsDetected: 'boolean'
    },
    setup: function(inputs, outputs) {

        var self = this;
        self.historicalRequested = [];
        this.LogTag = 'EventDetector';
        this.subscribingToWeather = false;
        this.subscribingToDays = false;
        this.hasLocation = false;

        this.tryToDetectEvents = function()
        {
            if(self.hasLocation === false)
            {
                console.log(self.LogTag, 'No location lock yet. Cancel event detection for now.');
                return;
            }

            if(inputs.suncalcLoaded === false)
            {
                console.log(self.LogTag, 'SunCalc not loaded. Cancel event detection for now.');
                return;
            }
            
            if(inputs.weatherForecastCollection === undefined ||inputs.daysCollection === undefined)
            {
                console.log(self.LogTag, 'Collections undefined, cancel event detection for now.', 'Weather', inputs.weatherForecastCollection, 'days', inputs.daysCollection);
                return;
            }

            if(inputs.weatherForecastCollection.size() === 0 || inputs.daysCollection.size() === 0)
            {
                console.log(self.LogTag, 'Collections empty, cancel event detection for now.', 'Weather', inputs.weatherForecastCollection.size(), 'days', inputs.daysCollection.size());
                return;
            }

            self.detectEvents();
        };

        this.calculateSuneventScore = function(forecastItem)
        {
            var windScore = Math.max(0,(1.0 - forecastItem.get('windSpeed')*0.5));
            var cloudScore = 1.0 - 2.0 * Math.abs(0.5 - forecastItem.get('cloudiness'));
            var humidityScore = Math.max(0,(1.0 - forecastItem.get('humidity')*0.5));

            var score = (windScore + cloudScore + humidityScore) / 3.0;

            return {
                score: score,
                debugText: "windSpeed: " + forecastItem.get('windSpeed').toFixed(2) + "\nwindScore " + windScore.toFixed(2) + "\ncloudScore " + cloudScore.toFixed(2) + "\nhumidityScore" + humidityScore.toFixed(2) + "\nTotal " + score.toFixed(2)
            }
        };

        this.calculateStarryNightScore = function(forecastItem)
        {
            var cloudScore = Math.max(0, 1.0 - forecastItem.get('cloudiness')*4.0);
            var humidityScore = Math.max(0,(1.0 - forecastItem.get('humidity')*0.5));
            var score = cloudScore* humidityScore;
            return {
                    score: score,
                    debugText:"cloudScore " + cloudScore.toFixed(2) + "\nhumidityScore " + humidityScore.toFixed(2) + "\nTotal " + score.toFixed(2)
                }
        };

        this.calculateRainbowScore = function(forecastItem)
        {
            var cloudWeight = 1.0;
            var rainWeight = 3.0;
            var cloudScore = Math.max(0, -2.0 * forecastItem.get('cloudiness'));
            var rainScore = forecastItem.get('drizzleRainProbability');
            var score = (cloudWeight * cloudScore + rainWeight * rainScore)/(cloudWeight + rainWeight);

            return {
                    score: score,
                    debugText:"cloudScore " + cloudScore.toFixed(2) + "\nrainScore " + rainScore.toFixed(2) + "\nCloudiness: " + forecastItem.get('cloudiness').toFixed(2) + "\nTotal " + score.toFixed(2)
                }
        };

        this.getForecastModelForTime = function(dateTime)
        {
            for(var i = 0; i < inputs.weatherForecastCollection.size(); ++i)
            {
                var forecastModelItem = inputs.weatherForecastCollection.get(i);
                var forecastStart = forecastModelItem.get('startTime');
                var forecastEnd = forecastModelItem.get('endTime');

                if(dateTime.getTime() >= forecastStart.getTime() && dateTime.getTime() < forecastEnd.getTime())
                {
                    return forecastModelItem;
                }
            }
            return null;
        };

        this.getEvent = function(eventCollection, type){
            for(var i = 0; i< eventCollection.size(); ++i)
            {
                var event = eventCollection.get(i);
                if(event.get('Type') === type)
                {
                    return event;
                }
            }
            return null;
        };

        this.detectEvents = function()
        {
            self.sendSignalOnOutput('analysisStarted');
            var detectedEvent = false;
            var now = new Date(Date.now());

            function addOrUpdateEvent(collection, data)
            {
                var eventModel = self.getEvent(collection, data["Type"]);
                if(eventModel === null){
                    eventModel = Noodl.Model.create(data);
                    collection.add(eventModel);
                } else {
                    eventModel.setAll(data);                    
                }
                detectedEvent = true;
            }

            function checkForEvent(args)
            {
                var model = self.getForecastModelForTime(args.time);
                var debugText = '';
                var score = -1.0;
                if(model !== null)
                {
                    var result = args.scoreFunction(model);
                    score = result.score;
                    if(Application.instance.context.runningInEditor) {
                        debugText = result.debugText;
                    }
                } else {

                    console.log(self.LogTag, 'Failed to find forecast for ' + args.type + ' at ' + args.time, inputs.weatherForecastCollection.size());
                    if(self.historicalRequested.indexOf(args.time.getTime()) === -1 && args.time < now){
                        self.historicalRequested.push(args.time.getTime());
                        console.log('requesting historical', args.time);
                        Noodl.eventEmitter.emit("Get Historical Weather", {
                            Time: Math.floor(args.time.getTime() / 1000)
                        });
                    }
                }

                if(score >= args.scoreThreshold){
                    return {
                        "TimeHour": args.time.getHours(),
                        "TimeMin": args.time.getMinutes(),
                        "Type": args.type,
                        "Score": score,
                        "Event Parameters": {"Score":score},
                        "DateTime": args.time,
                        "Debug Text": debugText
                    };
                }
                return null;
            }

            for(var dayIndex = 0; dayIndex < inputs.daysCollection.size(); ++dayIndex) {

                var dayModel = inputs.daysCollection.get(dayIndex);
                var eventsCollectionId = dayModel.get('EventCollectionId');
                var eventCollection = Noodl.Collection.get(eventsCollectionId);
                
                var times = window.SunCalc.getTimes(dayModel.get("Date Time"), inputs.lat, inputs.lon);

                var sunriseEvent = checkForEvent({type: "Sunrise",
                                                  scoreFunction: self.calculateSuneventScore,
                                                  time: times.sunrise,
                                                  scoreThreshold: -1});

                addOrUpdateEvent(eventCollection, sunriseEvent);
                
                var rainbowMorningTime = times.rainbowMorning;
                rainbowMorningTime.setMinutes(times.rainbowMorning.getMinutes() - 30);
                var rainbowMorningEvent = checkForEvent({ type: "Rainbow",
                                                            time: rainbowMorningTime,
                                                            scoreFunction: self.calculateRainbowScore,
                                                            scoreThreshold: -1
                                                        });

                var rainbowEveningTime = times.rainbowEvening;
                rainbowEveningTime.setMinutes(rainbowEveningTime.getMinutes() + 30);
                var rainbowEveningEvent = checkForEvent({ type: "Rainbow",
                                            time: rainbowEveningTime,
                                            scoreFunction: self.calculateRainbowScore,
                                            scoreThreshold: -1
                                        });

                var highestRanikingRainbowEvent = (rainbowMorningEvent.Score > rainbowEveningEvent.Score) ? rainbowMorningEvent : rainbowEveningEvent;

                if(highestRanikingRainbowEvent.Score >= 0.75){
                    addOrUpdateEvent(eventCollection, highestRanikingRainbowEvent);
                }

                var sunsetEvent = checkForEvent({type: "Sunset",
                                                 scoreFunction: self.calculateSuneventScore,
                                                 time: times.sunsetStart,
                                                 scoreThreshold: -1});

                addOrUpdateEvent(eventCollection, sunsetEvent);

                var moonIllumination = window.SunCalc.getMoonIllumination(times.dusk);
                if(moonIllumination.fraction > 0.99)
                {
                     addOrUpdateEvent(eventCollection, {
                        "TimeHour": times.dusk.getHours(),
                        "TimeMin": times.dusk.getMinutes(),
                        "Type": "Fullmoon",
                        "Event Parameters": {"Month Index":times.dusk.getMonth(),
                        "DateTime": times.dusk}
                    });
                } else {
                    var starryNightEvent = checkForEvent({ type: "Starry Night",
                                                            time: times.dusk,
                                                            scoreFunction: self.calculateStarryNightScore,
                                                            scoreThreshold: 0.75
                                                        });
                    if(starryNightEvent !== null) {
                        addOrUpdateEvent(eventCollection, starryNightEvent);
                    }
                }
            }

            if(detectedEvent === true)
            {
                self.sendSignalOnOutput('eventsDetected');
            }
        }
    },
    run: function(inputs, outputs) {

        var self = this;

        if(inputs.gotWeatherData === true) {
            console.log('gotWeatherData', inputs.weatherForecastCollection.size());
        }

        if(inputs.locationUpdated === true)
        {
            self.hasLocation = true;
        }

        if(inputs.weatherForecastCollection !== undefined && this.subscribingToWeather === false)
        {
            self.subscribingToWeather = true;
            //inputs.weatherForecastCollection.on('add', self.tryToDetectEvents);
        }

        if(inputs.daysCollection !== undefined && this.subscribingToDays === false)
        {
            self.subscribingToDays = true;
            //inputs.daysCollection.on('add', self.tryToDetectEvents);
            /*inputs.daysCollection.on('change', function(){
                self.tryToDetectEvents();
            });*/
        }

        this.tryToDetectEvents(); // in case models are already populated;
    }
});
