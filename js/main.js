const DEFAULT_RESULT_SHEET = 'Бальники';

const tableLink = document.getElementById("table_link");
const listSelect = document.getElementById("sheet_select");
const listsRefresh = document.getElementById("refresh");
const renameCheckbox = document.getElementById("auto_rename");
const appendCheckbox = document.getElementById("append");
const ageFilterSelect = document.getElementById("age_filter");

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
	minute: '2-digit',
	second: '2-digit',
});

const FILTERS = {
	'none': _ => true,
	'bachelor': e => e[AGE_COLUMN] > 16 && e[AGE_COLUMN] < 26,
	'master': e => e[AGE_COLUMN] > 20 && e[AGE_COLUMN] < 30,
	'phd': e => e[AGE_COLUMN] > 22 && e[AGE_COLUMN] < 32,
}

let TABLE_ID = "";
let authInterval;

tableIdInput.addEventListener("input", async (e) => {
	const match = e.currentTarget.value.match(/(?<=docs\.google\.com\/spreadsheets\/d\/)[^/]+(?=\/)/) || e.currentTarget.value.match(/^[^/]{44}$/i);
	listSelect.disabled = true;
	if (match) {
		tableIdInput.disabled = true;
		const info = await getSheetInfo(match[0]);
		tableIdInput.disabled = false;
		if (info && typeof info === "object") {
			tableIdInput.style.color = "green";

			tableLink.href = `https://docs.google.com/spreadsheets/d/${match[0]}/`;
			tableLink.innerHTML = info.title;
			tableLink.style.color = "green";
			tableLink.style.pointerEvents = "all";

			addOrUpdateId(match[0], info);
			TABLE_ID = match[0];

			listSelect.replaceChildren(...info.lists.map(sheet => new Option(sheet, sheet)));
			listSelect.disabled = false;
		} else {
			tableIdInput.style.color = "red";

			tableLink.innerHTML = info || "Неизвестная ошибка.";
			tableLink.href = "";
			tableLink.style.color = "red";
			tableLink.style.pointerEvents = "none";
		}
	}else {
		tableIdInput.style.color = "black";
		tableLink.href = "#";
		tableLink.style.color = "red";
		tableLink.style.pointerEvents = "none";
		tableLink.innerHTML = "";
	}
});

if (localStorage.getItem('ids')) {
	const ids = JSON.parse(localStorage.getItem('ids'));
	let max = {last_access: 0, title: ""};
	for (const info of Object.values(ids)) {
		if(info.last_access > max.last_access) max = info;
	}
	tableIdInput.value = max.id || "";
}

listsRefresh.addEventListener("click", async (e) => {
	if (!TABLE_ID) return;
	listsRefresh.disabled = true;
	listSelect.disabled = true;
	const infoOption = new Option("Обновление...");
	listSelect.replaceChildren(infoOption);
	const info = await getSheetInfo(TABLE_ID);
	if (info && typeof info === "object") {
		tableLink.innerHTML = info.title;
		listSelect.replaceChildren(...info.lists.map(sheet => new Option(sheet, sheet)));
		listSelect.disabled = false;
	}else{
		infoOption.innerText = info || "Неизвестная ошибка.";
	}
	listsRefresh.disabled = false;
});

authButton.addEventListener("click", handleAuthClick);
runButton.addEventListener("click", handleRunClick);

function setAuthorized() {
	const time = JSON.parse(localStorage.getItem(TOKEN_LOCAL_STORAGE_NAME)).expires_in - Date.now();
	authButton.innerText = `Авторизованы ещё ${dateFormatter.format(time)}`

	clearInterval(authInterval);
	if (time < 0) {
		setUnauthorized();
		return;
	}

	tableIdInput.dispatchEvent(new Event('input', { bubbles: true }));
	runButton.disabled = false;

	authButton.disabled = true;
	authButton.style.background = "lightgreen";
	runButton.disabled = false;
	authInterval = setInterval(() => {
		const time = JSON.parse(localStorage.getItem(TOKEN_LOCAL_STORAGE_NAME)).expires_in - Date.now();
		if (time < 0)
			setUnauthorized()
		else
			authButton.innerText = `Авторизованы ещё ${dateFormatter.format(time)}`
	}, 1000)
}

function setUnauthorized() {
	clearInterval(authInterval);
	authButton.innerText = "Авторизоваться";
	authButton.disabled = false;
	authButton.style.background = "";
	runButton.disabled = true;
	tableIdInput.disabled = true;
}

async function handleRunClick(e){
	if(!TABLE_ID) return;

	runButton.disabled = true;
	runButton.innerText = "Обработка...";

	const TABLE_LIST = listSelect.value;
	const APPEND_VALUES = appendCheckbox.checked;

	if(!TABLE_LIST){
		resultMessage.innerText = "Не выбран лист таблицы.";
		runButton.disabled = false;
		runButton.innerText = "Запустить";
		return;
	}

	const listName = await createList(DEFAULT_RESULT_SHEET, TABLE_ID, renameCheckbox.checked);
	if(!listName && !APPEND_VALUES){
		runButton.disabled = false;
		runButton.innerText = "Запустить";
		return;
	}else
		if(listName) resultMessage.innerText = `Создан лист '"${listName}"'.`;

	let people = [];

	await new Promise(async (resolve) => {
		const progressMessage = document.getElementById('process_state');
		const progressBar = document.getElementById('process_bar');

		let listingEnded = false;
		let count = 0,  processed = 0, processing = 0;
		const requestQueue = [];
		const requestScheduler = setInterval(async function () {
			const name = requestQueue.shift();
			processing++;
			if (name){
				try {
					const result = await parseNameTadance(name);
					if(result)
						people.push(...result.filter(e => e[NAME_COLUMN].includes(name)));
					progressMessage.innerText = `Обработано ${processed++} имён из ${count}`;
					progressBar.value = `${(processed / count) * 100}`;
				}catch (e){
					requestQueue.push(name);
					console.warn(e, name);
				}
			}
			processing--;
			if (requestQueue.length === 0 && listingEnded && processing === 0) {
				clearInterval(requestScheduler);
				progressMessage.innerText = `Обработка звершена. Найдено ${people.length} спортсменов.`;
				progressBar.value = '100';
				resolve();
			}
		}, 50);
		count = await listNames((e) => {
			count += e.length;
			requestQueue.push(...e);
		}, TABLE_ID, TABLE_LIST);
		listingEnded = true;
	});

	people = people.filter(e => FILTERS[ageFilterSelect.value](e));
	document.getElementById('process_state').innerText = `Обработка звершена. Найдено ${people.length} спортсменов.`;

	const result = await writeValues(listName || DEFAULT_RESULT_SHEET, TABLE_ID, people, APPEND_VALUES);
	if(APPEND_VALUES)
		resultMessage.innerText = `Новые данные добавлены в ${result.updatedRange}.`;

	runButton.disabled = false;
	runButton.innerText = "Запустить";
}
