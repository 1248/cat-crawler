/** Copyright (c) 2013 Toby Jaffey <toby@1248.io>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var argv = require('optimist').argv;

var request = require('request');
var URI = require('URIjs');

var unexplored = [];    // list of catalogues URLs to expand
var explored = [];      // list of expanded catalogue URLs
var facts = [];         // array of facts [{subject, predicate, object},...]

function storeFact(o) {
    // only store unique facts
    for (var i=0;i<facts.length;i++) {
        if (facts[i].subject == o.subject &&
            facts[i].predicate == o.predicate &&
            facts[i].object == o.object)
                return;
    }
    facts.push(o);
}

function fetch(root, cb) {
    //console.log("FETCH "+root);
    request(root, function (err, rsp, body) {
        if (!err && rsp.statusCode == 200) {
            if (cb !== undefined) {
                try {
                    cb(null, JSON.parse(body));
                } catch(e) {
                    console.error("Error parsing "+root+" "+body);
                    cb("err parsing", null);
                }
            }
        } else {
            if (rsp)
                cb("Status code " + rsp.statusCode, null);
            else
                cb("Fetch error", null);
        }
    });
}

function expandCatalogue(url, doc) {
    var i;
    try {
        // store metadata for catalogue
        for (i=0;i<doc.metadata.length;i++) {
            //console.log("CATL-FACT "+url+" "+doc.metadata[i].rel+" "+doc.metadata[i].val);
            storeFact({
                subject: url,
                predicate: doc.metadata[i].rel,
                object: doc.metadata[i].val,
                context: url
            });
        }
    } catch(e) {
        console.error(e);
    }

    try {
        // store metadata for items and expand any catalogues
        for (i=0;i<doc.items.length;i++) {
            var item = doc.items[i];
            item.href = URI(item.href).absoluteTo(url).toString();    // fixup relative URL
            // store that catalogue has an item
            storeFact({
                subject: url,
                predicate: "urn:X-tsbiot:rels:hasResource",
                object: item.href,
                context: url
            });
            for (var j=0;j<item.metadata.length;j++) {
                var mdata = item.metadata[j];
                //console.log("ITEM-FACT "+item.href+" "+mdata.rel+" "+mdata.val);
                storeFact({
                    subject: item.href,
                    predicate: mdata.rel,
                    object: mdata.val,
                    context: url
                });

                // if we find a link to a catalogue, follow it
                if (mdata.rel == "urn:X-tsbiot:rels:isContentType" &&
                    mdata.val == "application/vnd.tsbiot.catalogue+json") {
                        //unexplored.push(item.href);
                        unexplored.push(item.href);
                }
            }
        }
    } catch(e) {
        console.error(e);
    }
}

function crawl(cb) {
    if (unexplored.length > 0) {    // something to explore
        var url = unexplored.pop();

        if (explored.indexOf(url) == -1) {   // not seen before
            fetch(url, function(err, doc) {
                if (err) {
                    console.error("Error in "+url+" ("+err+")");
                    explored.push(url); // was bad, but explored
                    crawl(cb);
                } else {
                    explored.push(url);
                    expandCatalogue(url, doc);    // parse doc
                    crawl(cb);    // do some more work
                }
            });
        } else {
            crawl(cb);  // get next
        }
    } else {
        cb();   // done
    }
}

// dump a graph in dot/GraphViz format
function dumpGraph() {
    if (facts.length) {
        console.log("digraph {");
        for (var i=0;i<facts.length;i++) {
            console.log('    "'+facts[i].subject+'" -> "'+facts[i].object+'" [label="'+facts[i].predicate+'"];');
        }
        console.log("}");
    }
}

// dump a graph in N-Quads format
function dumpNQuads() {
    function f(s) { // FIXME, not a great way to detect URI
        if (s.match(/^http/) || s.match(/^mqtt/) || s.match(/^urn:/) || s.match(/^\//))
            return '<'+s+'>';
        else
            return '"'+s+'"';
    }
    for (var i=0;i<facts.length;i++) {
        console.log(f(facts[i].subject)+' '+f(facts[i].predicate)+' '+f(facts[i].object)+' '+f(facts[i].context)+' .');
    }
}

function help() {
    console.log(" --url <Catalogue to crawl> [--nquads]");
}

// get URL from command line
if (argv.url === undefined) {
    help();
    process.exit(1);
}
// add root catalogue URL to crawl list
unexplored.push(argv.url);

crawl(function() {
    if (argv.nquads)
        dumpNQuads();
    else
        dumpGraph();
});

