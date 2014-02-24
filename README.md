# Twitter Chess Bot

*A bot that allows two Twitter accounts to play chess against one another.*

This is a single node.js script that interfaces with a [UCI](http://wbec-ridderkerk.nl/html/UCIProtocol.html) chess engine(s) 
to process turns in a game. There are two twitter accounts: [@ChessBotWhite](https://twitter.com/ChessBotWhite) and 
[@ChessBotBlack](https://twitter.com/ChessBotBlack). On an interval the script will execute an engine, load the current 
board position into it and process a move. If it finds a valid move it updates the state in two flat files (one in 
[PGN](http://en.wikipedia.org/wiki/Portable_Game_Notation) and the other as a sequence of 
[FEN](http://en.wikipedia.org/wiki/Forsyth%E2%80%93Edwards_Notation) positions) as well as building a PNG image of the 
current board. It then tweets the board image and the last move the the opposing Twitter account depending on whose turn 
it is.

The bot supports separate engines for the two accounts. Currently White is running [Fruit](http://www.fruitchess.com/) and 
Black is running [Glaurung](http://www.glaurungchess.com/).

Piece images from [here](http://ixian.com/chess/jin-piece-sets/).

**Dependencies**
 * Node module [chess.js](https://www.npmjs.org/package/chess.js) for various chess related functionality
 * Node module [nexpect](https://www.npmjs.org/package/nexpect) for interfacing with the UCI engine
 * Node module [node-gd](https://www.npmjs.org/package/node-gd) for building the board PNG image
 * Node module [request](https://www.npmjs.org/package/request) to tweet
 * [This small twitter module](https://gist.github.com/adaline/7363853) because the Node modules I found didn't allow updating with media

**TODO**
 * Recognize end of game and automatically start a new one
 * Integrate opening books into the engines
 * Investigate using stronger move lookups
 * Replace hard-coded hashtag interval
 * Remove old FEN processing and rely solely on the chess.js object

#### Sample Tweet

<blockquote class="twitter-tweet" lang="en">
   <p><a href="https://twitter.com/ChessBotWhite">@ChessBotWhite</a> 2. ... Nc6 
      <a href="https://twitter.com/search?q=%23Chess&amp;src=hash">#Chess</a> 
      <a href="http://t.co/lfvqcyuXEm">pic.twitter.com/lfvqcyuXEm</a>
   </p>
   &mdash; Chess Bot Black (@ChessBotBlack) <a href="https://twitter.com/ChessBotBlack/statuses/436943269151637504">February 21, 2014</a></blockquote>
<script async src="//platform.twitter.com/widgets.js" charset="utf-8"></script>

#### Sample Board

![Sample Board](https://pbs.twimg.com/media/BhBVlocIUAEpLEd.png:large "Sample Board")
