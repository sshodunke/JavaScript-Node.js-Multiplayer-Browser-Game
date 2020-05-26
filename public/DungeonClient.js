/*
 * These three variables hold information about the dungeon, received from the server
 * via the "dungeon data" message. Until the first message is received, they are
 * initialised to empty objects.
 *
 * - dungeon, an object, containing the following variables:
 * -- maze: a 2D array of integers, with the following numbers:
 * --- 0: wall
 * --- 1: corridor
 * --- 2+: numbered rooms, with 2 being the first room generated, 3 being the next, etc.
 * -- h: the height of the dungeon (y dimension)
 * -- w: the width of the dungeon (x dimension)
 * -- rooms: an array of objects describing the rooms in the dungeon, each object contains:
 * --- id: the integer representing this room in the dungeon (e.g. 2 for the first room)
 * --- h: the height of the room (y dimension)
 * --- w: the width of the room (x dimension)
 * --- x: the x coordinate of the top-left corner of the room
 * --- y: the y coordinate of the top-left corner of the room
 * --- cx: the x coordinate of the centre of the room
 * --- cy: the y coordinate of the centre of the room
 * -- roomSize: the average size of the rooms (as used when generating the dungeon)
 * -- _lastRoomId: the id of the next room to be generated (so _lastRoomId-1 is the last room in the dungeon)
 *
 * - dungeonStart
 * -- x, the row at which players should start in the dungeon
 * -- y, the column at which players should start in the dungeon
 *
 * - dungeonEnd
 * -- x, the row where the goal space of the dungeon is located
 * -- y, the column where the goal space of the dungeon  is located
 */
let dungeon = {};
let dungeonStart = {};
let dungeonEnd = {};

// load a spritesheet (dungeon_tiles.png) which holds the tiles
// we will use to draw the dungeon
// Art by MrBeast. Commissioned by OpenGameArt.org (http://opengameart.org)
const tilesImage = new Image(); 
tilesImage.src = "dungeon_tiles.png";

/*
 * Player Sprite Sheet
 * Art by arikel. Commissioned by OpenGameArt.org (http://opengameart.org)
 * https://opengameart.org/content/2d-rpg-character-walk-spritesheet
 */
//load a spritesheet which holds the player sprite
const playerSprite = new Image();
playerSprite.src = "player_sprite.png";
// dimensions of the character spritesheet
const playerSheet_width = 192;
const playerSheet_height = 128;
// columns and row of spritesheet
const cols = 8;
const rows = 4;

/*
 * Side Player Sprite Sheet
 * Art by arikel. Commissioned by OpenGameArt.org (http://opengameart.org)
 * https://opengameart.org/content/thief-0
 */
//load a spritesheet which holds the secondary player sprite
const sidePlayerSprite = new Image();
sidePlayerSprite.src = "player_sprite_2_.png";
// dimensions of the character spritesheet
const sidePlayerSheet_width = 72;
const sidePlayerSheet_height = 128;
// columns and row of spritesheet
const sideCols = 3;
const sideRows = 4;

/* 
 * Establish a connection to our server
 * We will need to reuse the 'socket' variable to both send messages
 * and receive them, by way of adding event handlers for the various
 * messages we expect to receive
 *
 * Replace localhost with a specific URL or IP address if testing
 * across multiple computers
 *
 * See Real-Time Servers III: socket.io and Messaging for help understanding how
 * we set up and use socket.io
 */
const socket = io.connect("http://localhost:8080");

/*
 * This is the event handler for the 'dungeon data' message
 * When a 'dungeon data' message is received from the server, this block of code executes
 * 
 * The server is sending us either initial information about a dungeon, or,
 * updated information about a dungeon, and so we want to replace our existing
 * dungeon variables with the new information.
 *
 * We know the specification of the information we receive (from the documentation
 * and design of the server), and use this to help write this handler.
 */
socket.on("dungeon data", function (data) {
    dungeon = data.dungeon;
    dungeonStart = data.startingPoint;
    dungeonEnd = data.endingPoint;
    // request a player id and player from the server
    socket.emit("id_request",);
});


/*
 * The event handler for the 'player id' message
 * this message sends the client a player object which contains a unique id used to identify
 * the player 
 */
socket.on("player_id", function(data) {
    player = data
    console.log("you have been given the player id: " + data.id);
});

/*
 * The event handler for the 'new player' message
 * upon receiving this message the client will store the data(which is an array of players)
 * in a variable called playerList
 * This array holds information about every player that is connected to the game and is received
 * every time a player joins the server
 * By doing this we can ensure that players data are obtained right as they join the server
 * rather than waiting for the player to move
 */
var playerList = []
socket.on("new_player", function(data) {
    playerList = data;
});  

/*
 * The event handler for the 'updated_locations' message
 * upon receiving this message the client will update the playerList array with
 * the data that was just recieved from the server. The data holds an array with
 * the updated x,y co-ordinates of players.
 * A for loop is also used by checking for the player id in the array and matching it 
 * with the one in the client. Once a match is found the player object held in the client is updated
 */
socket.on("updated_locations", function(data){
    playerList = data;
    for(let i in playerList) {
        if (playerList[i].id == player.id) {
            player.x = playerList[i].x;
            player.y = playerList[i].y;
        }
    }
}) 

/*
 * The identifySpaceType function takes an x, y coordinate within the dungeon and identifies
 * which type of tile needs to be drawn, based on which directions it is possible
 * to move to from this space. For example, a tile from which a player can move up
 * or right from needs to have walls on the bottom and left.
 *
 * Once a tile type has been identified, the necessary details to draw this
 * tile are returned from this method. Those details specificallwy are:
 * - tilesetX: the x coordinate, in pixels, within the spritesheet (dungeon_tiles.png) of the top left of the tile
 * - tilesetY: the y coordinate, in pixels, within the spritesheet (dungeon_tiles.png) of the top left of the tile
 * - tilesizeX: the width of the tile
 * - tilesizeY: the height of the tile
 */
function identifySpaceType(x, y) {

    let returnObject = {
        spaceType: "",
        tilesetX: 0,
        tilesetY: 0,
        tilesizeX: 16,
        tilesizeY: 16,
        canMoveRight: false,
        canMoveLeft: false,
        canMoveUp: false,
        canMoveDown: false
    };

    let canMoveUp = false;
    let canMoveLeft = false;
    let canMoveRight = false;
    let canMoveDown = false;

    // check for out of bounds (i.e. this move would move the player off the edge,
    // which also saves us from checking out of bounds of the array) and, if not
    // out of bounds, check if the space can be moved to (i.e. contains a corridor/room)
    if (x - 1 >= 0 && dungeon.maze[y][x - 1] > 0) {
        canMoveLeft = true;
    }
    if (x + 1 < dungeon.w && dungeon.maze[y][x + 1] > 0) {
        canMoveRight = true;
    }
    if (y - 1 >= 0 && dungeon.maze[y - 1][x] > 0) {
        canMoveUp = true;
    }
    if (y + 1 < dungeon.h && dungeon.maze[y + 1][x] > 0) {
        canMoveDown = true;
    }

    if (canMoveUp && canMoveRight && canMoveDown && canMoveLeft) {
        returnObject.spaceType = "all_exits";
        returnObject.tilesetX = 16;
        returnObject.tilesetY = 16;
        returnObject.canMoveRight = canMoveRight;
        returnObject.canMoveLeft = canMoveLeft;
        returnObject.canMoveDown = canMoveDown;
        returnObject.canMoveUp = canMoveUp;
    }
    else if (canMoveUp && canMoveRight && canMoveDown) {
        returnObject.spaceType = "left_wall";
        returnObject.tilesetX = 0;
        returnObject.tilesetY = 16;
        returnObject.canMoveRight = canMoveRight;
        returnObject.canMoveLeft = canMoveLeft;
        returnObject.canMoveDown = canMoveDown;
        returnObject.canMoveUp = canMoveUp;
    }
    else if (canMoveRight && canMoveDown && canMoveLeft) {
        returnObject.spaceType = "up_wall";
        returnObject.tilesetX = 16;
        returnObject.tilesetY = 0;
        returnObject.canMoveRight = canMoveRight;
        returnObject.canMoveLeft = canMoveLeft;
        returnObject.canMoveDown = canMoveDown;
        returnObject.canMoveUp = canMoveUp;
    }
    else if (canMoveDown && canMoveLeft && canMoveUp) {
        returnObject.spaceType = "right_wall";
        returnObject.tilesetX = 32;
        returnObject.tilesetY = 16;
        returnObject.canMoveRight = canMoveRight;
        returnObject.canMoveLeft = canMoveLeft;
        returnObject.canMoveDown = canMoveDown;
        returnObject.canMoveUp = canMoveUp;
    }
    else if (canMoveLeft && canMoveUp && canMoveRight) {
        returnObject.spaceType = "down_wall";
        returnObject.tilesetX = 16;
        returnObject.tilesetY = 32;
        returnObject.canMoveRight = canMoveRight;
        returnObject.canMoveLeft = canMoveLeft;
        returnObject.canMoveDown = canMoveDown;
        returnObject.canMoveUp = canMoveUp;
    }
    else if (canMoveUp && canMoveDown) {
        returnObject.spaceType = "vertical_corridor";
        returnObject.tilesetX = 144;
        returnObject.tilesetY = 16;
        returnObject.canMoveRight = canMoveRight;
        returnObject.canMoveLeft = canMoveLeft;
        returnObject.canMoveDown = canMoveDown;
        returnObject.canMoveUp = canMoveUp;
    }
    else if (canMoveLeft && canMoveRight) {
        returnObject.spaceType = "horizontal_corridor";
        returnObject.tilesetX = 112;
        returnObject.tilesetY = 32;
        returnObject.canMoveRight = canMoveRight;
        returnObject.canMoveLeft = canMoveLeft;
        returnObject.canMoveDown = canMoveDown;
        returnObject.canMoveUp = canMoveUp;
    }
    else if (canMoveUp && canMoveLeft) {
        returnObject.spaceType = "bottom_right";
        returnObject.tilesetX = 32;
        returnObject.tilesetY = 32;
        returnObject.canMoveRight = canMoveRight;
        returnObject.canMoveLeft = canMoveLeft;
        returnObject.canMoveDown = canMoveDown;
        returnObject.canMoveUp = canMoveUp;
    }
    else if (canMoveUp && canMoveRight) {
        returnObject.spaceType = "bottom_left";
        returnObject.tilesetX = 0;
        returnObject.tilesetY = 32;
        returnObject.canMoveRight = canMoveRight;
        returnObject.canMoveLeft = canMoveLeft;
        returnObject.canMoveDown = canMoveDown;
        returnObject.canMoveUp = canMoveUp;
    }
    else if (canMoveDown && canMoveLeft) {
        returnObject.spaceType = "top_right";
        returnObject.tilesetX = 32;
        returnObject.tilesetY = 0;
        returnObject.canMoveRight = canMoveRight;
        returnObject.canMoveLeft = canMoveLeft;
        returnObject.canMoveDown = canMoveDown;
        returnObject.canMoveUp = canMoveUp;
    }
    else if (canMoveDown && canMoveRight) {
        returnObject.spaceType = "top_left";
        returnObject.tilesetX = 0;
        returnObject.tilesetY = 0;
        returnObject.canMoveRight = canMoveRight;
        returnObject.canMoveLeft = canMoveLeft;
        returnObject.canMoveDown = canMoveDown;
        returnObject.canMoveUp = canMoveUp;
    }
    return returnObject;
}

// this function is called every single time the player moves
// data including the position of the player is sent to the server
function checkPlayerMove(direction) {
    socket.emit("location_update", {player: player, direction: direction});
}

/*
 * Once our page is fully loaded and ready, we call startAnimating
 * to kick off our animation loop.
 * We pass in a value - our fps - to control the speed of our animation.
 */
$(document).ready(function () {
    startAnimating(20);

    // event handler is attached to body as canvas does not have focus
    // event handler for key presses - key presses control player movement
    $("body").keydown(function(playerMovement) {

        // function to check if the player can move into space
        let currentTile = identifySpaceType(player.x,player.y);

        // if right arrow key is pressed, move right
        if(playerMovement.which == 39) {
            // if player can move right then move player
            if(currentTile.canMoveRight) {
                checkPlayerMove("right");
            }
        }

        // if left arrow key is pressed, move left
        if(playerMovement.which == 37) {
            // if player can move left then move player
            if(currentTile.canMoveLeft) {
                checkPlayerMove("left");
            }
        }   
        
        // if up arrow key is pressed, move up
        if(playerMovement.which == 38) {
            // if player can move up then move player
            if (currentTile.canMoveUp) {
                checkPlayerMove("up");
            }
        }

        // if down arrow key is pressed, move down
        if(playerMovement.which == 40) {
            // if player can move down then move player
            if (currentTile.canMoveDown) {
                checkPlayerMove("down");
            }
        }        
        
        
    });

    // Click Movement
    // first button - left button
    $("#leftbtn").click(function() {
        // function to check if the player can move into space
        let currentTile = identifySpaceType(player.x,player.y);

        // if player can move left then move player
        if(currentTile.canMoveLeft) {
            checkPlayerMove("left");
        }
    });

    // second button - right button
    $("#rightbtn").click(function() {
        // function to check if the player can move into space
        let currentTile = identifySpaceType(player.x,player.y);

        // if player can move right then move player
        if(currentTile.canMoveRight) {
            checkPlayerMove("right");
        }
    });

    // third button - up button
    $("#upbtn").click(function() {
        // function to check if the player can move into space
        let currentTile = identifySpaceType(player.x,player.y);

        // if player can move up then move player
        if(currentTile.canMoveUp) {
            checkPlayerMove("up");
        }
    });
    
    // fourth button - down button
    $("#downbtn").click(function() {
        // function to check if the player can move into space
        let currentTile = identifySpaceType(player.x,player.y);

        // if player can move down then move player
        if(currentTile.canMoveDown) {
            checkPlayerMove("down");
        }
    });

    //
    // Touch movement
    // first button - left button
    $("#leftbtn").on('touchstart', function() {
        // function to check if the player can move into space
        let currentTile = identifySpaceType(player.x,player.y);

        // if player can move left then move player
        if(currentTile.canMoveLeft) {
            checkPlayerMove("left");
        }
    });

    // second button - right button
    $("#rightbtn").on('touchstart', function() {
        // function to check if the player can move into space
        let currentTile = identifySpaceType(player.x,player.y);

        // if player can move right then move player
        if(currentTile.canMoveRight) {
            checkPlayerMove("right");
        }
    });

    // third button - up button
    $("#upbtn").on('touchstart', function() {
        // function to check if the player can move into space
        let currentTile = identifySpaceType(player.x,player.y);

        // if player can move up then move player
        if(currentTile.canMoveUp) {
            checkPlayerMove("up");
        }
    });
    
    // fourth button - down button
    $("#downbtn").on('touchstart', function() {
        // function to check if the player can move into space
        let currentTile = identifySpaceType(player.x,player.y);

        // if player can move down then move player
        if(currentTile.canMoveDown) {
            checkPlayerMove("down");
        }
    });
    
    // updates the timer on the client using data recieved from the server
    socket.on("timer", function(mins, secs) {

        if(mins < 10) {
            mins = "0" + mins;
        }

        if (secs < 10) {
            secs = "0" + secs;
        }
        $("#timer").html(mins + ":" + secs);   
    }); 

});

let fpsInterval;
let then;

/*
 * The startAnimating function kicks off our animation (see Games on the Web I - HTML5 Graphics and Animations).
 */
function startAnimating(fps) {
    fpsInterval = 1000 / fps;
    then = Date.now();
    animate();
}

/*
 * The animate function is called repeatedly using requestAnimationFrame (see Games on the Web I - HTML5 Graphics and Animations).
 */
function animate() {
    requestAnimationFrame(animate);

    let now = Date.now();
    let elapsed = now - then;

    if (elapsed > fpsInterval) {
        then = now - (elapsed % fpsInterval);
        // Acquire both a canvas (using jQuery) and its associated context
        let canvas = $("canvas").get(0);
        let context = canvas.getContext("2d");

        // Calculate the width and height of each cell in our dungeon
        // by diving the pixel width/height of the canvas by the number of
        // cells in the dungeon
        let cellWidth = canvas.width / dungeon.w;
        let cellHeight = canvas.height / dungeon.h;

        // Clear the drawing area each animation cycle
        context.clearRect(0, 0, canvas.width, canvas.height);

        /* We check each one of our tiles within the dungeon using a nested for loop
         * which runs from 0 to the width of the dungeon in the x dimension
         * and from 0 to the height of the dungeon in the y dimension
         *
         * For each space in the dungeon, we check whether it is a space that can be
         * moved into (i.e. it isn't a 0 in the 2D array), and if so, we use the identifySpaceType
         * method to check which tile needs to be drawn.
         *
         * This returns an object containing the information required to draw a subset of the
         * tilesImage as appropriate for that tile.
         * See: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage
         * to remind yourself how the drawImage method works.
         */
        for(let x = 0; x < dungeon.w; x++) {
            for (let y = 0; y < dungeon.h; y++) {
                if (dungeon.maze[y][x] > 0) {
                    let tileInformation = identifySpaceType(x, y);
                    context.drawImage(tilesImage,
                        tileInformation.tilesetX,
                        tileInformation.tilesetY,
                        tileInformation.tilesizeX,
                        tileInformation.tilesizeY,
                        x * cellWidth,
                        y * cellHeight,
                        cellWidth,
                        cellHeight);
                } else {
                    context.fillStyle = "black";
                    context.fillRect(
                        x * cellWidth,
                        y * cellHeight,
                        cellWidth,
                        cellHeight
                    );
                }
            }
        }

        // The start point is calculated by multiplying the cell location (dungeonStart.x, dungeonStart.y)
        // by the cellWidth and cellHeight respectively
        // Refer to: Games on the Web I - HTML5 Graphics and Animations, Lab Exercise 2
        context.drawImage(tilesImage,
            16, 80, 16, 16,
            dungeonStart.x * cellWidth,
            dungeonStart.y * cellHeight,
            cellWidth,
            cellHeight);

        // The goal is calculated by multiplying the cell location (dungeonEnd.x, dungeonEnd.y)
        // by the cellWidth and cellHeight respectively
        // Refer to: Games on the Web I - HTML5 Graphics and Animations, Lab Exercise 2
        context.drawImage(tilesImage,
            224, 80, 16, 16,
            dungeonEnd.x * cellWidth,
            dungeonEnd.y * cellHeight,
            cellWidth,
            cellHeight);
        
        // draw players
        for(let i in playerList) {
            // draws the sprite that is controlled by the client      
            if (playerList[i].id == player.id) {
                // width and height for a frame in the spritesheet
                let frameWidth = playerSheet_width / cols;
                let frameHeight = playerSheet_height / rows;       
                
                // function to update the frames of the player and animate the sprite
                // currentRow is the frame/postion the player sprite is facing
                function updateFrame(currentRow, currentFrame) {
                    currentFrame = ++player.currentFrame % cols;
                    player.spriteX = currentFrame * frameWidth;
                    player.spriteY = currentRow * frameHeight;
                }
                
                // updates the player frame
                updateFrame(playerList[i].currentRow, playerList[i].currentFrame);    
                context.drawImage(playerSprite, player.spriteX, player.spriteY, frameWidth, frameHeight, playerList[i].x*cellWidth, playerList[i].y*cellHeight, cellWidth, cellHeight);
            }

            // draws the other players
            else {
                // width and height for a frame in the spritesheet
                let frameWidth = sidePlayerSheet_width / sideCols;
                let frameHeight = sidePlayerSheet_height / sideRows;   

                // function to update the frames of the player
                // currentRow is the frame/postion the player sprite is facing
                function updateFrame(currentRow, currentFrame) {
                    currentFrame = ++playerList[i].currentFrame % sideCols;
                    playerList[i].spriteX = currentFrame * frameWidth;
                    playerList[i].spriteY = currentRow * frameHeight;
                }
                
                // updates the player frame
                updateFrame(playerList[i].currentRow, playerList[i].currentFrame);
                context.drawImage(sidePlayerSprite, playerList[i].spriteX, playerList[i].spriteY, frameWidth, frameHeight, playerList[i].x*cellWidth, playerList[i].y*cellHeight, cellWidth, cellHeight);                
            }
        }
    }
}

