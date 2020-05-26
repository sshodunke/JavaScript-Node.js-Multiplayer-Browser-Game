// See Real-Time Servers II: File Servers for understanding
// how we set up and use express + mysql
const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const mysql = require("mysql");

// used to setup mysql database
/*
var connection = mysql.createConnection({
	host: 'localhost',
	user: 'root',
	port: '8889',
	password: 'root'
});

// connect function to connect to the database
connection.connect(function(err) {
    if (err) {
        console.log(err);
    }
    else {
        console.log("Successfully connected to MYSQLDB");
    }
});

// try to create the database
connection.query("CREATE DATABASE IF NOT EXISTS smith_shodunke_1CWK50;", function(error, result, fields) {
	if (error) {
		console.log("Error creating database: " + error.code);
	}
	else if (result) {
		console.log("Database created successfully.");
	}
});

connection.query("USE smith_shodunke_1CWK50;", function(error, result, fields) {
	if (error) {
		console.log("Error setting database: " + error.code);
	}
	else if (result) {
		console.log("Database successfully set.");
	}
});

// drop the table before we try to create it anew
connection.query("DROP TABLE IF EXISTS dungeon_time", function(error, result, fields) {
	if (error) {
		// for a deployment app, we'd be more likely to use error.stack
		// which gives us a full stack trace
		console.log("Problem dropping dungeon_time table: " + error.code);
	}
	else if (result) {
		console.log("dungeon_time table dropped successfully.");
	}
});

// construct our query in a variable, to keep our code cleaner below
// this will create a table with two columns - playerid and time:
var createDungeonTableQuery = "CREATE TABLE dungeon_time(";
    createDungeonTableQuery += "playerid 		VARCHAR (30),";
    createDungeonTableQuery += "time 		    VARCHAR (30)";
    createDungeonTableQuery += ")";

connection.query(createDungeonTableQuery, function(error, result, fields){
	if (error) {
		console.log("Error creating dungeon_time table: " + error.code);
	}
	else if (result) {
		console.log("dungeon_time table created successfully.");
	}
});

*/

// We will use the dungeongenerator module to generate random dungeons
// Details at: https://www.npmjs.com/package/dungeongenerator
// Source at: https://github.com/nerox8664/dungeongenerator
const DungeonGenerator = require("dungeongenerator");

// We are going to serve our static pages from the public directory
// See Real-Time Servers II: File Servers for understanding
// how we set up and use express
app.use(express.static("public"));

/*  These variables store information about the dungeon that we will later
 *  send to clients. In particular:
 *  - the dungeonStart variable will store the x and y coordinates of the start point of the dungeon
 *  - the dungeonEnd variable will store the x and y coordinates of the end point of the dungeon
 *  - the dungeonOptions object contains four variables, which describe the default state of the dungeon:
 *  - - dungeon_width: the width of the dungeon (size in the x dimension)
 *  - - dungeon_height: the height of the dungeon (size in the y dimension)
 *  - - number_of_rooms: the approximate number of rooms to generate
 *  - - average_room_size: roughly how big the rooms will be (in terms of both height and width)
 *  - this object is passed to the dungeon constructor in the generateDungeon function
 */
let dungeon = {};
let dungeonStart = {};
let dungeonEnd = {};
const dungeonOptions = {
    dungeon_width: 20,
    dungeon_height: 20,
    number_of_rooms: 7,
    average_room_size: 8
};

/*
 * The getDungeonData function packages up important information about a dungeon
 * into an object and prepares it for sending in a message.
 *
 * The members of the returned object are as follows:
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
 * - startingPoint
 * -- x: the column at which players should start in the dungeon
 * -- y: the row at which players should start in the dungeon
 *
 * - endingPoint
 * -- x: the column where the goal space of the dungeon is located
 * -- y: the row where the goal space of the dungeon is located
 *
 */
function getDungeonData() {
    return {
        dungeon,
        startingPoint: dungeonStart,
        endingPoint: dungeonEnd
    };
}

// an array that holds players
var listOfPlayers = [];

// stopwatch variables
var time = 0,
    elapsedSeconds = 0,
    mins = 0,
    secs = 0;

// player object
var player={};

// timeout that increases the stopwatch time
function increment() {
    setTimeout(function() {
        time++;
        elapsedSeconds++;
        mins = Math.floor(time/10/60);
        secs = Math.floor(elapsedSeconds/10%60);
        increment();
    }, 100);
}

/*
 * This is our event handler for a connection.
 * That is to say, any code written here executes when a client makes a connection to the server
 * (i.e. when the page is loaded)
 *
 * See Real-Time Servers III: socket.io and Messaging for help understanding how
 * we set up and use socket.io
 */
io.on("connection", function (socket) {

    // player object
    player = {
        x: 0,
        y: 0,
        spriteX: 0,
        spriteY: 0,
        currentRow: 0,
        currentFrame: 0
    }

    startStopwatch();

    // Print an acknowledge to the server's console to confirm a player has connected
    console.log("A player has connected - sending dungeon data...");

    /*
     * Here we send all information about a dungeon to the client that has just connected
     * For full details about the data being sent, check the getDungeonData method
     * This message triggers the socket.on("dungeon data"... event handler in the client
     */
    socket.emit("dungeon data", getDungeonData());

    // a player has connected to the server and requests an id
    socket.on("id_request", function() {
        /*
         * creates a player id inside the socket object
         * the player id is given a random number using the random function
         * the listOfPlayers array is then given the socket object
         */
        if(socket.playerID == null) {
            socket.playerID =  Math.random();
        }
        socket.x = dungeonStart.x;
        socket.y = dungeonStart.y;
        socket.spriteX = 0;
        socket.spriteY = 0;
        socket.currentRow = 0;
        socket.currentFrame = 0;
        listOfPlayers[socket.playerID] = socket;
        console.log(listOfPlayers);

        /*
         * creates an array which will hold all player data
         * the array is cleared every time a player moves and is updated again with new player data
         * this is so that the array only holds the same amount as the amount of players connected
         * to the server
         */
       let new_data = [];

        // loop through array(holds the amonut of players in the game) and
        // push player data to new array
        for(let i in listOfPlayers) {
            let currentPlayer = listOfPlayers[i]
            new_data.push({id: currentPlayer.playerID,
                x:currentPlayer.x,
                y:currentPlayer.y,
                spriteX: currentPlayer.spriteX,
                spriteY: currentPlayer.spriteY,
                currentRow: currentPlayer.currentRow,
                currentFrame: currentPlayer.currentFrame});
        }

        // by looping through the list of players in the game and
        // assigning it to the socket variable we can
        // emit the array to every socket that is connected to the server
        for(let i in listOfPlayers) {
            let socket = listOfPlayers[i];
            socket.emit("new_player", new_data);
        }

        player.id = socket.playerID;
        player.x = socket.x;
        player.y = socket.y;
        player.spriteX = socket.spriteX;
        player.spriteY = socket.spriteY;
        player.currentRow = socket.currentRow;
        player.currentFrame = socket.currentFrame;

        // sends a message back to the client with the player id
        socket.emit("player_id", player);
    });

    // a player has moved
    socket.on("location_update", function(data) {
        /*
         * creates an array which will hold all player data
         * the array is cleared every time a player moves and is updated again
         * this is so that the array only holds the same amount as the amount of players connected
         * to the server
         */
        let new_data = []

        // the data recieved from the server is a string which contains the direction a player has moved
        // the player is updated depending on the data that was recieved from the server

        if(data.direction == "right") {
            listOfPlayers[data.player.id].x++;
            socket.currentRow = 3;
            data.direction = "";
        }

        if(data.direction == "left") {
            listOfPlayers[data.player.id].x--;
            socket.currentRow = 2;
            data.direction = "";
        }

        if(data.direction == "up") {
            listOfPlayers[data.player.id].y--;
            socket.currentRow = 1;
            data.direction = "";
        }

        if(data.direction == "down") {
            listOfPlayers[data.player.id].y++;
            socket.currentRow = 0;
            data.direction = "";
        }

        // loop through array(holds the amonut of players in the game) and
        // push player data to new array
        for(let i in listOfPlayers) {
            let currentPlayer = listOfPlayers[i]
            new_data.push({id: currentPlayer.playerID,
                x:currentPlayer.x,
                y:currentPlayer.y,
                spriteX: currentPlayer.spriteX,
                spriteY: currentPlayer.spriteY,
                currentRow: currentPlayer.currentRow,
                currentFrame: currentPlayer.currentFrame});
        }

        /*
         * by looping through the list of players in the game and
         * assigning it to the socket variable we can
         * emit the array to every socket that is connected to the server
         */
        for(let i in listOfPlayers) {
            let socket = listOfPlayers[i];
            socket.emit("updated_locations", new_data);
        }

        // if the player has reached the end of the dungeon
        if (socket.x == dungeonEnd.x && socket.y == dungeonEnd.y) {
            generateDungeon();
            for(let i in listOfPlayers) {
                let socket = listOfPlayers[i];
                socket.emit("dungeon data", getDungeonData());
            }

            // keep time in correct format
            if(mins < 10) {
                mins = "0" + mins;
            }
            if (secs < 10) {
                secs = "0" + secs;
            }

            // data to store in the database
            end_time = mins + " : " + secs;

            // object used to insert data into the database, includes the playerid and the time
            dungeonInsert = {
                playerid: socket.playerID,
                time : end_time
            }

            /*
            // query to insert data into the database
            connection.query("INSERT INTO dungeon_time SET ?", dungeonInsert, function(error, results, fields) {
                if (error) {
                    console.log(error.stack);
                }

                if (results) {
                    // uncomment the below for a success message - there will be a lot!
                    console.log("Row inserted successfully.");
                }
            })
            */

            // reset the timer
            reset();
        }
    });

    // a player client lost connection to the server
    socket.on('disconnect', function(){
        console.log("The player '" + socket.playerID + "' has lost connection");
        delete listOfPlayers[socket.playerID];
    });

    // Stopwatch functions
    function reset() {
        time = 0;
        elapsedSeconds = 0;
    }

    function startStopwatch() {
        stopwatch();
    }

    // timeout function that constantly emits the current time to the client
    function stopwatch() {
        setTimeout(function() {
            socket.emit("timer", mins, secs);
            stopwatch();
        }, 100);
    }
});

/*
 * This method locates a specific room, based on a given index, and retrieves the
 * centre point, and returns this as an object with an x and y variable.
 * For example, this method given the integer 2, would return an object
 * with an x and y indicating the centre point of the room with an id of 2.
 */
function getCenterPositionOfSpecificRoom(roomIndex) {
    let position = {
        x: 0,
        y: 0
    };

    for (let i = 0; i < dungeon.rooms.length; i++) {
        let room = dungeon.rooms[i];
        if (room.id === roomIndex) {
            position.x = room.cx;
            position.y = room.cy;
            return position;
        }
    }
    return position;
}

/*
 * The generateDungeon function uses the dungeongenerator module to create a random dungeon,
 * which is stored in the 'dungeon' variable.
 *
 * Additionally, we find a start point (this is always the centre point of the first generated room)
 * and an end point is located (this is always the centre point of the last generated room).
 */
function generateDungeon() {
    dungeon = new DungeonGenerator(
        dungeonOptions.dungeon_height,
        dungeonOptions.dungeon_width,
        dungeonOptions.number_of_rooms,
        dungeonOptions.average_room_size
    );
    console.log(dungeon);
    dungeonStart = getCenterPositionOfSpecificRoom(2);
    dungeonEnd = getCenterPositionOfSpecificRoom(dungeon._lastRoomId - 1);
}

/*
 * Start the server, listening on port 8080.
 * Once the server has started, output confirmation to the server's console.
 * After initial startup, generate a dungeon, ready for the first time a client connects.
 */
server.listen(8080, function () {
    console.log("Dungeon server has started - connect to http://localhost:8080");
    generateDungeon();
    increment();
    console.log("Initial dungeon generated!");
});
