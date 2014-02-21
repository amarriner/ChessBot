var fs      = require('fs');

// Small local module to hold twitter API keys outside main file
var Keys    = require('keys');
var k       = new Keys();

// Twitter function to post images
var twitter_update_with_media = require('twitter_update_with_media');

// Required to build the board image using GD
// https://www.npmjs.org/package/node-gd
var gd      = require('node-gd');

// Used to spawn the gnuchess process and wait for a response after moving
// https://www.npmjs.org/package/nexpect
var nexpect = require('nexpect');
var game;

// Stores Chess object as well as provides various chess funcitonality
var ChessJS = require('chess.js');
var c = new ChessJS.Chess();

// Starting FEN position
var startpos = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// If no FEN file exists, create it with the start position
if (! fs.existsSync('fen'))
   fs.writeFileSync('fen', startpos + '\n');

// If there is an existing PGN file, load it into the chess object
// This is mainly for when the bot crashes
if (fs.existsSync('pgn')) {
   c.load_pgn(fs.readFileSync('pgn', 'utf-8'));
}

// Various variables pertaining to the two players
var chess = [];
chess['w'] = {
   color   : 'White',
   engine  : fs.readFileSync('white.engine', 'utf-8').split('\n')[0],
   move    : '',
   twitter : new twitter_update_with_media({
                    consumer_key    : k.twitter_consumer_key,
                    consumer_secret : k.twitter_consumer_secret,
                    token           : k.white_twitter_access_token,
                    token_secret    : k.white_twitter_access_token_secret
             })
};

chess['b'] = {
   color   : 'Black',
   engine  : fs.readFileSync('black.engine', 'utf-8').split('\n')[0],
   move    : '... ',
   twitter : new twitter_update_with_media({
                    consumer_key    : k.twitter_consumer_key,
                    consumer_secret : k.twitter_consumer_secret,
                    token           : k.black_twitter_access_token,
                    token_secret    : k.black_twitter_access_token_secret
             })
};

// Main function
function process_next_move() {

   // Load the FEN file into a variable and determine the current position and player
   // This can be refactored since the Chess.js object holds all this now
   game = fs.readFileSync('fen', 'utf-8');
   var position = game.split('\n')[game.split('\n').length - 2];
   var player = chess[position.split(' ')[1]];

   // Spawn a process with the correct chess engine, and run UCI commands through it to process a turn
   // http://wbec-ridderkerk.nl/html/UCIProtocol.html
   nexpect.spawn(player.engine, options={verbose: false})
          .sendline('uci')
          .sendline('ucinewgame')
          .sendline('position fen ' + position)     // Moved the engine's board the current position
          .sendline('go')
          .wait('bestmove')
          .sendline('quit')
          .run(function (err, output) {
             if (err)
                console.log(err);
             else {
                // Interval for finding new moves. Modified on errors
                var interval = parseInt(fs.readFileSync('interval', 'utf-8').replace('\n',''))

                // I tried using the node uci module to process engine commands, but haven't been able
                // to get it working correctly yet. Thus, for now, I'm parsing things manually which
                // seems to be troublesome with varying engines as they're not standardized
                var move = '';
                if (player.engine == 'fruit' ||
                    player.engine == 'glaurung')
                   move = output[output.length - 1].split(' ')[1];

                else if (player.engine == 'stockfish')
                   move = output[output.length - 1].replace('bestmove ', '');

                // If we found a "valid" move from the engines STDOUT
                if (move) {

                   // Attempt the move against the Chess.JS object, erroring off if there was a problem
                   if (! c.move({ from: move.substr(0, 2), to: move.substring(2, 4) })) {
                      interval = 10000;
                      console.log('*** ERROR MOVING!!! ***');
                   }

                   // Otherwise, build a new PNG of the board, save the FEN and PGN output to file,
                   // tweet result, and print debug output 
                   else {
                      build_image(c.fen());
                      fs.appendFileSync('fen', c.fen() + '\n');
                      fs.writeFileSync('pgn', c.pgn());

                      var turn = Math.ceil((game.split('\n').length - 1)/ 2);
                      var last_move = c.pgn().replace('  ', ' ').split(' ')[c.pgn().replace('  ', ' ').split(' ').length - 1];

                      // Tweet move and board
                      var tweet = '@ChessBot' + ((player.color == 'White') ? 'Black' : 'White') + ' ' +  
                                  turn + '. ' + player.move + last_move + ' #Chess ';
                      player.twitter.post(tweet, 'images/board.png', function(err, response) {
                         if (err)
                            console.log(err);
                      });

                      // Debug console output
                      console.log(player.color + ' moves ' + turn + '. ' + 
                                  player.move + last_move + ' (' + 
                                  player.engine + ': ' + move + ')'); 
                   }
                }

                else {
                   interval = 10000;
                   console.log('*** ERROR FINDING MOVE!!! ***');
                }

                // Process the next turn on a timer
                setTimeout(function() { process_next_move(); }, interval);
             }
          }
   );
}

// Builds a PNG image of the given position in FEN format
// Piece images from http://ixian.com/chess/jin-piece-sets/
function build_image(position) {

   var tile_size = 40;
   var board = gd.createTrueColor(8 * tile_size + 2, 8 * tile_size + 2);

   var black = board.colorAllocate(  0,   0,   0);   
   var gray  = board.colorAllocate(230, 230, 230);
   var white = board.colorAllocate(255, 255, 255);

   var pieces = [];
   pieces['B'] = gd.createFromPng('images/wb.png');
   pieces['K'] = gd.createFromPng('images/wk.png');
   pieces['N'] = gd.createFromPng('images/wn.png');
   pieces['P'] = gd.createFromPng('images/wp.png');
   pieces['Q'] = gd.createFromPng('images/wq.png');
   pieces['R'] = gd.createFromPng('images/wr.png');

   pieces['b'] = gd.createFromPng('images/bb.png');
   pieces['k'] = gd.createFromPng('images/bk.png');
   pieces['n'] = gd.createFromPng('images/bn.png');
   pieces['p'] = gd.createFromPng('images/bp.png');
   pieces['q'] = gd.createFromPng('images/bq.png');
   pieces['r'] = gd.createFromPng('images/br.png');

   // Set up blank board with black border and gray and white squares
   board.filledRectangle(0, 0, 8 * tile_size + 2, 8 * tile_size + 2, black);
   board.filledRectangle(1, 1, 8 * tile_size, 8 * tile_size, gray);
   for(var i = 0; i < 8; i++) {
      for(var j = 0; j < 8; j++) {
         if ((i + j) % 2) {
            board.filledRectangle(i * tile_size + 1, j * tile_size + 1, (i * tile_size) + tile_size, (j * tile_size) + tile_size, white);
         }
      }
   }

   // Loop through first field in position to find where pieces are currently located
   for(var j = 0; j < 8; j++) {
      row = position.split(' ')[0].split('/')[j];

      col = 0;
      for (var i = 0; i < row.length; i++) {
         if (parseInt(row.charAt(i)) % 1 == 0) {
            col += parseInt(row.charAt(i));
         }
         else {
            pieces[row.charAt(i)].copy(board, col * tile_size + 1, j * tile_size + 1, 0, 0, tile_size, tile_size);
            col++;
         }
      }
   }

   // Preserve transparency from piece PNGs
   board.saveAlpha(1);
   board.alphaBlending(0);

   board.png('images/board.png');
}

process_next_move();

