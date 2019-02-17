
var express = require('express');
var app = express();
var serv = require('http').Server(app);



serv.listen(8000);
console.log("Server started");




//mechanics...
var start_timer;
var game_timer;
var group_wolves = false;
var CHOICE_BUFFER = [];
var CURRENT_ROLE_INDEX = -1;
var CURRENT_ROLE = 'doppelganger';
var GAME_STARTED = false;
var DAY_STARTED = false;
var NUM_ROLES = 11;
var NUM_PLAYERS = 0;
var ROLE_LIST = ['doppelganger',
	'werewolf',
	'minion',
	'mason',
	'seer',
	'robber',
	'troublemaker',
	'drunk',
	'insomniac',
	'hunter',
	'tanner'
		];
var PLAYER_ROLES_LIST = [];
var PLAYER_ID_NAME_LIST = []; //{ index, name }
//...

var SOCKET_LIST = {};
var PLAYER_LIST = {};

var Player = function(id) {
	var self = {
		x:250,
		y:250,
		id:id,
		index:0,
		name:'player',
		isAdmin:false,
		isActive:false,
		role_initial:'void',
		role_current:'void',
		learned:' ',
		vote:' ',
		pressingLeft:false,
		pressingRight:false,
		pressingUp:false,
		pressingDown:false,
		maxSpeed:10,
	}
	self.updatePosition = function() {
		if(self.pressingLeft)
			self.x -= self.maxSpeed;
		if(self.pressingRight)
			self.x += self.maxSpeed;
		if(self.pressingUp)
			self.y -= self.maxSpeed;
		if(self.pressingDown)
			self.y += self.maxSpeed;
	}
	return self;
}

var io = require('socket.io')(serv, {});
io.configure(function () {
	io.set("transports", ["xhr-polling"]);
	io.set("polling duration", 10);
});

io.sockets.on('connection', function(socket) {
	console.log('socket connection');
	socket.id = Math.random();
	NUM_PLAYERS++;
	console.log('UID %s connected (NUM_PLAYERS=%s)', socket.id, NUM_PLAYERS);

	socket.x = 0;
	socket.y = 0;
	socket.name = 'player';
	SOCKET_LIST[socket.id] = socket;

	var player = Player(socket.id);
	PLAYER_LIST[socket.id] = player;

	socket.on('add name', function(data) {
		if(PLAYER_LIST[socket.id].isAdmin && !GAME_STARTED) {
			if(data === '0')
				popRole();
			else if(data === '1')
				pushRole('doppelganger');
			else if(data === '2')
				pushRole('werewolf');
			else if(data === '3')
				pushRole('minion');
			else if(data === '4')
				pushRole('mason');
			else if(data === '5')
				pushRole('seer');
			else if(data === '6')
				pushRole('robber');
			else if(data === '7')
				pushRole('troublemaker');
			else if(data === '8')
				pushRole('drunk');
			else if(data === '9')
				pushRole('insomniac');
			else if(data === '10')
				pushRole('hunter');
			else if(data === '11')
				pushRole('tanner');
			else if(data === 'go' && PLAYER_ROLES_LIST.length === (NUM_PLAYERS + 3))
				start_game();
		}
		if(GAME_STARTED && !DAY_STARTED) {
			CHOICE_BUFFER.push(parseInt(data) - 1);
			console.log('push %s', data);
		}

		//admin can only execute these commands when game begins
		if(PLAYER_LIST[socket.id].isAdmin && GAME_STARTED) {
			if(data === 're') {
				GAME_STARTED = false;
				DAY_STARTED = false;
				CURRENT_ROLE_INDEX = -1;
				CURRENT_ROLE = 'doppelganger';
				group_wolves = false;
				for(var i in PLAYER_LIST) {
					PLAYER_LIST[i].learned = ' ';
					PLAYER_LIST[i].isActive = false;
					PLAYER_LIST[i].role_initial = 'void';
					PLAYER_LIST[i].role_current = 'void';
					PLAYER_LIST[i].vote = ' ';
				}
			}
			if(data === 'v') { //admin ends the game early if all have voted
				var all_ready = true;
				for(var i in PLAYER_LIST) {
					if(PLAYER_LIST[i].vote != ' ') { //MAY NEED FIXING TO CHECK IF CORRECT VALUE! (check if int in range and not self...)
						//cast vote...
					}
				}

			}
		}

		if(DAY_STARTED) { //daytime has started
			var index = parseInt(data) - 1;
			var choice = PLAYER_LIST[socket.id].index - 1;
			if(choice != index && choice >= 0 && choice < NUM_PLAYERS) { //can't be yourself, must be in range
				PLAYER_LIST[socket.id].vote = PLAYER_ID_NAME_LIST[index].name;
			}
		}

		if(data === 'ADMIN') { //give player special privelleges
			PLAYER_LIST[socket.id].isAdmin = true;
			console.log('granting admin privelleges');
		}
		else if(data === 'UNADMIN') {
			PLAYER_LIST[socket.id].isAdmin = false;
		}
		else if(data.length > 2) {
			PLAYER_LIST[socket.id].name = data;
			console.log('===> UID %s added name: %s', socket.id, data);
		}
	});
	socket.on('disconnect', function() {
		delete SOCKET_LIST[socket.id];
		delete PLAYER_LIST[socket.id];
		NUM_PLAYERS--;
		console.log('UID %s disconnected (NUM_PLAYERS=%s)', socket.id, NUM_PLAYERS);
	});

	socket.on('keyPress', function(data) {
		if(data.inputId === 'left')
			player.pressingLeft = data.state;
		else if(data.inputId === 'right')
			player.pressingRight = data.state;
		else if(data.inputId === 'up')
			player.pressingUp = data.state;
		else if(data.inputId === 'down')
			player.pressingDown = data.state;
	});
});

app.post("/", function (req, res) {
	Player.name = req.body.username;
	console.log('UID ... entered name: %s', req.body.username)
});

setInterval(function() {
	var pack = [];
	for(var i in PLAYER_LIST) {
		var player = PLAYER_LIST[i];
		player.updatePosition();
		pack.push({
			x:player.x,
			y:player.y,
			name:player.name
		});
	}

	//emit info to draw to each socket
	for(var i in SOCKET_LIST) {
		var socket = SOCKET_LIST[i];
		socket.emit('clear');
		if(!GAME_STARTED) {
			socket.emit('newPositions', pack, NUM_PLAYERS, GAME_STARTED, 
				PLAYER_ROLES_LIST);
		}
		else {
			socket.emit('display role', PLAYER_LIST[socket.id].role_initial, GAME_STARTED);
			socket.emit('draw players', NUM_PLAYERS, PLAYER_ID_NAME_LIST);
			socket.emit('learn', PLAYER_LIST[socket.id].learned);
		}

		if(PLAYER_LIST[socket.id].isActive &&
			PLAYER_LIST[socket.id].role_initial ===  CURRENT_ROLE) {
			socket.emit('instructions', get_instructions(PLAYER_LIST[socket.id].role_initial));
		}

		if(DAY_STARTED) {
			socket.emit('vote', PLAYER_LIST[socket.id].vote);
		}

		socket.emit('settings',
			ROLE_LIST,
			NUM_ROLES,
			PLAYER_ROLES_LIST,
			NUM_PLAYERS,
			PLAYER_ID_NAME_LIST,
			GAME_STARTED,
			PLAYER_LIST[socket.id].isAdmin);
	}

	//var timer;
	//var start;
	//var end;
	//var date;
	var time_given = 10000;
	var cooldown = 2000;
	
	if(CURRENT_ROLE_INDEX < NUM_ROLES) { //day has not begun yet
		if(GAME_STARTED && all_players_inactive()) {

			start_timer = new Date().getTime() / 1000; //time in seconds	

			CURRENT_ROLE_INDEX++;
			CURRENT_ROLE = ROLE_LIST[CURRENT_ROLE_INDEX];

			var role_pack = prompt_role(CURRENT_ROLE);
			var id_list = role_pack.id_list;
			var use_timer = role_pack.timer;

			if(use_timer) { //means that this role is in the current game
				console.log('current turn: %s, %s', CURRENT_ROLE_INDEX, CURRENT_ROLE);

				if(id_list.length == 0) {
					//just make all players active...
					for(var p in PLAYER_LIST) {
						PLAYER_LIST[p].isActive = true;
					}
					setTimeout(function() {
						console.log('%s done (CENTER)\n', CURRENT_ROLE);
						setTimeout(function() {
							for(var p in PLAYER_LIST) {
								PLAYER_LIST[p].isActive = false;
							}
						}, cooldown);
					}, time_given);
				}
				else if(id_list.length == 1) {
					var socket = SOCKET_LIST[id_list[0]];
					PLAYER_LIST[socket.id].isActive = true;
					setTimeout(function() {
						console.log('%s done (%s)\n',
							CURRENT_ROLE,
							PLAYER_LIST[socket.id].name);

						PLAYER_LIST[socket.id].learned = do_night_action(socket.id,
							PLAYER_LIST[socket.id].index,
							CURRENT_ROLE);

						setTimeout(function() {
							PLAYER_LIST[socket.id].isActive = false;
						}, cooldown);

					}, time_given);
				}
				else if(id_list.length == 2) {
					if(CURRENT_ROLE === 'werewolf')
						group_wolves = true;
					var socket1 = SOCKET_LIST[id_list[0]];
					var socket2 = SOCKET_LIST[id_list[1]];
					PLAYER_LIST[socket1.id].isActive = true;
					PLAYER_LIST[socket2.id].isActive = true;
					setTimeout(function() {
						console.log('%s done (%s)\n',
							CURRENT_ROLE,
							PLAYER_LIST[socket1.id].name);
						console.log('%s done (%s)\n',
							CURRENT_ROLE,
							PLAYER_LIST[socket2.id].name);

						PLAYER_LIST[socket1.id].learned = do_group_action(socket1.id, CURRENT_ROLE);
						PLAYER_LIST[socket2.id].learned = do_group_action(socket2.id, CURRENT_ROLE);

						setTimeout(function() {
							PLAYER_LIST[socket1.id].isActive = false;
							PLAYER_LIST[socket2.id].isActive = false;
						}, cooldown);

					}, time_given);
				}
			}
		}
		else if(GAME_STARTED) {
			var current_time = new Date().getTime() / 1000;
			timer = Math.round((time_given / 10) - (current_time - start_timer) * 100) / 100;
			if(timer < 0)
				timer = '0.00';
			for(var i in SOCKET_LIST) {
				var socket = SOCKET_LIST[i];
				socket.emit('turn info', CURRENT_ROLE, timer);
			}
		}
		if(CURRENT_ROLE_INDEX + 1 > NUM_ROLES) {
			console.log('BEGIN!');
			DAY_STARTED = true;
			start_timer = new Date().getTime() / 1000;
			setTimeout(function() {
				//FUNCTION IN HERE FINISHES UP THE GAME!!
				console.log('SHOOT!');

				var kill_list = [];
				for(var i = 0; i < NUM_PLAYERS; i++)
					kill_list.push(0);

				for(var i in SOCKET_LIST) //get votes
					kill_list[SOCKET_LIST[i].vote - 1] += 1;

				var largest_count = 0;
				//get votes, find players with highest vote count, display to users
				for(var i = 0; i < NUM_PLAYERS; i++) {
					if(kill_list[i] > largest_count)
						largest_count = kill_list[i];
				}

				var final_vote = [];
				for(var i = 0; i < NUM_PLAYERS; i++) {
					if(kill_list[i] == largest_count)
						final_vote.push(PLAYER_ID_NAME_LIST[i].name
							+ '/' +  PLAYER_ROLES_LIST[i]);
				}
					
				for(var i in SOCKET_LIST) {
					var socket = SOCKET_LIST[i];
					socket.emit('result', final_vote);
				}

			}, 10000); //10 seconds
		}
	}
	else { //DAY TIME START
		var current_time = new Date().getTime() / 1000;
		timer = Math.round((300000 / 10) - (current_time - start_timer) * 100) / 100;
		if(timer < 0)
			timer = '0.00';
		for(var i in SOCKET_LIST) {
			var socket = SOCKET_LIST[i];
			socket.emit('turn info', 'DAY TIME', timer);
			socket.emit('vote', PLAYER_LIST[socket.id].vote);
		}
	}
}, 1000/25); 
// --------------------------------------------------------------------------------------- //


function all_players_inactive() {
	for(var i in PLAYER_LIST) {
		if(PLAYER_LIST[i].isActive) {
			return false;
		}
	}
	return true;
}

function pushRole(role) {
	if(PLAYER_ROLES_LIST.length < NUM_PLAYERS + 3)
		PLAYER_ROLES_LIST.push(role);
}

function popRole() {
	PLAYER_ROLES_LIST.pop();
}

function shuffle(a) {
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

var mid_left = 'mid-left';
var mid_center = 'mid-center';
var mid_right = 'mid-right';

function start_game() {

	PLAYER_ID_NAME_LIST = [];

	//give each player an index
	var index = 1;
	for(var i in PLAYER_LIST) {
		var playerIdName = {name:PLAYER_LIST[i].name,id:PLAYER_LIST[i].id};
		PLAYER_ID_NAME_LIST.push(playerIdName);
		console.log('%s. %s', index, PLAYER_LIST[i].name);
		index++;
	}

	//shuffle cards
	PLAYER_ROLES_LIST = shuffle(PLAYER_ROLES_LIST);

	//shuffle players
	PLAYER_ID_NAME_LIST = shuffle(PLAYER_ID_NAME_LIST);

	//give players their index ..... go over triple array, give index to players
	for(var index = 0; index < NUM_PLAYERS; index++) {
		PLAYER_LIST[PLAYER_ID_NAME_LIST[index].id].index = (index + 1);
		PLAYER_LIST[PLAYER_ID_NAME_LIST[index].id].role_initial = PLAYER_ROLES_LIST[index];
		PLAYER_LIST[PLAYER_ID_NAME_LIST[index].id].role_current = PLAYER_ROLES_LIST[index];
		console.log('%s. %s, %s / %s',
			PLAYER_LIST[PLAYER_ID_NAME_LIST[index].id].index,
			PLAYER_LIST[PLAYER_ID_NAME_LIST[index].id].id,
			PLAYER_LIST[PLAYER_ID_NAME_LIST[index].id].name,
			PLAYER_ROLES_LIST[index]);
	}

	//push mid roles
	PLAYER_ID_NAME_LIST.push({index:index, name:mid_left});
	index++;
	PLAYER_ID_NAME_LIST.push({index:index, name:mid_center});
	index++;
	PLAYER_ID_NAME_LIST.push({index:index, name:mid_right});

	GAME_STARTED = true;
	console.log('Game Start');
}

function prompt_role(role) { //return the ids of the matching players

	var isMatch = false;
	var id_list = [];

	for(var p in PLAYER_LIST) { //for each player
		if(PLAYER_LIST[p].role_initial === role) {
			isMatch = true;
			id_list.push(PLAYER_LIST[p].id);
		}
	}
	for(var m = NUM_PLAYERS; m < NUM_PLAYERS + 3; m++) {
		if(PLAYER_ROLES_LIST[m] === role) {
			isMatch = true;
		}
	}
	return {id_list:id_list, timer:isMatch};
}

function get_instructions(role) {
	var data = '';
	if(role === ROLE_LIST[0]) { //please no

	}
	else if(role === ROLE_LIST[1]) {
		if(group_wolves)
			data = 'look to see your werewolf partner';
		else
			data = 'select 1 role to reveal from the center';
	}
	else if(role === ROLE_LIST[2]) {
		data = 'look to see the werewolves';
	}
	else if(role === ROLE_LIST[3]) {
		data = 'look to see your mason partner';
	}
	else if(role === ROLE_LIST[4]) {
		data = 'select to view 1 other player role, or 2 from the center';
	}
	else if(role === ROLE_LIST[5]) {
		data = 'select another player to steal their role';
	}
	else if(role === ROLE_LIST[6]) {
		data = 'select 2 other players to swap their roles'
	}
	else if(role === ROLE_LIST[7]) {
		data = 'select 1 center role to swap with your own';
	}
	else if(role === ROLE_LIST[8]) {
		data = 'look at your own role';
	}
	return data;
}

function do_group_action(id, role) { //just need the other player
	//check each playor and reveal the ones that are the given role
	var socket = SOCKET_LIST[id];
	var data = 'you learned: ';
	if(role == ROLE_LIST[1]) { //werewolf
		data += 'werewolves --> ';
	}
	else if(role == ROLE_LIST[3]) { //mason
		data += 'masons --> ';
	}
	for(var p in PLAYER_LIST) {
		if(PLAYER_LIST[p].role_initial === role)
			data += PLAYER_LIST[p].name + ' ';
	}
	return data;
}

function do_night_action(id, my_index, role) { //solo night actions only

	//USES "PLAYER_ROLES_LIST"

	var socket = SOCKET_LIST[id];
	var data = 'you learned: ';

	if(role === ROLE_LIST[0]) { //please no

	}
	else if(role === ROLE_LIST[1]) {
		if(CHOICE_BUFFER.length > 0) {
			var choice = CHOICE_BUFFER.pop();
			if(choice >= NUM_PLAYERS && choice < NUM_PLAYERS + 3)
				data += PLAYER_ID_NAME_LIST[choice].name + ' is ' + PLAYER_ROLES_LIST[choice];
			else {
				data += 'nothing';
			}
		}
		else {
			data += 'nothing';
		}
	}
	else if(role === ROLE_LIST[2]) {
		data += 'werewolves --> ';
		for(var p in PLAYER_LIST) {
			if(PLAYER_LIST[p].role_initial === 'werewolf')
				data += PLAYER_LIST[p].name + ' ';
		}
	}
	else if(role === ROLE_LIST[3]) {
		data += 'other mason in center';
	}
	else if(role === ROLE_LIST[4]) { //MOST COMPLEX
		if(CHOICE_BUFFER.length == 0)
			data += 'nothing';
		else if(CHOICE_BUFFER.length == 1) {
			var choice = CHOICE_BUFFER.pop();
			data += PLAYER_ID_NAME_LIST[choice].name + ' is ' + PLAYER_ROLES_LIST[choice];
		}
		else if(CHOICE_BUFFER.length >= 2) {
			var mid_2 = CHOICE_BUFFER.pop();
			var mid_1 = CHOICE_BUFFER.pop();
			if(mid_1 >= NUM_PLAYERS && mid_1 < NUM_PLAYERS + 3)
				data += PLAYER_ID_NAME_LIST[mid_1].name + ' is ' + PLAYER_ROLES_LIST[mid_1] + ', ';
			if(mid_2 >= NUM_PLAYERS && mid_2 < NUM_PLAYERS + 3)
				data += PLAYER_ID_NAME_LIST[mid_2].name + ' is ' + PLAYER_ROLES_LIST[mid_2];
		}
	}
	else if(role === ROLE_LIST[5]) {
		if(CHOICE_BUFFER.length > 0) {
			var choice = CHOICE_BUFFER.pop();
			if(choice >= 0 && choice < NUM_PLAYERS) {
				var temp = PLAYER_ROLES_LIST[my_index - 1];
				PLAYER_ROLES_LIST[my_index - 1] = PLAYER_ROLES_LIST[choice];
				PLAYER_ROLES_LIST[choice] = 'robber'; //temp; //should be robber...

				data += 'you robbed ' + PLAYER_ID_NAME_LIST[choice].name
					+ ', became '+ PLAYER_ROLES_LIST[my_index - 1];
			}
			else {
				data += 'nothing';
			}
		}
		else {
			data += 'nothing';
		}
	}
	else if(role === ROLE_LIST[6]) {
		//swap
		if(CHOICE_BUFFER.length >= 2) {
			var p_1 = CHOICE_BUFFER.pop();
			var p_2 = CHOICE_BUFFER.pop();
			if(p_1 >= 0 && p_1 < NUM_PLAYERS && p_2 >= 0 && p_2 < NUM_PLAYERS
				&& p_1 != PLAYER_LIST[id].index - 1 && p_2 != PLAYER_LIST[id].index - 1) {

				console.log('%s != %s and %s != %s', p_1, PLAYER_LIST[id].index - 1, p_2, PLAYER_LIST[id].index - 1);

				var temp = PLAYER_ROLES_LIST[p_1];
				PLAYER_ROLES_LIST[p_1] = PLAYER_ROLES_LIST[p_2];
				PLAYER_ROLES_LIST[p_2] = temp;

				data += 'you swapped ' + PLAYER_ID_NAME_LIST[p_2].name
					+ ' and ' + PLAYER_ID_NAME_LIST[p_1].name + '\'s roles' + id;
			}
			else {
				data += 'nothing';
			}
		}
		else {
			data += 'nothing';
		}
	}
	else if(role === ROLE_LIST[7]) {
		if(CHOICE_BUFFER.length > 0) {
			var choice = CHOICE_BUFFER.pop();
			if(choice >= NUM_PLAYERS && choice < NUM_PLAYERS + 3) {
				var temp = PLAYER_ROLES_LIST[my_index - 1];
				PLAYER_ROLES_LIST[my_index - 1] = PLAYER_ROLES_LIST[choice];
				PLAYER_ROLES_LIST[choice] = temp; //should be robber...

				data += 'you swapped with ' + PLAYER_ID_NAME_LIST[choice].name;
			}
			else {
				data += 'nothing';
			}
		}
		else {
			data += 'nothing';
		}
	}
	else if(role === ROLE_LIST[8]) {
		data = 'you are now the: ' + PLAYER_ROLES_LIST[my_index - 1];
	}
	console.log(PLAYER_ID_NAME_LIST[my_index - 1].name + ' / ' + PLAYER_LIST[id].role_initial + ' ... ' + data);
	CHOICE_BUFFER = [];
	return data;
}
