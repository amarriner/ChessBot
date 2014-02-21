var fs      = require('fs');
var ChessJS = require('chess.js');

// Required to build the board image using GD
// https://www.npmjs.org/package/node-gd
var gd      = require('node-gd');

// Used to spawn the gnuchess process and wait for a response after moving
// https://www.npmjs.org/package/nexpect
var nexpect = require('nexpect');
var game;

var c = new ChessJS.Chess();
var startpos = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

if (! fs.existsSync('fen'))
   fs.writeFileSync('fen', startpos + '\n');

if (fs.existsSync('pgn')) {
   c.load_pgn(fs.readFileSync('pgn', 'utf-8'));
}

var chess = [];
chess['w'] = {
   color : 'White',
   engine: 'fruit',
   move  : ''
};

chess['b'] = {
   color : 'Black',
   engine: 'glaurung',
   move  : '... '
};

function process_next_move() {
   game = fs.readFileSync('fen', 'utf-8');
   var position = game.split('\n')[game.split('\n').length - 2];
   var player = chess[position.split(' ')[1]];
   // console.log(player.color + ' to play :: ' + position);

   nexpect.spawn(player.engine, options={verbose: false})
          .sendline('uci')
          .sendline('ucinewgame')
          .sendline('position fen ' + position)
          .sendline('go')
          .wait('bestmove')
          .sendline('quit')
          .run(function (err, output) {
             if (err)
                console.log(err);
             else {

                var move = '';
                if (player.engine == 'fruit' ||
                    player.engine == 'glaurung')
                   move = output[output.length - 1].split(' ')[1];

                else if (player.engine == 'stockfish')
                   move = output[output.length - 1].replace('bestmove ', '');

                if (move) {
                   var turn = Math.ceil((game.split('\n').length - 1)/ 2);

                   if (! c.move({ from: move.substr(0, 2), to: move.substring(2, 4) })) {
                      console.log('*** ERROR MOVING!!! ***');
                      console.log('Move: ' + move.substr(0, 2) + ' - ' + move.substring(2, 2));
                   }

                   build_image(c.fen());
                   fs.appendFileSync('fen', c.fen() + '\n');
                   fs.writeFileSync('pgn', c.pgn());

                   var last_move = c.pgn().replace('  ', ' ').split(' ')[c.pgn().replace('  ', ' ').split(' ').length - 1];
                   console.log(player.color + '(' + player.engine + ') moves ' + turn + '. ' + player.move + move + '(' + last_move + ')'); 
                }

                else {
                   console.log('*** ERROR FINDING MOVE!!! ***');
                }

                setTimeout(function() { process_next_move(); }, parseInt(fs.readFileSync('interval', 'utf-8').replace('\n','')));
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

