//phantomjs
var system = require('system');
var args = system.args;
var page = require('webpage').create();
var baseUrl = 'http://ororo.tv/';
var authUrl = 'http://ororo.tv/en/users/sign_in';

var isGrabShows,
    isGrabMovies;

if (args.length == 1) {
    console.log("phantomjs ororoInfoGrabber.js [shows|movies] [link to show/movie page]");
    phantom.exit(1);
}

var auth = (args[1] == 'auth');
var userEmail;
var userPassword;
var url;

if(auth) {
    userEmail = args[2];
    userPassword = args[3];
    isGrabMovies = (args[4] == 'movies');
    isGrabShows = (args[4] == 'shows');
    url = args[5];
}else{
    isGrabMovies = (args[1] == 'movies');
    isGrabShows = (args[1] == 'shows');
    url = args[2];
}

function evaluateSpecial(page, func) {
    var args = [].slice.call(arguments, 2);
    var fn = "function() { return (" + func.toString() + ").apply(this, " + JSON.stringify(args) + ");}";
    return page.evaluate(fn);
}

function waitFor(testFx, onReady, timeOutMillis) {
    var maxtimeOutMillis = timeOutMillis ? timeOutMillis : 3000, //< Default Max Timout is 3s
        start = new Date().getTime(),
        condition = false,
        interval = setInterval(function() {
            if ( (new Date().getTime() - start < maxtimeOutMillis) && !condition ) {
                // If not time-out yet and condition not yet fulfilled
                condition = (typeof(testFx) === "string" ? eval(testFx) : testFx()); //< defensive code
            } else {
                if(!condition) {
                    // If condition still not fulfilled (timeout but condition is 'false')
                    console.log("'waitFor()' timeout");
                    phantom.exit(1);
                } else {
                    // Condition fulfilled (timeout and/or condition is 'true')
                    //console.log("'waitFor()' finished in " + (new Date().getTime() - start) + "ms.");
                    typeof(onReady) === "string" ? eval(onReady) : onReady(); //< Do what it's supposed to do once the condition is fulfilled
                    clearInterval(interval); //< Stop this interval
                }
            }
        }, 250); //< repeat check every 250ms
};

function authenticate(authUrl, email, password, cb) {
    if(!auth) {
        cb(true);
        return;
    }
    page.open(baseUrl, function(){
        var isAuthenticated = page.evaluate(function () {
            var allHref = document.querySelectorAll('ul.nav.pull-right.auth_links > li > a');
            return (allHref.length > 0 && allHref[0].innerText == 'My account');
        });
        if(isAuthenticated){
            cb(true);
        }else{
            page.open(authUrl, function(){
                var clicked = evaluateSpecial(page, function(email, password){
                    if (!HTMLElement.prototype.click) {
                        HTMLElement.prototype.click = function() {
                            var ev = document.createEvent('MouseEvent');
                            ev.initMouseEvent(
                                'click',
                                /*bubble*/true, /*cancelable*/true,
                                window, null,
                                0, 0, 0, 0, /*coordinates*/
                                false, false, false, false, /*modifier keys*/
                                0/*button=left*/, null
                            );
                            this.dispatchEvent(ev);
                        };
                    }

                    var inputUserEmail = document.querySelector('input#user_email');
                    var inputUserPassword = document.querySelector('input#user_password');

                    inputUserEmail.value = email;
                    inputUserPassword.value = password;

                    var submitBtn = document.querySelector('input.submit.button');
                    if(submitBtn && submitBtn.value == 'Log in') {
                        submitBtn.click();
                        return true;
                    }
                    return false;
                }, email, password);
                if(clicked) {
                    waitFor(function () {
                        return page.evaluate(function () {
                            var allHref = document.querySelectorAll('ul.nav.pull-right.auth_links > li > a');
                            return (allHref.length > 0 && allHref[0].innerText == 'My account');
                        });
                    }, function () {
                        cb(true);
                    }, 10000);
                }
            });
        }
    });

}

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

authenticate(authUrl, userEmail, userPassword, function(authenticated) {
    grabShowsInfo(url, function (tvShow) {
        if (tvShow) {
            var countOfEpisodes = tvShow.episodeUrls.length;
            var videoData = [];
            var beginIndex = 0;
            if (isGrabShows) {
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
            } else {
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
});



