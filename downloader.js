// Function to download file using wget
var fs = require('fs');
var async = require('async');
var url = require('url');
var http = require('http');
var util = require('util');
var fs = require('fs');
var EventEmitter = require('events').EventEmitter;
var mkdirp = require('mkdirp');
var USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.95 Safari/537.36';

if(process.argv.length == 2){
    console.log("Need specify file name with urls");
    return;
}

var jsonDataFile = process.argv[2];
var pathToSaveFiles = process.argv[3];

console.reset = function () {
    return process.stdout.write('\033c');
};

function downloadFile(src, output, headers) {
    var downloader = new EventEmitter(),
        srcUrl,
        req;

    if(!headers){
        headers = {}
    }

    srcUrl = url.parse(src);

    req = http.request({
        protocol: srcUrl.protocol,
        host: srcUrl.hostname,
        port: srcUrl.port,
        path: srcUrl.pathname,
        method: 'GET',
        headers: headers
    }, function(res) {
        var fileSize, writeStream, downloadedSize;
        if (res.statusCode === 200) {
            downloadedSize = 0;
            fileSize = res.headers['content-length'];
            writeStream = fs.createWriteStream(output, {
                flags: 'a',
                encoding: 'binary'
            });

            res.on('error', function(err) {
                writeStream.end();
                downloader.emit('error', err);
            });
            res.on('data', function(chunk) {
                downloadedSize += chunk.length;
                downloader.emit('progress', downloadedSize/fileSize);
                writeStream.write(chunk);
            });
            res.on('end', function() {
                writeStream.end();
            });
            writeStream.on('close', function(){
                downloader.emit('end', output);
            });
        } else {
            downloader.emit('error', 'Server respond ' + res.statusCode);
        }
    });

    req.end();
    req.on('error', function(err) {
        downloader.emit('error', err);
    });

    return downloader;
}


function download_using_node_wget(fileUrl, outputdir, headers, cb) {
    var fileName = url.parse(fileUrl).pathname.split('/').pop();
    var download = downloadFile(fileUrl, outputdir + '/' + fileName, headers);
    download.on('error', function (err) {
        cb(err, null);
    });
    download.on('end', function (output) {
        cb(null, output);
    });
    download.on('progress', function (progress) {
        var currentProgress = progress * 100;
        console.reset();
        console.log('fileName: ', fileName, ' progress: ', currentProgress, '%');
    });
}

function downloadSubtitles(subtitles, threads, cb) {
    if(subtitles.length == 0) {
        cb(null, true);
        return;
    }

    async.eachLimit(subtitles, threads, function (url, next) {
        console.log('download: ', url);
        mkdirp(pathToSaveFiles, function(err) {
            if(err){
                throw err;
            }
            download_using_node_wget(url, pathToSaveFiles, {'User-Agent': USER_AGENT}, next);
        });
    }, function (err) {
        if (err) {
            console.log('finished with error: ', err);
            cb(err, false);
        } else {
            console.log('finished!');
            cb(null, true);
        }
    });
}

function downloadVideos(videos, threads, cb) {
    if(videos.length == 0) {
        cb(null, true);
        return;
    }

    async.eachLimit(videos, threads, function (url, next) {
        console.log('download: ', url);
        mkdirp(pathToSaveFiles, function(err) {
            if (err) {
                throw err;
            }
            download_using_node_wget(url, pathToSaveFiles, {'Cookie': 'video=true', 'User-Agent': USER_AGENT}, next);
        });
    }, function (err) {
        if (err) {
            console.log('finished with error: ', err);
            cb(err, false);
        } else {
            console.log('finished!');
            cb(null, true);
        }
    });
}

fs.readFile(jsonDataFile, 'utf8', function (err, data) {
    if (err) throw err;
    var downloadData = JSON.parse(data);
    var videos = [];
    var subtitles = [];
    var threads = 1;

    for(var i=0, len=downloadData.videoInfos.length; i<len; i++) {
        var videoInfo = downloadData.videoInfos[i];
        for(var j=0, jlen=videoInfo.sourceUrls.length; j<jlen; j++) {
            videos.push(videoInfo.sourceUrls[j].src);
        }
        for(var k=0, klen=videoInfo.trackUrls.length; k<klen; k++) {
            subtitles.push(videoInfo.trackUrls[k].src);
        }
    }

    console.info('Videos count: ', videos.length);
    console.info('Subtitles count: ', subtitles.length);

    downloadSubtitles(subtitles, threads, function(err, success){

        if(success) {
            console.log('Subtitles downloaded successfully!');
        }else{
            console.error('Subtitles downloading failed!');
        }

        downloadVideos(videos, threads, function(err, success){
            if(success) {
                console.log('Videos downloaded successfully!');
            }else{
                console.error('Videos downloading failed');
            }
        });
    });


});