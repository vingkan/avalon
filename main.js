let config = {
	apiKey: "AIzaSyCilKAuu-_n20WUwgE8cYpWQBFgtJi113o",
	authDomain: "feud-9002e.firebaseapp.com",
	databaseURL: "https://feud-9002e.firebaseio.com",
	projectId: "feud-9002e",
	storageBucket: "",
	messagingSenderId: "832727110519"
};
let FirebaseApp = firebase.initializeApp(config);
let db = FirebaseApp.database().ref('avalon');

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

params.code = 'sample';

function startGameWithCode(code) {
	console.log(code);
}

if (params.code) {
	startGameWithCode(params.code);
} else {
	vex.dialog.prompt({
		message: 'Enter a round code.',
		callback: (code) => {
			if (code) {
				startGameWithCode(code);
			}
		}
	});
}
