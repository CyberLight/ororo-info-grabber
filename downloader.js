// Function to download file using wget
var colors = require('colors');
var fs = require('fs');
var async = require('async');
var url = require('url');
var http = require('http');
var path = require('path');
var util = require('util');
var request = require('request');
var EventEmitter = require('events').EventEmitter;
var mkdirp = require('mkdirp');
var USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.95 Safari/537.36';
var warningStack = [];

function EpisodeAlreadyExistsError(seriesId, seasonNumber, episodeNumber){
    this.message = 'Serial with seriesId: ' + seriesId +
    ' seasonNumber: ' + seasonNumber +
    ' episodeNumber: ' + episodeNumber +
    ' does not created or already exists!'
}

function SeriesAlreadyExistsError(seriesId){
    this.message = 'Serial with seriesId: ' + seriesId +
                   ' already exists!'
}

function FileExistsError(filePath){
    this.message = 'File ' + filePath + ' already exists!';
}

function SkippedSeriesError(path, errMsg){
    this.message = 'File with series metadata ' + path + ' skipped! Err: ' + JSON.stringify(errMsg);
}

EpisodeAlreadyExistsError.prototype = new Error();
EpisodeAlreadyExistsError.prototype.coloredMessage = function(){
    return this.message.magenta;
};
FileExistsError.prototype = new Error();
FileExistsError.prototype.coloredMessage = function(){
    return this.message.yellow;
};

SeriesAlreadyExistsError.prototype = new Error();
SeriesAlreadyExistsError.prototype.coloredMessage = function(){
    return this.message.magenta;
};


SkippedSeriesError.prototype = new Error();
SkippedSeriesError.prototype.coloredMessage = function(){
    return this.message.red;
};

if(process.argv.length == 2){
    console.log("Need specify file name with urls");
    return;
}

var jsonListFile = process.argv[2];
var pathToSaveFiles = process.argv[3];
var pathToSavePosters = process.argv[4];
var canPostData = (process.argv[5] == 'post-data');
var host = process.argv[6];

console.reset = function () {
    return process.stdout.write('\033c');
};

process.stdin.resume();//so the program will not close instantly

function exitHandler(options, err) {
    if (options.cleanup) {
        console.log('clean');
    }
    if (err) {
        printWarningStack();
        console.log(err.stack);
    }
    if (options.exit) {
        printWarningStack();
        process.exit();
    }
}

//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));

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


function download_using_node_wget(fileUrl, fileName, outputdir, headers, cb) {
    fileName = fileName || url.parse(fileUrl).pathname.split('/').pop();
    var filePathWithName = outputdir + '/' + fileName;

    if(fs.existsSync(filePathWithName)){
        cb(new FileExistsError(filePathWithName), false);
        return;
    }

    var download = downloadFile(fileUrl, filePathWithName, headers);
    download.on('error', function (err) {
        cb(err, null);
    });
    download.on('end', function (output) {
        cb(null, output);
    });
    download.on('progress', function (progress) {
        var currentProgress = progress * 100;
        console.reset();
        console.log('fileName: ', filePathWithName, ' progress: ', currentProgress, '%');
    });
}

function downloadPosters(posters, threads, cb) {
    if(posters.length == 0) {
        cb(null, true);
        return;
    }

    async.eachLimit(posters, threads, function (poster, next) {
        console.log('Posters download: ', poster);
        var fullPathToSaveFiles = poster.baseDir;
        mkdirp(fullPathToSaveFiles, function(err) {
            if(err){
                throw err;
            }
            download_using_node_wget(poster.url,
                null,
                fullPathToSaveFiles, {'User-Agent': USER_AGENT},
                function(err, data){
                    if(err instanceof FileExistsError) {
                        console.log('Skipped downloading! File already exists!');
                        warningStack.push(err);
                        next(null, data);
                    }else{
                        next(err, data);
                    }
                });
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

function downloadSubtitles(subtitles, threads, cb) {
    if(subtitles.length == 0) {
        cb(null, true);
        return;
    }

    async.eachLimit(subtitles, threads, function (url, next) {
        console.log('download: ', url);
        var fullPathToSaveFiles = pathToSaveFiles + url.filePath;
        mkdirp(fullPathToSaveFiles, function(err) {
            if(err){
                throw err;
            }
            download_using_node_wget(url.src,
                                     null,
                                     fullPathToSaveFiles, {'User-Agent': USER_AGENT},
                                     function(err, data){
                                         if(err instanceof FileExistsError) {
                                             console.log('Skipped downloading! File already exists!');
                                             warningStack.push(err);
                                             next(null, data);
                                         }else{
                                             next(err, data);
                                         }
                                     });
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
        var fullPathToSave = pathToSaveFiles + url.filePath;
        mkdirp(fullPathToSave, function(err) {
            if (err) {
                throw err;
            }

            var headers = {'Cookie': 'video=true', 'User-Agent': USER_AGENT};
            download_using_node_wget(url.src,
                                     url.fileName,
                                     fullPathToSave,
                                     headers,

                function(err, data){

                    if(err instanceof FileExistsError) {
                        warningStack.push(err);
                        err = null;
                    }

                    if(canPostData && !err && url.needPostToApi) {

                        var formData = {
                            title: url.title,
                            number: url.episodeNumber,
                            description: url.description,
                            published: 'True'
                        };

                        postData(host,
                                 url.seriesId,
                                 url.seasonNumber,
                                 formData,
                            function(err, data){
                                if(err)
                                    console.log("Error posting data to API: ", err, " for ", url.src);

                                next(err, data);
                            });

                    }else {
                        next(err, data);
                    }
                });
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

function postData(host, seriesId, seasonNumber, formData, cb){
    request.post(
        host + '/api/series/' + seriesId + '/season/'+ seasonNumber +'/create_episode',
        {
            form: formData
        },
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                var jsonResponse = JSON.parse(body);

                if(jsonResponse.status != 'created'){
                    warningStack.push(new EpisodeAlreadyExistsError(seriesId, seasonNumber, formData.number));
                }

                cb(null, true);
            } else {
                if(error) {
                    cb(error, false);
                }else if(response.statusCode != 200){
                    cb(new Error("Status code " + response.statusCode));
                }
            }
        }
    );
}

function postSerialData(host, type, formData, cb){

    if(!canPostData){
        cb(null, null);
        return;
    }

    var videoTypes = {
        'shows' : 'series',
        'movie' : 'movie'
    };

    request.post(
        host + '/api/series/create/' + videoTypes[type],
        {
            form: formData
        },
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                var jsonResponse = JSON.parse(body);

                if(jsonResponse.success){
                    if(!jsonResponse.created) {
                        warningStack.push(new SeriesAlreadyExistsError(jsonResponse.id));
                    }
                    cb(null, jsonResponse.id);
                }else{
                    cb(jsonResponse.errors, null);
                }
            } else {
                if(error) {
                    cb(error, null);
                }else if(response.statusCode != 200){
                    cb(new Error("Status code " + response.statusCode));
                }
            }
        }
    );
}

function printWarningStack() {
    if (warningStack.length) {
        console.log('\n');
        console.log('-=-=-=-=-=-=-=-=-=-=-= R E P O R T -=-=-=-=-=-=-=-=-=-=-=-=-=-=-'.bgWhite.bold.black);
        console.log('With following warnings:'.red);
        for(var i = 0, len = warningStack.length; i < len; i++){
            console.log(warningStack[i].coloredMessage());
        }
        console.log('-=-=-=-=-=-=-=-=-=-= E N D   O F   R E P O R T -=-=-=-=-=-=-=-=-=-=-'.bgWhite.bold.black);
    }
}


function processFile(videoType, jsonDataFilePath, postersRootDir, cb) {
    fs.readFile(jsonDataFilePath, 'utf8', function (err, data) {
        if (err) throw err;
        var downloadData = JSON.parse(data);
        var firstVideoInfo = downloadData.videoInfos[0];
        var releaseYear = /\d+/g.exec(downloadData.posterInfo.year)[0];
        var countryInfo = /Countries:(.*)/g.exec('Countries: USA')[1].trim();

        var seriesInfo = {
            original_title: firstVideoInfo.show,
            title: firstVideoInfo.show,
            description: downloadData.description,
            year_start: releaseYear,
            poster: postersRootDir + '/' + path.basename(firstVideoInfo.posterUrl),
            original_language: 'en',
            country: countryInfo
        };

        function processDownloading(downloadData, seriesId, cb) {
            var videos = [];
            var subtitles = [];
            var threads = 1;
            var posters = [];

            for (var i = 0, len = downloadData.videoInfos.length; i < len; i++) {
                var videoInfo = downloadData.videoInfos[i];
                var title = videoInfo.title;
                var parsedTitle = /Season\s(.*)\sEpisode\s(.*)/.exec(title);
                var seasonNumber = parsedTitle && parsedTitle[1] || 1;
                var episodeNumber = parsedTitle && parsedTitle[2] || 1;
                var seriesIdWithSeasonNumberPath = ('/' + seriesId + '/' + seasonNumber);
                var onlySeasonNumberPath = ('/' + seasonNumber);
                var computedFilePath = seriesId ? seriesIdWithSeasonNumberPath : onlySeasonNumberPath;
                for (var j = 0, jlen = videoInfo.sourceUrls.length; j < jlen; j++) {
                    var sourceUrl = videoInfo.sourceUrls[j];
                    var fileExtension = url.parse(sourceUrl.src).pathname.split('.').pop();
                    videos.push({
                        title: title,
                        seriesId: seriesId,
                        seasonNumber: seasonNumber,
                        episodeNumber: episodeNumber,
                        filePath: computedFilePath,
                        fileName: episodeNumber + '.' + fileExtension,
                        description: downloadData.description,
                        needPostToApi: (j == 0),
                        src: sourceUrl.src
                    });
                }
                for (var k = 0, klen = videoInfo.trackUrls.length; k < klen; k++) {
                    subtitles.push({
                        filePath: computedFilePath,
                        src: videoInfo.trackUrls[k].src
                    });
                }

                if(i == 0){
                    posters.push({url: videoInfo.posterUrl,
                                  fullPath: seriesInfo.poster,
                                  baseDir: postersRootDir});
                }
            }

            console.info('Videos count: ', videos.length);
            console.info('Subtitles count: ', subtitles.length);

            downloadPosters(posters, threads, function (err, success) {
                if (success) {
                    console.log('Poster(s) downloaded successfully!');
                } else {
                    console.error('Poster(s) downloading failed!');
                }
                downloadSubtitles(subtitles, threads, function (err, success) {
                    if (success) {
                        console.log('Subtitles downloaded successfully!');
                    } else {
                        console.error('Subtitles downloading failed!');
                    }
                    downloadVideos(videos, threads, function (err, success) {
                        if (success) {
                            console.log('Videos downloaded successfully!');
                        } else {
                            console.error('Videos downloading failed'.red, err);
                        }
                        printWarningStack();
                        cb(err, success);
                    });
                });
            });
        }


        postSerialData(host, videoType, seriesInfo, function(err, seriesId){
            if(err){
                warningStack.push(new SkippedSeriesError(jsonDataFilePath, err));
                cb(err, null);
            }else {
                processDownloading(downloadData, seriesId, cb);
            }
        });
    });
}


function readAndProcessList(pathToList, posterRootDir, cb){
    fs.readFile(pathToList, 'utf8', function (err, data) {
        if (err) throw err;
        var listData = JSON.parse(data);
        async.eachLimit(listData.links, 1, function (data, next) {
            processFile(data.type, data.file, posterRootDir, function(err, data){
                next(err, data);
            });
        }, function(err){
            if (err) {
                console.log('Serials analyzing finished with error: ', err);
                cb(err, false);
            } else {
                console.log('Serials analyzing finished!');
                cb(null, true);
            }
        });
    });
}


readAndProcessList(jsonListFile, pathToSavePosters, function(err, success){
    console.log("Finished ", success ? ' successfully!' : ' with errors!');
    process.exit(0);
});
