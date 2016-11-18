define({
    inputs: {
        hax: 'boolean',
        numDays: 'number',
        daysCollection: 'collection'
    },
    outputs: {
        daysUpdated: 'boolean'
    },
    setup: function(){
        this.hasCreatedDays = false;
    },
    run: function(inputs, outputs) {

        if(window.hasOwnProperty("getNiceDate") === false) {
            return;
        }

        if(inputs.daysCollection === undefined) {
            return;
        }

        if(this.hasCreatedDays) {
            return;
        }

        var date = new Date();
        var niceDate = '';
        
        for(var i = 0; i < inputs.numDays; ++i)
        {
            if(i === 0){
                niceDate = 'Today'
            } else if(i === 1){
                niceDate = 'Tomorrow'
            } else {
                if(window.hasOwnProperty("getNiceDate") === true) {
                    niceDate = window.getNiceDate(date);
                } else {
                    console.log("tried to access window.getNiceDate from get-days before it was loaded", date);
                    niceDate = "<A day>";
                }
            }

            var dateTime = new Date(date);

            var model = Noodl.Model.create({
                "Date": niceDate,
                "EventCollectionId": "Events" + i,
                "Date Time": dateTime
            });
            inputs.daysCollection.add(model);

            date.setDate(date.getDate() + 1);
        }
        this.hasCreatedDays = true;
    }
});