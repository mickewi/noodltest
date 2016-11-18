define({
    inputs: {
        focusedItemId: 'string',
        screenShotRoot: 'reference',
        openShare: 'boolean'
    },
    outputs: {
        startedSharing: 'boolean'
    },
    run: function(inputs, outputs) {
        var self = this;

        self.share = function(eventModel, screenShotFilename) {

            var descriptionAndTitle = window.getDescriptionAndTitle(eventModel);

            var options = {
                message: "I'd like to share this " + descriptionAndTitle.title.toLowerCase() + " with you. Saida, the celestial events app has this to say about it:\n " + descriptionAndTitle.label,
                subject: descriptionAndTitle.title + ', ' + window.getNiceDate(eventModel.get('DateTime')),
                files: [screenShotFilename]
            };

            var onSuccess = function(result) {
                console.log("Share completed? " + result.completed);
                console.log("Shared to app: " + result.app);
            };

            var onError = function(msg) {
                console.log("Sharing failed with message: " + msg);
            };

            window.plugins.socialsharing.shareWithOptions(options, onSuccess, onError);
        };

        if(inputs.openShare === true )
        {
            var eventModel = Noodl.Model.get(inputs.focusedItemId);
            if(eventModel === null) {
                console.log('Sharing could not find model with id', inputs.focusedItemId);
                return;
            }

            var screenShotRootControl = inputs.screenShotRoot.getVisualRoot()._internal.uiControl;

            var screenWidth = screenShotRootControl.width;
            var screenHeight = screenShotRootControl.height;
            var maxFileSize = 4 * screenWidth * screenHeight;

            this.sendSignalOnOutput('startedSharing');
            console.log('started sharing', '' + screenWidth + ' x ' + screenHeight);

            window.requestFileSystem(window.TEMPORARY, maxFileSize, function (fs) {

                function dataURLToBlob(dataURL){
                    var BASE64_MARKER = ';base64,';
                    if (dataURL.indexOf(BASE64_MARKER) == -1) {
                        var parts = dataURL.split(',');
                        var contentType = parts[0].split(':')[1];
                        var raw = decodeURIComponent(parts[1]);

                        return new Blob([raw], {type: contentType});
                    }

                    var parts = dataURL.split(BASE64_MARKER);
                    var contentType = parts[0].split(':')[1];
                    var raw = window.atob(parts[1]);
                    var rawLength = raw.length;

                    var uInt8Array = new Uint8Array(rawLength);

                    for (var i = 0; i < rawLength; ++i) {
                        uInt8Array[i] = raw.charCodeAt(i);
                    }

                    return new Blob([uInt8Array], {type: contentType});
                }

                console.log('file system open: ' + fs.name);

                fs.root.getFile("saida-screenshot.png", { create: true }, function (fileEntry) {
                    console.log('created new file', fileEntry.name, fileEntry.fullPath, fileEntry);

                    fileEntry.createWriter(function (fileWriter) {

                        fileWriter.onwriteend = function() {
                            if(window.hasOwnProperty("plugins") && window.plugins.hasOwnProperty("socialsharing")){
                                self.share(eventModel, fileEntry.toURL());
                            }
                            console.log("Successful file write..." + fileEntry.toURL());
                        };

                        fileWriter.onerror = function(e) {
                            console.log("Failed file write: " + e.toString());
                        };

                        screenShotRootControl.visible = true;
                        var renderer =Application.instance.context.uiEngine.renderer;
                        renderer.layout(screenShotRootControl, false);
                        var oldViewportWidth = renderer.viewportWidth;
                        var oldViewportHeight = renderer.viewportHeight;
                        renderer.setViewportSize(screenShotRootControl.width, screenShotRootControl.height);
                        var baseEncodedPng = renderer.captureScreenShot(screenShotRootControl, screenShotRootControl.width, screenShotRootControl.height);
                        screenShotRootControl.visible = false;
                        renderer.setViewportSize(oldViewportWidth, oldViewportHeight);
                        var blob = dataURLToBlob(baseEncodedPng);
                        console.log('writing blob ' + blob.size + ' bytes');
                        fileWriter.write(blob);
                    });

                }, function(error) {
                    console.log('failed to create file', error);
                });

            }, function(){
                console.log('Could not open file system');
            });
        }
    }
});