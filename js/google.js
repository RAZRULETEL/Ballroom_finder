const TOKEN_LOCAL_STORAGE_NAME = 'auth';

const CLIENT_ID = '709926654914-n7qfst711po76bd5brd8eim6bd9au6ro.apps.googleusercontent.com';
const API_KEY = 'AIzaSyAq8E5zylP9ITWgSuvdfm-dfljdDErYhQU';

const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

let tokenClient;
let gapiInited = false;
let gisInited = false;
let mainInited = false;

const authButton = document.getElementById("auth");
const resultMessage = document.getElementById("result");
const tableIdInput = document.getElementById("table_id");
const runButton = document.getElementById("run");

authButton.disabled = true;
// runButton.disabled = true;

let resolveInit;
const initPromise = new Promise((resolve) => {
	resolveInit = resolve;
})

/**
 * Callback after api.js is loaded.
 */
function gapiLoaded() {
	gapi.load('client', initializeGapiClient);
}

/**
 * Callback after the API client is loaded. Loads the
 * discovery doc to initialize the API.
 */
async function initializeGapiClient() {
	await gapi.client.init({
		apiKey: API_KEY,
		discoveryDocs: [DISCOVERY_DOC],
	});
	gapiInited = true;
	maybeEnableButtons();
}

/**
 * Callback after Google Identity Services are loaded.
 */
function gisLoaded() {
	tokenClient = google.accounts.oauth2.initTokenClient({
		client_id: CLIENT_ID,
		scope: SCOPES,
		callback: '', // defined later,
	});
	gisInited = true;
	maybeEnableButtons();
}

/**
 * Callback after main script are loaded.
 */
function mainLoaded(){
	mainInited = true;
	maybeEnableButtons();
}

/**
 * Enables user interaction after all libraries are loaded.
 */
function maybeEnableButtons() {
	if (gapiInited && gisInited && mainInited) {
		resolveInit();
		if(localStorage.getItem(TOKEN_LOCAL_STORAGE_NAME)){
			gapi.client.setToken(JSON.parse(localStorage.getItem(TOKEN_LOCAL_STORAGE_NAME)));
			setAuthorized();
		}else
			setUnauthorized();
	}
}

/**
 * Sign in the user upon button click.
 */
function handleAuthClick() {
	tokenClient.callback = async (resp) => {
		if (resp.error !== undefined) {
			setUnauthorized();
			throw (resp);
		}
		resp.expires_in = resp.expires_in * 1000 + Date.now();
		localStorage.setItem(TOKEN_LOCAL_STORAGE_NAME, JSON.stringify(resp));
		setAuthorized();
	};

	if (gapi.client.getToken() === null) {
		// Prompt the user to select a Google Account and ask for consent to share their data
		// when establishing a new session.
		tokenClient.requestAccessToken({prompt: 'consent'});
	} else {
		// Skip display of account chooser and consent dialog for an existing session.
		tokenClient.requestAccessToken({prompt: ''});
	}
}

/**
 * Sign out the user upon button click.
 */
function handleSignoutClick() {
	const token = gapi.client.getToken();
	if (token !== null) {
		google.accounts.oauth2.revoke(token.access_token);
		gapi.client.setToken('');
		localStorage.removeItem('auth');
		setUnauthorized();
	}
}


const ROW_STEP_SIZE = 100;
/**
 * Print the names and majors of students in a sample spreadsheet:
 * https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 */
async function listNames(callback = async () => {}, sheet = 'Лист1', column = 'A') {
		let counter = 0;
		let startRow = 1;
		while(true) {
			let response;
			try {
				response = await gapi.client.sheets.spreadsheets.values.get({
					spreadsheetId: tableIdInput.value,
					range: sheet + `!${column}${startRow}:${column}${startRow + ROW_STEP_SIZE - 1}`,
				});
			} catch (err) {
				console.error(err);
				switch (err.status) {
					case 401:
						resultMessage.innerText = 'Пожалуйста авторизуйтесь.';
						break;
					case 404:
						resultMessage.innerText = 'Таблица не найдена, проверьте ссылку.';
						break;
					case 400:
						break;
					default:
						resultMessage.innerText = 'Произошла ошибка при обращении к таблице. Свяжитесь с разработчиком.\nCode: ' + err.status;
						break;
				}
				return counter;
			}
			addOrUpdateId(tableIdInput.value);
			console.log(response);
			const range = response.result;
			if (!range || !range.values || range.values.length == 0) {
				if(counter == 0)
					resultMessage.innerText = 'Записей не найдено в диапазоне ' + `${column}${startRow}:${column}${startRow + ROW_STEP_SIZE - 1}.`;
				else
					resultMessage.innerText = `Найдено ${counter} записей.\nПоиск окончен.`;
				return counter;
			}
			const output = range.values.map(e => e[0]).filter(e => e);
			counter += output.length;
			resultMessage.innerText = `Найдено ${counter} записей.`;
			await callback(output);
			startRow += ROW_STEP_SIZE;
		}
}

async function createList(name = 'Бальники', id, autoRename = false, retry = 0) {
	try {
		const sheet = await gapi.client.sheets.spreadsheets.batchUpdate({
			spreadsheetId: tableIdInput.value,
			requests: [
				{
					"addSheet": {
						"properties": {
							"title": retry === 0 ? name : `${name} (${retry})`,
							"index": 1
						}
					}
				}
			]
		});
		console.info("Создана таблица:", sheet.result.replies[0].addSheet.properties);
		return sheet.result.replies[0].addSheet.properties.title;
	}catch (e) {
		if(e.status === 400 && autoRename)
			return await createList(name, id, autoRename, retry + 1);

		console.error(e);
		switch (e.status) {
			case 401:
				resultMessage.innerText = 'Пожалуйста авторизуйтесь.';
				break;
			case 404:
				resultMessage.innerText = 'Таблица не найдена, проверьте ссылку.';
				break;
			default:
				resultMessage.innerText = 'Произошла ошибка при созддании листа в таблице. Свяжитесь с разработчиком.\nCode: ' + e.status;
				break;
		}
		return null;
	}
}
function addOrUpdateId(id){
	if(!id)
		return;
	const ids = JSON.parse(localStorage.getItem('ids')) || {};
	ids[id] = Date.now();
	localStorage.setItem('ids', JSON.stringify(ids));
}

async function writeValues(list, id, data){
	try {
		const sheet = await gapi.client.sheets.spreadsheets.values.update({
			spreadsheetId: tableIdInput.value,
			range: `${list}!A1:G`,
			valueInputOption: 'RAW',
			majorDimension: 'ROWS',
			values: data
		});
		console.log(sheet)
	}catch (e) {
		console.error(e);
		switch (e.status) {
			case 401:
				resultMessage.innerText = 'Пожалуйста авторизуйтесь.';
				break;
			case 404:
				resultMessage.innerText = 'Таблица не найдена, проверьте ссылку.';
				break;
			default:
				resultMessage.innerText = 'Произошла ошибка при созддании листа в таблице. Свяжитесь с разработчиком.\nCode: ' + err.status;
				break;
		}
		return null;
	}
}

async function getSheetInfo(id){
	await initPromise;
	try {
		const sheet = await gapi.client.sheets.spreadsheets.get({
			spreadsheetId: id
		});
		return {
			title: sheet.result.properties.title,
			lists: sheet.result.sheets.map(e => e.properties.title),
			id,
		};
	}catch (e) {
		switch (e.status) {
			case 401:
				return 'Пожалуйста авторизуйтесь.';
			case 404:
				return 'Таблица не найдена, проверьте ссылку.';
		}
		return null;
	}
}
