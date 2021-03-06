var fs      = require('fs');

// Small local module to hold twitter API keys outside main file
var Keys    = require('keys');
var k       = new Keys();

// Twitter function to post images
var twitter_update_with_media = require('twitter_update_with_media');

// Alternate NPM module for more twitter functionality. Should probably
// figure out a better way to do this other than having two separate
// twitter libraries
var Twit    = require('twit');

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
             }),
   twit    : new Twit({
                    consumer_key        : k.twitter_consumer_key,
                    consumer_secret     : k.twitter_consumer_secret,
                    access_token        : k.white_twitter_access_token,
                    access_token_secret : k.white_twitter_access_token_secret
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
             }),
   twit    : new Twit({
                    consumer_key        : k.twitter_consumer_key,
                    consumer_secret     : k.twitter_consumer_secret,
                    access_token        : k.black_twitter_access_token,
                    access_token_secret : k.black_twitter_access_token_secret
             })
};

// Main function
function process_next_move() {

   if (c.game_over()) {
      process_game_over();
   }

   // Load the FEN file into a variable and determine the current position and player
   // This can be refactored since the Chess.js object holds all this now
   game = fs.readFileSync('fen', 'utf-8');
   var position = game.split('\n')[game.split('\n').length - 2];
   var player = chess[position.split(' ')[1]];

   // Spawn a process with the correct chess engine, and run UCI commands through it to process a turn
   // http://wbec-ridderkerk.nl/html/UCIProtocol.html
   nexpect.spawn(player.engine, options={verbose: false})
          .sendline('uci')
          .sendline('set ownbook true')               // Use engine's internal opening book
          .sendline('ucinewgame')
          .sendline('position fen ' + position)       // Moved the engine's board the current position
          .sendline('go depth 20 movetime 300000')    // Stronger depth search, but limit to 5 mintes
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

                // Looping through the last few lines of output to attempt to find the move the engine decided on
                for (var z = 1; z <= 5; z++) {

                   // Stripping out extraneous text in output
                   move = output[output.length - z].replace('bestmove ', '');

                   if (move.indexOf(' ponder') >= 0)
                      move = move.substring(0, move.indexOf(' ponder'));

                   if (move.indexOf(' ') >= 0)
                      move = move.split(' ')[0];

                   // If move is more than four characters long then it's a promotion, strip the last character
                   var promotion = '';
                   if (move.length > 4) {
                      promotion = move.substring(4, 5);
                      move = move.substring(0, 4);
                   }

                   // If we found a "valid" move from the engines STDOUT
                   if (move) {

                      // Attempt the move against the Chess.JS object, erroring off if there was a problem
                      if (! c.move({ from: move.substr(0, 2), to: move.substring(2, 4), promotion: promotion })) {
                         interval = 10000;
                         console.log('*** ERROR MOVING!!! *** (' + move + ' - ' + promotion
                                                                        + ' - ' + output[output.length - z] + ')');
                      }

                      // Otherwise, build a new PNG of the board, save the FEN and PGN output to file,
                      // tweet result, and print debug output 
                      else {
                         z = 1000;

                         // Reset the interval in case it was shortened by error
                         interval = parseInt(fs.readFileSync('interval', 'utf-8').replace('\n',''))
 
                         build_image(c.fen());
                         fs.appendFileSync('fen', c.fen() + '\n');
                         fs.writeFileSync('pgn', c.pgn());

                         var turn = Math.ceil((game.split('\n').length - 1)/ 2);
                         var last_move = c.pgn().replace('  ', ' ').split(' ')[c.pgn().replace('  ', ' ').split(' ').length - 1];

                         // Put a #Chess hashtag every 24 turns on white's turn
                         var hashtag = '';
                         if (turn % 24 == 0 && player.color == 'White') 
                            hashtag = '#Chess';

                         // Tweet move and board
                         var tweet = '@ChessBot' + ((player.color == 'White') ? 'Black' : 'White') + ' ' +  
                                     turn + '. ' + player.move + last_move + ' ' + hashtag + ' ';
                         player.twitter.post(tweet, 'images/board.png', function(err, response, body) {
                            if (err)
                               console.log('*** ERROR TWEETING ***: ' + err);

                            // If this tweet resulted in checkmate, favorite it
                            if (c.in_checkmate()) {
                               var tw = (c.turn() == 'w') ? 'b' : 'w';

                               chess[tw].twit.post('favorites/create', {id: JSON.parse(body).id_str}, function(err, reply) {
                                  if (err)
                                     console.log('*** ERROR FAVORITING ***: ' + err);
                               });
                            }
                         });

                         // Debug console output
                         console.log(player.color + ' moves ' + turn + '. ' + 
                                     player.move + last_move + ' (' + 
                                     player.engine + ': ' + move + ')'); 
                      
                      }
                   }

                   else {
                      interval = 10000;
                      console.log('*** ERROR FINDING MOVE!!! (' + move + ') ***');
                   }
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

   var light_blue = board.colorAllocateAlpha(100, 157, 234, 72);
   var dark_blue  = board.colorAllocateAlpha( 40,  99, 234, 50);

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
   board.filledRectangle(1, 1, 8 * tile_size, 8 * tile_size, white);
   board.filledRectangle(1, 1, 8 * tile_size, 8 * tile_size, light_blue);
   for(var i = 0; i < 8; i++) {
      for(var j = 0; j < 8; j++) {
         if ((i + j) % 2) {
            board.filledRectangle(i * tile_size + 1, j * tile_size + 1, (i * tile_size) + tile_size, (j * tile_size) + tile_size, dark_blue);
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

// Function to process game over states
function process_game_over() {
   console.log('Game over!');

   var timestamp = new Date().getTime();

   // Create a saves directory if it doesn't exist
   if (! fs.existsSync('saves'))
      fs.mkdir('saves');

   // Move the current games FEN and PGn files to the saves directory with a new filename
   fs.renameSync('fen', 'saves/' + timestamp + '.fen');
   fs.renameSync('pgn', 'saves/' + timestamp + '.pgn');

   // Reset FEN file and chess object
   fs.writeFileSync('fen', startpos + '\n');
   c = new ChessJS.Chess();
}

process_next_move();
