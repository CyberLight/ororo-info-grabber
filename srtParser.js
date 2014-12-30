var fs = require('fs');
var path = require('path');
var colors = require('colors');

if(process.argv.length == 2){
    console.log("Need base folder for parsing srt files");
    return;
}

var baseFolder = process.argv[2];

function SrtParser(){
    var parse = function(data) {
        data = String(data).replace(/\r/g, '');
        var regex = /(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/g;
        data = data.split(regex);
        data.shift();

        var timeNormalize = function(strTime){
            return parseFloat(String(strTime.trim()).replace(/[:]/,'').replace(/[,]/, '.'))
        };

        var items = [];
        for (var i = 0; i < data.length; i += 4) {
            items.push({
                id: data[i].trim(),
                startTime: timeNormalize(data[i + 1].trim()),
                endTime: timeNormalize(data[i + 2].trim()),
                text: String(data[i + 3].trim()).replace('\n', '\\N')
            });
        }

        return items;
    };

    return {
        fromSrt: parse
    }
}

(function start(baseFolder, srtParser){
    var detectLanguage = function(text){
            return /[^\x00-\x7F]+/g.test(text) ? 'en' : 'ru';
        },
        parseSrtFile = function(pathToFile, prefix){
            var ext = path.extname(pathToFile);
            if(ext === '.srt') {
                var srtContent = fs.readFileSync(pathToFile);

                var jsonSrt = srtParser.fromSrt(srtContent);
                var firstSrtLone = jsonSrt[0];
                var lang = detectLanguage(firstSrtLone.text);
                console.log('Parsed file: '.yellow.bold,
                            pathToFile.red,
                            'Detected language: ',
                            (lang + ' ').bgWhite.black.bold);
            }
        },
        searchFiles = function(baseDir, prefix) {
            fs.readdir(baseDir, function (err, files) {
                if (!err) {
                    for (var i = 0, len = files.length; i < len; i++) {
                        var file = files[i];
                        var fullPathToFile = baseDir + '/' + file;
                        if(fs.statSync(fullPathToFile).isDirectory()){
                            var linkedPrefix;
                            if(!isNaN(file)){
                                linkedPrefix = prefix.length ? prefix + '_' + file : file;
                            }
                            searchFiles(fullPathToFile, linkedPrefix);
                        }else{
                            parseSrtFile(fullPathToFile, prefix);
                        }
                    }
                }
            });
        };

    searchFiles(baseFolder, '');

})(baseFolder, new SrtParser());

