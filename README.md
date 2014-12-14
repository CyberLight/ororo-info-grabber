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