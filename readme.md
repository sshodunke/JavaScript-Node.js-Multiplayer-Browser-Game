# SETUP

This readme assumes that you have already installed Node.js on your computer.  Node.js is available for
Windows, Mac and Linux, and can be downloaded at the following website: https://nodejs.org/en/

Assuming you have Node.js installed, you can install all the required modules, 
by opening a command line/PowerShell (or a Terminal on a Mac) and running the following command:
	npm install

You can then run your server with the following command:
	node DungeonServer.js
  
Open a browser and visit your client (turning your browser tab into a client) at:
	http://localhost:8080

If you have done everything correctly, you should see a maze.

You only need to install your modules once, and subsequent executions of your server can be achieved by:
	node DungeonServer.js
  
If you make changes to DungeonServer.js, you will need to stop your server (ctrl+C) and start it again.