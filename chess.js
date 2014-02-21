var fs      = require('fs');

// Required to build the board image using GD
// https://www.npmjs.org/package/node-gd
var gd      = require('node-gd');

// Used to spawn the gnuchess process and wait for a response after moving
// https://www.npmjs.org/package/nexpect
var nexpect = require('nexpect');
var game;

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
   game = fs.readFileSync('game', 'utf-8');
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
                   console.log(player.color + '(' + player.engine + ') moves ' + turn + '. ' + player.move + move); 

                   position = position.split(' ');
                   position[0] = adjust_fen(move, position[0]);
                   position[1] = (position[1] == 'w') ? 'b' : 'w';

                   build_image(position.join(' '));
                   fs.appendFileSync('game', position.join(' ') + '\n');
                }

                else {
                   console.log('*** ERROR FINDING MOVE!!! ***');
                }

                setTimeout(function() { process_next_move(); }, parseInt(fs.readFileSync('interval', 'utf-8').replace('\n','')));
             }
          }
   );
}

function adjust_fen(move, position) {
   var new_board = [];
   for (var i = 0; i < 8; i++) {
      new_board[i] = [];
   }

   for (var j = 0; j < 8; j++) {
      var row = position.split('/')[j]

      var col = 0;
      for (var i = 0; i < row.length; i++) {
         if (parseInt(row.charAt(i)) % 1 == 0) {
            for (var k = 0; k < row.charAt(i); k++) {
               new_board[7 - j][col] = '.';
               col++;
            }
         }
         else {
            new_board[7 - j][col] = row.charAt(i);
            col++;
         }
      }
   }

   var fromx = switch_x(move.charAt(0));
   var fromy = move.charAt(1) - 1;
   var tox   = switch_x(move.charAt(2));
   var toy   = move.charAt(3) - 1;

   // En passant
   if (new_board[toy][tox] == '.' && new_board[fromy][fromx].toUpperCase() == 'P' && fromx != tox)
      new_board[fromy][tox] = '.';

   // Promote pawn
   if (move.length == 5) 
      new_board[toy][tox] = (new_board[fromy][fromx] == new_board[fromy][fromx].toUpperCase()) ? move.charAt(4).toUpperCase() : move.charAt(4);
   else
      new_board[toy][tox] = new_board[fromy][fromx];

   // Black castle kingside
   if (new_board[toy][tox] == 'k' && fromx == 4 && tox == 6) {
      new_board[7][5] = 'r';
      new_board[7][7] = '.';
   }

   // Black castle queenside
   if (new_board[toy][tox] == 'k' && fromx == 4 && tox == 2) {
      new_board[7][3] = 'r';
      new_board[7][0] = '.';
   }

   // White castle kingside
   if (new_board[toy][tox] == 'K' && fromx == 4 && tox == 6) {
      new_board[0][5] = 'r';
      new_board[0][7] = '.';
   }

   // White castle queenside
   if (new_board[toy][tox] == 'K' && fromx == 4 && tox == 2) {
      new_board[0][3] = 'r';
      new_board[0][0] = '.';
   }

   new_board[fromy][fromx] = '.';

   var new_fen = '';
   for (var j = 7; j >= 0; j--) {
      var int_count = 0;
      var new_row = '';
      for (var i = 0; i < 8; i++) {
         if  (new_board[j][i] == '.') {
            int_count++;
         }
         else {
            if (int_count > 0) 
               new_row = new_row + int_count;

            new_row = new_row + new_board[j][i];
            int_count = 0;
         }
      }

      if (int_count > 0) 
         new_row = new_row + int_count;

      if (new_fen.length > 0) 
         new_fen = new_fen + '/';

      new_fen = new_fen + new_row;
   }

   // console.log('New: ' + new_fen);
   return new_fen;
}

function switch_x(x) {
   switch (x) {
      case 'a':
         return 0;
         break;
      case 'b':
         return 1;
         break;
      case 'c':
         return 2;
         break;
      case 'd':
         return 3;
         break;
      case 'e':
         return 4;
         break;
      case 'f':
         return 5;
         break;
      case 'g':
         return 6;
         break;
      case 'h':
         return 7;
         break;
   }
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

