var express = require('express');
var path = require('path');
var app = express();
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

mongoose.connect('mongodb://localhost/postdb');

var PostSchema = new mongoose.Schema({
    content: { type: String, required: true },
    author: { type: String, required: true },
    _comments: [{type: Schema.Types.ObjectId, ref: 'Comments'}]
}, { timestamps: true });

var CommentSchema = new mongoose.Schema({
    _post: {type: Schema.Types.ObjectId, ref: 'Posts'},
    author: { type: String, required: true },
    content: { type: String, required: true }
}, {timestamps: true });

mongoose.model('Posts', PostSchema);
mongoose.model('Comments', CommentSchema);

var Posts = mongoose.model('Posts');
var Comments = mongoose.model('Comments');

var port = 8000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "./static")));
app.use('/jquery', express.static(__dirname + '/node_modules/jquery/dist/'));
app.set('views', path.join(__dirname, './views'));
app.set('view engine', 'ejs');

// Routes
app.get('/', function(req, res) {
    Posts.find({}).populate('_comments').exec(function(err, posts) {
        if (err) {
            // error
        } else {
            res.render('index', {posts: posts});
        }
    });
});


// Start server
var server = app.listen(port, function() {
    console.log("listening on port", port);
});

var io = require('socket.io').listen(server);

io.sockets.on('connection', function (socket) {

    socket.on('form_submit', function(data) {
        if (data.form_data.name.length > 0 && data.form_data.content.length > 0) {
            var Post = new Posts();
            Post.content = data.form_data.content;
            Post.author = data.form_data.name;
            Post.save(function(err, post){
                if (err) {} else {
                    io.emit('form_response', post);
                }
            });
        } else {
            var error = "You must enter a name and post.";
            socket.emit('errormsg', error);
        }
    });
    socket.on('comment_submit', function (data) {
        if (data.name.length > 0 && data.content.length > 0) {
            Posts.findOne({'_id': data.post_id}, function (err, post) {
                if (err) {
                    console.log('No post found!');
                } else {
                    var Comment = new Comments();
                    Comment.author = data.name;
                    Comment.content = data.content;
                    Comment.save(function (err) {
                        post._comments.push(Comment);
                        post.save(function (err, _post) {
                            if (err) {
                                console.log(err);
                            } else {
                                // console.log('Post updated');
                                data.post_id = _post._id
                                io.emit('comment_response', data);
                            }
                        });
                    });
                }
            });
        } else {
            var error = "You must enter a name and comment.";
            socket.emit('errormsg', error);
        }
    });
});