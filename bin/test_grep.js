var download = require('../libs/download');
var extract_object = require('../libs/extract_object');

var express = require('express');
var bodyParser = require('body-parser');
var app = express();
app.use('/', express.static(__dirname + '/public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

var downloadMap = {};

app.post('/download', function (req, res) {
    console.log('download', req.body);
    download
        .get_queue(req.body.url)
        .req(req.body.url, req.body.encoding, req.body.net, function (err, $, content, buffer) {
            if (err) {
                res.status(500).send(err);
            } else {
                res.send('success');
                downloadMap[req.body.url] = {
                    $: $,
                    content: content,
                    buffer: buffer
                };
            }
        });
});

app.post('/extract_object', function (req, res) {
    console.log('extract_object', req.body);
    var $ = downloadMap[req.body.url].$;
    var content = downloadMap[req.body.url].content;
    var buffer = downloadMap[req.body.url].buffer;

    extract_object(function (err, extract_res) {
        if (err) {
            res.status(500).send(err);
        } else {
            res.send(extract_res);
        }
    }, JSON.parse(req.body.unpack_options), req.body.url, {})(null, [$, content, buffer]);
});

var server = require('http').createServer(app);
server.listen(function () {
    console.log('Server listening on port %d', server.address().port);
});
