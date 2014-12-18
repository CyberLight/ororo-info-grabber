Requirements
============
Phantomjs >= 1.9.8

Usage
=====

* For grabbing information about shows
```bash
phantomjs ororoInfoGrabber.js shows http://ororo.tv/en/shows/the-wire#1 > result_shows.json
```

* For grabbing information about movies
```bash
phantomjs ororoInfoGrabber.js movies http://ororo.tv/en/movies/the-fifth-element > result_movie.json
```

* Use authentication
```bash
phantomjs --cookies-file=cookies.txt ororoInfoGrabber.js auth USER_EMAIL USER_PASSWORD shows http://ororo.tv/en/shows/breaking-bad > breaking-bad.js
```

Downloader
==========
* Requirements
  * ```Node.js (v0.10.32)```


* Prepearing to use:
```bash
npm install
```

* Basic usage:
```bash
node downloader.js result_shows.json path/to/store/downloaded/data
```
* With posting data to api method

```bash
node downloader.js result_shows.json media/video post-data http://localhost:8000 8304
```
  * Parameters:
    * ```result_shows.json``` - json file with links
    * ```media/video``` - path to folder
    * ``` post-data ``` - special flag for activation post data to API method action
    * ``` http://localhost:8000 ``` - api protocol and host
    * ``` 8304 ``` - id of series inside api database