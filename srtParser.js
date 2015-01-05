var fs = require('fs');
var path = require('path');
var colors = require('colors');

if(process.argv.length == 2){
    console.log("Need base folder for parsing srt files");
    return;
}

var baseFolder = process.argv[2];
var jsonDataFile = process.argv[3];
var seriesId = process.argv[4];


function mysql_real_escape_string (str) {
    return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
        switch (char) {
            case "\0":
                return "\\0";
            case "\x08":
                return "\\b";
            case "\x09":
                return "\\t";
            case "\x1a":
                return "\\z";
            case "\n":
                return "\\n";
            case "\r":
                return "\\r";
            case "\"":
            case "'":
            case "\\":
            case "%":
                return "\\"+char; // prepends a backslash to backslash, percent,
                                  // and double/single quotes
        }
    });
}


function SrtParser(){
    var parse = function(data) {
        var strData = String(data).replace(/\r/g, '');
        var regex = /(\d+)\n(\d{2}:\d{2}:\d{1,}[,.]\d{2,}) --> (\d{2}:\d{2}:\d{1,}[,.]\d{2,})/g;
        strData = strData.split(regex);
        strData.shift();

        var timeNormalize = function(strTime){
            var regex = /(\d+):(\d{2}):(\d{1,})[,.](\d{2,})/;
            var parts = regex.exec(strTime);

            return parseFloat(parseInt(parts[1], 10) * 3600 +
                              parseInt(parts[2], 10) * 60 +
                              parseInt(parts[3], 10) + "." + parseInt(parts[4], 10)); //String(strTime.trim()).replace(/:/g,'').replace(/,/g, '.')
        };

        var items = [];
        for (var i = 0; i < strData.length; i += 4) {
            var id = strData[i].trim();
            if(id != '9999') {
                items.push({
                    id: id,
                    startTime: timeNormalize(strData[i + 1].trim()),
                    endTime: timeNormalize(strData[i + 2].trim()),
                    text: String(strData[i + 3].trim()).replace('\n', '\\N')
                });
            }
        }

        return items;
    };

    return {
        fromSrt: parse
    }
}

function loadSubtitlesFromGrabberJson(seriesId, baseFolder, cb){
    fs.readFile(jsonDataFile, 'utf8', function (err, data) {
        if (err) throw err;
        var downloadData = JSON.parse(data);
        var subtBySeason = {};
        for(var i=0, len=downloadData.videoInfos.length; i<len; i++) {
            var videoInfo = downloadData.videoInfos[i];
            var title = videoInfo.title;
            var parsedTitle = /Season\s(.*)\sEpisode\s(.*)/.exec(title);
            var seasonNumber = parsedTitle && parsedTitle[1] || 1;
            var episodeNumber = parsedTitle && parsedTitle[2] || 1;
            var showsTitle = videoInfo.show;

            subtBySeason[seasonNumber] = subtBySeason[seasonNumber] || {};
            subtBySeason[seasonNumber][episodeNumber] = subtBySeason[seasonNumber][episodeNumber] || {};
            subtBySeason[seasonNumber][episodeNumber].tracks = subtBySeason[seasonNumber][episodeNumber].tracks || [];

            for(var k=0, klen=videoInfo.trackUrls.length; k<klen; k++) {
                var track = videoInfo.trackUrls[k];

                subtBySeason[seasonNumber][episodeNumber].tracks.push({
                    title: track.lang + ' ' + showsTitle,
                    filePath: baseFolder+'/'+seriesId+'/'+seasonNumber+'/'+path.basename(track.src),
                    lang: track.lang
                });
            }
        }
        cb(subtBySeason);
    });
}
function getVarDeclarationSql(seriesId){
    return  'SET @season_id = 0;\n' +
            'SET @episode_id = 0;\n' +
            'SET @series_id = ' + seriesId + ';\n ';
}

function getSeasonAndEpisodeSql(seasonNum, episodeNum){
    var sql = 'SET @season_id = (SELECT id FROM subtitles_season where number = '+seasonNum+' and series_id = @series_id);\n' +
              'SET @episode_id = (SELECT id FROM subtitles_episode where number = '+episodeNum+' and season_id = @season_id);\n';
    return sql;
}

function getCreateTrackSql(title, lang){
    var sql = '\nINSERT INTO `subtitles_track`' +
              ' (`episode_id`, `title`, `user_id`, `language`, `status`, `date_created`, `date_modified`, `origin_name`)\n' +
              ' VALUES \n (@episode_id, \''+ title +'\', 1, \''+lang+'\', \'approved\', NOW(), NOW(), \'\'); \n' +
              'SET @track_id = (SELECT LAST_INSERT_ID()); \n';
    return sql;
}

function getSubtitleInsertWithoutValuesSql(){
    var sql = 'INSERT INTO `subtitles_subtitle` '+
    ' (`language`,`caption`,`start`,`end`,`track_id`) '+
    ' VALUES \n';

    return sql;
}

function getInsertValuesForInsertSubtitle(lang, caption, start, stop){
    var sql = '(\''+ lang +'\', \'' + caption + '\', '+start+', ' + stop + ', @track_id)';
    return sql;
}

(function start(seriesId, baseFolder, srtParser){
    loadSubtitlesFromGrabberJson(seriesId, baseFolder, function(subtitles){
        var fullSql = getVarDeclarationSql(seriesId);

        for(var season in subtitles){
            for(var episode in subtitles[season]){

                fullSql += getSeasonAndEpisodeSql(season, episode);

                var seasonEpisode = subtitles[season][episode];
                for(var i = 0, len=seasonEpisode.tracks.length; i<len; i++){
                    var track = seasonEpisode.tracks[i];
                    var srtContent = fs.readFileSync(track.filePath);
                    var jsonSrtLines = srtParser.fromSrt(srtContent);
                    var tracksSqlArr = [];

                    if(jsonSrtLines.length == 0)
                        throw new Error('Empty body for ' + JSON.stringify(seasonEpisode));

                    for(var index= 0, count = jsonSrtLines.length; index<count; index++){
                        var line = jsonSrtLines[index];
                        tracksSqlArr.push(getInsertValuesForInsertSubtitle(
                            track.lang,
                            mysql_real_escape_string(line.text),
                            line.startTime,
                            line.endTime
                        ));
                    }

                    fullSql += getCreateTrackSql(track.title, track.lang);
                    fullSql += getSubtitleInsertWithoutValuesSql();
                    fullSql += tracksSqlArr.join(',\n');
                    fullSql += ';\n';
                    console.log('Season: ', season, ' Episode: ', episode, ' track', track);
                    console.log('--------------------------------------------------------');
                }

            }
            fs.appendFileSync('series_' + seriesId + '_script.sql', fullSql);
            fullSql = '';
        }
    });
})(seriesId, baseFolder, new SrtParser());

