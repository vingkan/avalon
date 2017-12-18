let config = {
	apiKey: "AIzaSyCilKAuu-_n20WUwgE8cYpWQBFgtJi113o",
	authDomain: "feud-9002e.firebaseapp.com",
	databaseURL: "https://feud-9002e.firebaseio.com",
	projectId: "feud-9002e",
	storageBucket: "",
	messagingSenderId: "832727110519"
};
let FirebaseApp = firebase.initializeApp(config);
let db = FirebaseApp.database();

let params = getQueryParams(document.location.search);

function getQueryParams(qs) {
	qs = qs.split('+').join(' ');
	var params = {},
		tokens,
		re = /[?&]?([^=]+)=([^&]*)/g;
	while (tokens = re.exec(qs)) {
		params[decodeURIComponent(tokens[1])] = decodeURIComponent(tokens[2]);
	}
	return params;
}

function reportError(err) {
	vex.dialog.alert(`Error: ` + err);
}

function getGameID() {
	let pid = localStorage.getItem('avalon_game_id') || false;
	return pid;
}

function setGameID(gid) {
	localStorage.setItem('avalon_game_id', gid);
}

function getPlayerID() {
	let pid = localStorage.getItem('avalon_player_id') || false;
	return pid;
}

function setPlayerID(pid) {
	localStorage.setItem('avalon_player_id', pid);
}

function getPlayerName() {
	let name = localStorage.getItem('avalon_player_name') || false;
	return name;
}

function setPlayerName(name) {
	localStorage.setItem('avalon_player_name', name);
}

function joinGame(gid, admin, override) {
	return new Promise((resolve, reject) => {
		if (!getPlayerID() || override) {
			let p = db.ref(`avalon/games/${gid}/players`).push({
				name: getPlayerName() || 'Unknown Player',
				admin: admin || false
			});
			p.then((done) => {
				let pid = done.key;
				setPlayerID(pid);
				resolve(true);
			}).catch(reject);
		} else {
			resolve(false);
		}
	});
}

const ROLE_DATA = {
	knight: {
		id: 'knight',
		name: 'Knight of Arthur',
		good: true
	},
	merlin: {
		id: 'merlin',
		name: 'Merlin',
		good: true
	},
	minion: {
		id: 'minion',
		name: 'Minion of Mordred',
		good: false
	},
	assassin: {
		id: 'assassin',
		name: 'Assassin',
		good: false
	},
	percival: {
		id: 'percival',
		name: 'Percival',
		good: true
	},
	morgana: {
		id: 'morgana',
		name: 'Morgana',
		good: false
	}
};

function createGame() {
	return new Promise((resolve, reject) => {
		let p = db.ref(`avalon/games`).push({
			started: Date.now(),
			roles: {
				'a0': 'knight',
				'a1': 'knight',
				'a2': 'merlin',
				'a3': 'minion',
				'a4': 'assassin'
			}
		});
		p.then((done) => {
			let gid = done.key;
			setGameID(gid);
			joinGame(gid, true, true).then(resolve).catch(reject);
		}).catch(reject);
	});
}

function simulatePlayersJoining() {
	return new Promise((resolve, reject) => {
		let gid = getGameID();
		db.ref(`avalon/games/${gid}`).once('value', (snap) => {
			let data = snap.val() || {};
			let needed = Object.keys(data.roles).length - Object.keys(data.players).length;
			let promises = [];
			for (let i = 0; i < needed; i++) {
				let p = db.ref(`avalon/games/${gid}/players`).push({
					name: 'Grunt',
					admin: false
				});
				promises.push(p);
			}
			Promise.all(promises).then(resolve).catch(reject);
		});
	});
}

function assignRoles() {
	let gid = getGameID();
	return new Promise((resolve, reject) => {
		db.ref(`avalon/games/${gid}`).once('value', (snap) => {
			let data = snap.val();
			let roles = Object.keys(data.roles).map((r) => {
				return data.roles[r];
			});
			if (!data.players) {
				reject('No players!');
			}
			if (roles.length !== Object.keys(data.players).length) {
				reject('Wrong number of players for the selected roles!');
			}
			let orders = roles.map((r, idx) => idx);
			for (let pid in data.players) {
				let ridx = Math.floor(Math.random() * roles.length);
				let role = roles.splice(ridx, 1)[0];
				let oidx = Math.floor(Math.random() * orders.length);
				let order = orders.splice(oidx, 1)[0];
				data.players[pid].role = role;
				data.players[pid].order = order;
				if (order === 0) {
					data.players[pid].isLeader = true;
				}
			}
			let p = db.ref(`avalon/games/${gid}/players`).set(data.players);
			p.then(resolve).catch(reject);
		});
	});
}

function startNextTurn() {
	return new Promise((resolve, reject) => {
		let gid = getGameID();
		db.ref(`avalon/games/${gid}`).once('value', (snap) => {
			let data = snap.val() || {};
			let order = 0;
			let n = Object.keys(data.players).length;
			for (let pid in data.players) {
				let player = data.players[pid];
				if (player.isLeader) {
					order = (player.order + 1) % n;
					player.isLeader = false;
				}
			}
			for (let pid in data.players) {
				let player = data.players[pid];
				if (player.order === order) {
					player.isLeader = true;
				}
			}
			let p = db.ref(`avalon/games/${gid}/players`).set(data.players);
			p.then(resolve).catch(reject);
		});
	});
}

function startQuest(map) {
	return new Promise((resolve, reject) => {
		getGameData().then((data) => {
			for (let pid in data.players) {
				if (map) {
					if (pid in map) {
						data.players[pid].quest = 'awaiting';
					} else {
						data.players[pid].quest = 'excluded';
					}
				} else {
					data.players[pid].quest = 'none';
				}
			}
			let p = db.ref(`avalon/games/${gid}/players`).set(data.players);
			p.then(resolve).catch(reject);
		});
	});
}

function castVote(status) {
	let gid = getGameID();
	let pid = getPlayerID();
	db.ref(`avalon/games/${gid}/players/${pid}/vote`).set(status);
}

function startGame() {
	let gid = getGameID();
	assignRoles(gid).then((done) => {
		GAME_DATA = getGameData();

	}).catch(reportError);
}

function getGameData() {
	return new Promise((resolve, reject) => {
		let gid = getGameID();
		db.ref(`avalon/games/${gid}`).once('value', (snap) => {
			let data = snap.val() || {};
			resolve(data);
		});
	});
}

let questView = document.getElementById('quest-view');

function chooseQuestOutcome() {
	return new Promise((resolve, reject) => {
		let gid = getGameID();
		let pid = getPlayerID();
		let html = `
			<div class="box">
				<h2>Choose Your Quest Card</h2>
				<button data-outcome="success" class="button is-success">Success</button>
				<button data-outcome="failure" class="button is-danger">Failure</button>
			</div>
		`;
		questView.innerHTML = html;
		Array.from(questView.querySelectorAll('button')).forEach((btn) => {
			btn.addEventListener('click', (e) => {
				let choice = btn.dataset.outcome;
				console.log(choice);
				questView.innerHTML = '';
				let p = db.ref(`avalon/games/${gid}/players/${pid}/quest`).set(choice);
				p.then((done) => {
					resolve(choice);
				}).catch(reject);
			});
		})
	});
}

function updatePlayerName() {
	vex.dialog.prompt({
		message: 'Enter your name:',
		value: getPlayerName() || '',
		callback: (name) => {
			if (name) {
				let gid = getGameID();
				let pid = getPlayerID();
				setPlayerName(name);
				db.ref(`avalon/games/${gid}/players/${pid}/name`).set(name);
			}
		}
	});
}

let QUEST_DATA = {};
let QUESTER_MAP = {};

function renderPlayers(players) {
	let html = ``;
	let list = Object.keys(players).map((pid) => {
		let pdata = players[pid];
		pdata.pid = pid;
		return pdata;
	}).sort((a, b) => {
		return a.order - b.order;
	});
	let counts = {
		awaiting: 0,
		success: 0,
		failure: 0
	}
	let questerMap = {};
	list.forEach((val) => {
		if (val.quest === 'awaiting') {
			counts.awaiting++;
		} else if (val.quest === 'success') {
			counts.success++;
		} else if (val.quest === 'failure') {
			counts.failure++;
		}
		if (val.proposed) {
			questerMap[val.pid] = true;
		}
	});
	QUEST_DATA = counts;	
	QUESTER_MAP = questerMap;
	html += `<div class="columns is-multiline">`;
	html += `<div class="column is-4">
				<div class="box">
					<h2 class="title">Quest Status</h2>
					<p>${Object.keys(QUESTER_MAP).length} players on this quest.<br>Waiting for ${counts.awaiting} quest cards.</p>`;
	if (counts.awaiting === 0) {
		html += `<button id="quest-results" class="button is-primary">Show Last Quest Results</button><br><br>`;
	}
	html += `</div>
			</div>`;
	let selfRole = ROLE_DATA[players[getPlayerID()].role];
	list.forEach((player) => {
		let vote = 'No Vote';
		let voteClass = '';
		if (player.vote === 'approve') {
			vote = 'Approve';
			voteClass = 'is-success';
		} else if (player.vote === 'reject') {
			vote = 'Reject';
			voteClass = 'is-danger';
		}
		let role = ROLE_DATA[player.role];
		let roleName = '???';
		let seeSelf = player.pid === getPlayerID();
		let merlinSeesEvil = selfRole.id === 'merlin' && !role.good;
		let evilSeesEvil = !selfRole.good && !role.good;
		let showRole = seeSelf || merlinSeesEvil || evilSeesEvil;
		if (showRole) {
			roleName = role.name;
		}
		if (selfRole.id === 'percival' && (role.id === 'merlin' || role.id === 'morgana')) {
			roleName = 'Merlin or Morgana';
		}
		let iconTag = player.proposed ? 'shield' : 'ban';
		let questClass = player.proposed ? 'is-warning' : '';
		let iconHTML = `
			<button class="button ${questClass}" data-joinquest="${player.pid}" data-proposed="${player.proposed || false}">
				<span class="icon">
					<i class="fa fa-${iconTag}"></i>
				</span>
				<span>${player.proposed ? 'Is' : 'Is not'} on quest.</span>
			</button>
		`;
		html += `
			<div class="column is-4">
				<div class="box">
					<h2 class="title">#${player.order + 1} ${player.name}</h2>
					<h3>${roleName}</h3>
					<p>${iconHTML} </p>
					<button class="button ${voteClass}">${vote}</button>
				</div>
			</div>
		`;
	});
	html += `</div>`;
	return html;
}

let playerView = document.getElementById('player-view');
let gid = getGameID();
if (gid) {

	if (!getPlayerName()) {
		updatePlayerName()
	}

	document.getElementById('code').innerText = gid;
	document.getElementById('code').addEventListener('click', (e) => {
		vex.dialog.prompt({
			message: 'Share game code with other players:',
			value: gid,
			callback: () => {}
		});
	});

	joinGame(gid, false).then((done) => {
		console.log('Joined game, waiting to start.');
		db.ref(`avalon/games/${gid}/players`).on('value', (snap) => {
			let players = snap.val() || {};
			let html = renderPlayers(players);
			playerView.innerHTML = html;
			let qbtn = playerView.querySelector('#quest-results');
			if (qbtn) {
				qbtn.addEventListener('click', (e) => {
					vex.dialog.alert(`Success: ${QUEST_DATA.success}, Failure: ${QUEST_DATA.failure}`);
				});
			}
			let pqbtns = Array.from(document.querySelectorAll('[data-joinquest]'))
			pqbtns.forEach((btn) => {
				btn.addEventListener('click', (e) => {
					let pid = btn.dataset.joinquest;
					let proposal = !(btn.dataset.proposed === 'true');
					db.ref(`avalon/games/${gid}/players/${pid}/proposed`).set(proposal);
				});
			});
			let you = players[getPlayerID()];
			if (you.quest === 'awaiting') {
				chooseQuestOutcome().then((done) => {
					console.log('Chosen');
				}).catch(reportError);
			}
		});
	}).catch(reportError);

	let sbtn = document.getElementById('shuffle');
	sbtn.addEventListener('click', (e) => {
		assignRoles();
	});

	let qbtn = document.getElementById('quest');
	qbtn.addEventListener('click', (e) => {
		startQuest(QUESTER_MAP);
	});

	let vbtns = Array.from(document.querySelectorAll('[data-vote]'))
	vbtns.forEach((btn) => {
		btn.addEventListener('click', (e) => {
			let vote = btn.dataset.vote;
			castVote(vote);
		});
	});

} else {
	
	let cv = document.getElementById('create-view');
	cv.style.display = 'block';
	let gv = document.getElementById('game-view');
	gv.style.display = 'none';

	let sgbtn = document.getElementById('start-game');
	sgbtn.addEventListener('click', (e) => {
		createGame().then((done) => {
			assignRoles().then((finished) => {
				window.location.reload();
			}).catch((err) => {
				window.location.reload();
				console.error(err);
			});
		}).catch(reportError);
	});

	let jgbtn = document.getElementById('join-game');
	jgbtn.addEventListener('click', (e) => {
		vex.dialog.prompt({
			message: 'Enter game code:',
			callback: (code) => {
				if (code) {
					localStorage.clear();
					setGameID(code);
					joinGame(code, false, true).then((done) => {
						assignRoles().then((finished) => {
							window.location.reload();
						}).catch((err) => {
							window.location.reload();
							console.error(err);
						});
					});
				}
			}
		});
	});

}

let nbtn = document.getElementById('name');
nbtn.addEventListener('click', (e) => {
	updatePlayerName();
});

let cbtn = document.getElementById('clear');
cbtn.addEventListener('click', (e) => {
	localStorage.clear();
	window.location.reload();
});