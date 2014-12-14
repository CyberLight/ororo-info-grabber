//phantomjs
var system = require('system');
var args = system.args;
var page = require('webpage').create();
var url = 'http://ororo.tv/';


var isGrabShows,
    isGrabMovies;

if (args.length == 1) {
    console.log("phantomjs ororoInfoGrabber.js [shows|movies] [link to show/movie page]");
    phantom.exit(1);
}

isGrabMovies = (args[1] == 'movies');
isGrabShows = (args[1] == 'shows');
url = args[2];


function grabVideoInfoShows(url, cb) {
    page.open(url, function (status) {
        if (status !== 'success') {
            console.log('grabVideoInfoShows Unable to access network', url);
            phantom.exit(1);
        } else {
            var videoInfo = page.evaluate(function () {
                var videoTag = document.querySelector('video');
                var sources = videoTag.querySelectorAll('source');
                var tracks = videoTag.querySelectorAll('track');
                var baseOroroUrl = 'http://ororo.tv';

                var videoTagInfo = {
                    'season': videoTag.attributes['data-season'].value,
                    'show': videoTag.attributes['data-show'].value,
                    'title': videoTag.attributes['data-title'].value,
                    'posterUrl': baseOroroUrl + videoTag.attributes['poster'].value,
                    'sourceUrls': [],
                    'trackUrls': []
                };

                for (var i = 0, len = sources.length; i < len; i++) {
                    var source = sources[i];
                    var src = source.attributes['src'].value;
                    videoTagInfo.sourceUrls.push({src: src});
                }

                for (var i = 0, len = tracks.length; i < len; i++) {
                    var track = tracks[i];
                    var src = track.attributes['src'].value;
                    var lang = track.attributes['label'].value;

                    videoTagInfo.trackUrls.push({src: baseOroroUrl + src, lang: lang});
                }

                return videoTagInfo;
            });
            cb(videoInfo);
        }
    });
}

function grabVideoInfoMovies(url, cb) {
    page.open(url, function (status) {
        if (status !== 'success') {
            console.log('grabVideoInfoMovies Unable to access network', url);
            phantom.exit(1);
        } else {
            var videoInfo = page.evaluate(function () {
                var videoTag = document.querySelector('video');
                var sources = videoTag.querySelectorAll('source');
                var tracks = videoTag.querySelectorAll('track');
                var baseOroroUrl = 'http://ororo.tv';

                var videoTagInfo = {
                    'show': videoTag.attributes['data-show'].value,
                    'title': videoTag.attributes['data-title'].value,
                    'posterUrl': baseOroroUrl + videoTag.attributes['poster'].value,
                    'sourceUrls': [],
                    'trackUrls': []
                };

                for (var i = 0, len = sources.length; i < len; i++) {
                    var source = sources[i];
                    var src = source.attributes['src'].value;
                    videoTagInfo.sourceUrls.push({src: src});
                }

                for (var i = 0, len = tracks.length; i < len; i++) {
                    var track = tracks[i];
                    var src = track.attributes['src'].value;
                    var lang = track.attributes['label'].value;

                    videoTagInfo.trackUrls.push({src: baseOroroUrl + src, lang: lang});
                }

                return videoTagInfo;
            });
            cb(videoInfo);
        }
    });
}


function grabShowsInfo(url, cb) {
    page.open(url, function (status) {
        if (status !== 'success') {
            console.log('grabShowsInfo: Unable to access network', url);
            phantom.exit(1);
        } else {
            var result = page.evaluate(function () {
                var tvShowItem = {};
                tvShowItem.description = document.querySelector('div#info > div#description').innerText;
                tvShowItem.posterInfo = {
                    'rating': '',
                    'year': '',
                    'genres': '',
                    'countries': '',
                    'length': ''
                };
                tvShowItem.episodeUrls = [];

                for (var info in tvShowItem.posterInfo) {
                    tvShowItem.posterInfo[info] = document.querySelector('div#poster_info > div#' + info).innerText;
                }
                var episodes = document.querySelectorAll('a.episode');
                var baseOroroUrl = window.location.protocol + '//' + window.location.host;
                for (var i = 0, len = episodes.length; i < len; i++) {
                    var episode = episodes[i];
                    tvShowItem.episodeUrls.push(baseOroroUrl + episode.attributes['data-href'].value)
                }
                return tvShowItem;
            });
            cb(result);
        }
    });
}


grabShowsInfo(url, function (tvShow) {
    if (tvShow) {
        var countOfEpisodes = tvShow.episodeUrls.length;
        var videoData = [];
        var beginIndex = 0;
        if(isGrabShows) {
            grabVideoInfoShows(tvShow.episodeUrls[beginIndex], function resultShowsReceiver(result) {
                videoData.push(result);
                if (beginIndex >= countOfEpisodes - 1) {
                    tvShow.videoInfos = videoData;
                    console.log(JSON.stringify(tvShow, undefined, 4));
                    phantom.exit();
                } else {
                    grabVideoInfoShows(tvShow.episodeUrls[beginIndex++], resultShowsReceiver);
                }
            });
        }else{
            grabVideoInfoMovies(tvShow.episodeUrls[beginIndex], function resultMoviesReceiver(result) {
                videoData.push(result);
                if (beginIndex >= countOfEpisodes - 1) {
                    tvShow.videoInfos = videoData;
                    console.log(JSON.stringify(tvShow, undefined, 4));
                    phantom.exit();
                } else {
                    grabVideoInfoMovies(tvShow.episodeUrls[beginIndex++], resultMoviesReceiver);
                }
            });
        }
    }
});



