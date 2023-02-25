// ==UserScript==
// @name         GeoGuessr County Streak
// @description  Adds a county streak counter that automatically updates while you play (may not work for all countries, depending on how they define their counties)
// @version      1.0
// @author       miraclewhips
// @match        *://*.geoguessr.com/*
// @icon         https://www.google.com/s2/favicons?domain=geoguessr.com
// @grant        none
// @copyright    2022, miraclewhips (https://github.com/miraclewhips)
// @license      MIT
// @downloadURL    https://github.com/miraclewhips/geoguessr-userscripts/raw/master/geoguessr-county-streak.user.js
// @updateURL    https://github.com/miraclewhips/geoguessr-userscripts/raw/master/geoguessr-county-streak.user.js
// ==/UserScript==

const ENABLED_ON_CHALLENGES = true; //Replace with true or false
const AUTOMATIC = true; //Replace with false for a manual counter

// Put an ISO 639-1 language code (e.g. "en") in between the quotes to return the country name in a specific language.
// https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
const LANGUAGE = "en";





/* ############################################################################### */
/* ##### DON'T MODIFY ANYTHING BELOW HERE UNLESS YOU KNOW WHAT YOU ARE DOING ##### */
/* ############################################################################### */

let DATA = {};

const load = () => {
	DATA = {
		round: 0,
		round_started: false,
		game_finished: false,
		checking_api: false,
		streak: 0,
		previous_streak: 0,
		streak_backup: 0,
		last_guess: [0, 0]
	}

	let data = JSON.parse(window.localStorage.getItem('geoCountyStreak'));

	if(data) {
		data.round = 0;
		data.round_started = false;
		data.game_finished = false;
		data.checking_api = false;

		Object.assign(DATA, data);
		save();
	}
}

const save = () => {
	window.localStorage.setItem('geoCountyStreak', JSON.stringify(DATA));
}

const getCurrentRound = () => {
	const roundNode = document.querySelector('div[class^="status_inner__"]>div[data-qa="round-number"]');
	return parseInt(roundNode.children[1].textContent.split(/\//gi)[0].trim(), 10);
}

const checkGameMode = () => {
	return (location.pathname.startsWith("/game/") || (ENABLED_ON_CHALLENGES && location.pathname.startsWith("/challenge/")));
}

const updateRoundPanel = () => {
	let panel = document.getElementById('county-streak-counter-panel');

	if(!panel) {
		let gameScore = document.querySelector('.game-layout__status div[class^="status_section"][data-qa="score"]');

		if(gameScore) {
			let panel = document.createElement('div');
			panel.id = 'county-streak-counter-panel';
			panel.style.display = 'flex';

			let classLabel = gameScore.querySelector('div[class^="status_label"]').className;
			let valueLabel = gameScore.querySelector('div[class^="status_value"]').className;

			panel.innerHTML = `
				<div class="${gameScore.getAttribute('class')}">
					<div class="${classLabel}">COUNTY STREAK</div>
					<div id="county-streak-counter-value" class="${valueLabel}"></div>
				</div>
			`;

			gameScore.parentNode.append(panel);
		}
	}
	
	let streak = document.getElementById('county-streak-counter-value');

	if(streak) {
		streak.innerText = DATA.streak;
	}
}

const createStreakText = () => {
	if(DATA.checking_api) {
		return `Loading...`;
	}

	if(DATA.streak > 0) {
		return `It was <span style="color:#6cb928">${DATA.state_location}!</span> County Streak: <span style="color:#fecd19">${DATA.streak}</span>`;
	}else{
		let suffix = `counties in a row.`;

		switch(DATA.previous_streak) {
			case 1:
				suffix = `county.`;
		}

		let previousGuessText = `You didn't make a guess.`;

		if(DATA.state_guess) {
			previousGuessText = `You guessed <span style="color:#f95252">${DATA.state_guess}</span>, unfortunately it was <span style="color:#6cb928">${DATA.state_location}</span>.`;
		}

		return `${previousGuessText} Your streak ended after correctly guessing <span style="color:#fecd19">${DATA.previous_streak}</span> ${suffix}`;
	}
}

const createStreakElement = () => {
	let score = document.createElement('div');
	score.style.fontSize = '18px';
	score.style.fontWeight = '500';
	score.style.color = '#fff';
	score.style.padding = '10px';
	score.style.paddingBottom = '0';
	score.style.position = 'absolute';
	score.style.bottom = '100%';
	score.style.width = '100%';
	score.style.background = 'var(--ds-color-purple-100)';
	return score;
}

const updateSummaryPanel = () => {
	const scoreLayout = document.querySelector('div[class^="result-layout_root"] div[class^="round-result_newWrapper__"]');

	if(scoreLayout) {
		if(!document.getElementById('county-streak-score-panel-summary')) {
			let score = createStreakElement();
			score.id = 'county-streak-score-panel-summary';
			scoreLayout.parentNode.insertBefore(score, scoreLayout);
		}

		document.getElementById('county-streak-score-panel-summary').innerHTML = createStreakText();
	}
}

const getGameId = () => {
	return window.location.href.substring(window.location.href.lastIndexOf('/') + 1);
}

const startRound = () => {
	if(!checkGameMode()) return;

	DATA.round = getCurrentRound();
	DATA.round_started = true;
	DATA.game_finished = false;
	DATA.gameId = getGameId();

	updateRoundPanel();
}

const queryGeoguessrGameData = async (id) => {
	let apiUrl = `https://www.geoguessr.com/api/v3/games/${id}`;

	if(location.pathname.startsWith("/challenge/")) {
		apiUrl = `https://www.geoguessr.com/api/v3/challenges/${id}/game`;
	}

	return await fetch(apiUrl).then(res => res.json());
}

const queryAPI = async (location) => {
	if (location[0] <= -85.05) {
			return 'AQ';
	}

	let apiUrl = `https://nominatim.openstreetmap.org/reverse.php?lat=${location[0]}&lon=${location[1]}&zoom=21&format=jsonv2&accept-language=${LANGUAGE}`;

	return await fetch(apiUrl).then(res => res.json());
};

const stopRound = async () => {
	DATA.round_started = false;

	if(!checkGameMode()) return;

	if(!AUTOMATIC) {
		updateStreakPanels();
		return;
	}

	DATA.checking_api = true;
	updateStreakPanels();

	let responseGeoGuessr = await queryGeoguessrGameData(DATA.gameId);

	let guess_counter = responseGeoGuessr.player.guesses.length;
	let guess = [responseGeoGuessr.player.guesses[guess_counter-1].lat,responseGeoGuessr.player.guesses[guess_counter-1].lng];

	if (guess[0] == DATA.last_guess[0] && guess[1] == DATA.last_guess[1]) {
		DATA.checking_api = false;
		updateStreakPanels();
		return;
	}

	if(responseGeoGuessr.player.guesses[guess_counter-1].timedOut && !responseGeoGuessr.player.guesses[guess_counter-1].timedOutWithGuess) {
		DATA.checking_api = false;
		DATA.state_guess = null;
		DATA.state_location = null;
		updateStreak(0);
		return;
	}

	DATA.last_guess = guess;
	let location = [responseGeoGuessr.rounds[guess_counter-1].lat,responseGeoGuessr.rounds[guess_counter-1].lng];

	let responseGuess = await queryAPI(guess);
	let responseLocation = await queryAPI(location);

	DATA.checking_api = false;

	let guessCC = responseGuess?.address?.country_code?.toUpperCase() || null;
	let locationCC = responseLocation?.address?.country_code?.toUpperCase() || null;
	
	DATA.state_guess = responseGuess?.address?.county || 'Undefined';
	DATA.state_location = responseLocation?.address?.county || 'Undefined';

	if (guessCC && locationCC && guessCC === locationCC && DATA.state_guess === DATA.state_location) {
		updateStreak(DATA.streak + 1);
	} else {
		updateStreak(0);
	}
}

const checkStreakIsLatest = () => {
	let data = JSON.parse(window.localStorage.getItem('geoCountyStreak'));

	if(data) {
		DATA.streak = data.streak;
	}
}

const updateStreak = (streak) => {
	checkStreakIsLatest();

	DATA.previous_streak = DATA.streak;
	DATA.streak = streak;

	if(DATA.streak !== 0) {
		DATA.streak_backup = DATA.streak;
	}

	save();
	updateStreakPanels();
}

const updateStreakPanels = () => {
	updateRoundPanel();
	updateSummaryPanel();
}

document.addEventListener('keypress', (e) => {
	switch(e.key) {
		case '1':
			updateStreak(DATA.streak + 1);
			break;
		case '2':
			updateStreak(DATA.streak - 1);
			break;
		case '8':
			updateStreak(DATA.streak_backup + 1);
			break;
		case '0':
			DATA.streak_backup = 0;
			updateStreak(0);
			break;
	};
});

const checkState = () => {
	const gameLayout = document.querySelector('.game-layout');
	const resultLayout = document.querySelector('div[class^="result-layout_root"]');
	const finalScoreLayout = document.querySelector('div[class^="result-layout_root"] div[class^="standard-final-result_score__"]');

	if(gameLayout) {
		if (DATA.round !== getCurrentRound() || DATA.gameId !== getGameId()) {
			if(DATA.round_started) {
				stopRound();
			}

			startRound();
		}else if(resultLayout && DATA.round_started) {
			stopRound();
		}else if(finalScoreLayout && !DATA.game_finished) {
			DATA.game_finished = true;
			updateStreakPanels();
		}
	}
}

const init = () => {
	load();

	const observer = new MutationObserver(() => {
		checkState();
	});

	observer.observe(document.querySelector('#__next'), { subtree: true, childList: true });

	window.addEventListener('mouseup', checkState);
}

window.onload = updateStreakPanels;
init();