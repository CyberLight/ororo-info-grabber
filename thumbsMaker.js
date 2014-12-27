var ffmpeg = require('fluent-ffmpeg');
var fs = require('fs');
var path = require('path');
var colors = require('colors');
var mkdirp = require('mkdirp');

if(process.argv.length == 2){
    console.log("Need base folder with videos for making screenshots");
    return;
}

var baseFolderPath = process.argv[2];
var previewsOutPath = process.argv[3];

console.log('Your choose: '.bgWhite.blue.bold, baseFolderPath);

if(!previewsOutPath)
    console.log('You don\'t choose output dir for thumbnails. All thumbnails will be saved near the video files!'.yellow.bold);
else
    console.log('All thumbnails will be saved to: '.yellow.bold, previewsOutPath);

searchFiles(baseFolderPath, []);

function searchFiles(baseDir, prefix) {
    fs.readdir(baseDir, function (err, files) {
        if (!err) {
            for (var i = 0, len = files.length; i < len; i++) {
                var file = files[i];
                var subPath = baseDir + '/' + file;
                if(fs.statSync(subPath).isDirectory()){
                    var linkedPrefix;
                    if(!isNaN(file)){
                        linkedPrefix = prefix.length ? prefix + '_' + file : file;
                    }
                    searchFiles(subPath, linkedPrefix);
                }else{
                    makeFileScreenshots(subPath, previewsOutPath || baseDir, prefix);
                }
            }
        }
    });
}

function makeFileScreenshots(fullFilePath, outDirPath, prefix){
    var ext = path.extname(fullFilePath);
    mkdirp(outDirPath, function(err) {
        if(err){
            throw err;
        }

        if (ext === '.mp4' || ext === '.webm') {
            console.log('Making thumb for: '.bgYellow.black.bold, fullFilePath);
            var outputPath = outDirPath;
            var baseName = path.basename(fullFilePath, ext);
            var extWithoutDot = ext.substr(1);
            var smallPreviewFileName = prefix + '_' + baseName + '_' + extWithoutDot + '_190x115.png';
            var bigPreviewFileName = prefix + '_' + baseName + '_' + extWithoutDot + '_big_preview.png';
            ffmpeg(fullFilePath)
                .screenshots({
                    count: 1,
                    timestamps: ['10%'],
                    filename: smallPreviewFileName,
                    folder: outputPath,
                    size: '190x115'
                });
            console.log('Created small preview: '.yellow, smallPreviewFileName.magenta);
            ffmpeg(fullFilePath)
                .screenshots({
                    count: 1,
                    timestamps: ['10%'],
                    filename: bigPreviewFileName,
                    folder: outputPath
                });
            console.log('Created big preview: '.yellow, bigPreviewFileName.magenta);
        }
    });
}