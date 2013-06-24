Catalogue Crawler
=================

A simple command-line catalogue crawler for the
"application/vnd.tsbiot.catalogue+json" IoT catalogue format.

Starting from the supplied URL, the crawler will build a knowledge graph of
discovered facts, following links to other catalogues wherever they are found.

On completion, the knowledge graph is written to stdout in GraphViz/DOT format.

Written in node.js

Toby Jaffey, toby@1248.io

Setup
-----

    npm install

Run
---

    node crawler.js URL

Render Graph
------------

    node crawler.js URL > out.dot
    dot -Tpng out.dot -o out.png

Example
-------

To crawl a catalogue, it must be exposed through HTTP on a web server.
Crawling the hierarchical catalogue in examples/tree will produce a graph similar to the following:

![Knowledge Graph](/examples/tree-output/tree.png "Knowledge Graph")

License
-------

The code is provided under an MIT license.
