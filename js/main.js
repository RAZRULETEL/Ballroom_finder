let state_checker;
let authInterval;

const tableLink = document.getElementById("table_link");

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
	minute: '2-digit',
	second: '2-digit',
});

let TABLE_ID = "";

tableIdInput.addEventListener("input", async (e) => {
	const match = e.currentTarget.value.match(/(?<=docs\.google\.com\/spreadsheets\/d\/)[\w\d]+(?=\/)/) || e.currentTarget.value.match(/^[\w\d]{44}$/i);
	if (match) {
		tableIdInput.disabled = true;
		const info = await getSheetInfo(match[0]);
		tableIdInput.disabled = false;
		if (info && typeof info === "object") {
			tableIdInput.style.color = "green";

			tableLink.href = `https://docs.google.com/spreadsheets/d/${match[0]}/`;
			tableLink.innerHTML = info.title;
			tableLink.style.color = "black";
			tableLink.style.pointerEvents = "all";
			addOrUpdateId(match[0]);
		} else {
			tableIdInput.style.color = "red";

			tableLink.innerHTML = info || "Неизвестная ошибка.";
			tableLink.href = "";
			tableLink.style.color = "red";
			tableLink.style.pointerEvents = "none";
		}
	}else {
		tableIdInput.style.color = "black";
		tableLink.href = "";
		tableLink.style.color = "red";
		tableLink.style.pointerEvents = "none";
	}
});

if (localStorage.getItem('ids')) {
	const ids = JSON.parse(localStorage.getItem('ids'));
	let max = ['', 0];
	for (const id of Object.entries(ids)) {
		if(id[1] > max[1]) max = id;
	}
	tableIdInput.value = max[0];
	tableIdInput.dispatchEvent(new Event('input', { bubbles: true }));
}

const description = document.getElementById("tip_description");
const tips = document.getElementsByClassName("info");
for (let tip of tips) {
	tip.addEventListener("mouseenter", (e) => {
		description.innerHTML = e.currentTarget.getAttribute("data-title");
		const rect = e.currentTarget.getBoundingClientRect();
		description.style.top = (rect.y - description.getBoundingClientRect().height) + "px";
		description.style.left = (rect.x + rect.width) + "px";
	})
	tip.addEventListener("mouseout", (e) => {
		description.style.top = "-100000px";
	})
}


function setAuthorized() {
	const time = JSON.parse(localStorage.getItem(TOKEN_LOCAL_STORAGE_NAME)).expires_in - Date.now();
	authButton.innerText = `Авторизованы ещё ${dateFormatter.format(time)}`
	clearInterval(authInterval);
	if (time < 0)
		setUnauthorized();
	else {
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
}

function setUnauthorized() {
	clearInterval(authInterval);
	authButton.innerText = "Авторизоваться";
	authButton.disabled = false;
	authButton.style.background = "";
	// runButton.disabled = true;
}

authButton.addEventListener("click", handleAuthClick);
runButton.addEventListener("click", namesProcessorFactory);


async function namesProcessorFactory(e){
	runButton.disabled = true;
	runButton.innerText = "Обработка...";

	const listName = await createList('Бальники', TABLE_ID, false) || 'Бальники';// TODO
	if(!listName){
		runButton.disabled = false;
		runButton.innerText = "Запустить";
		return;
	}

	const people = [];

	await new Promise(async (resolve, reject) => {
		const progressMessage = document.getElementById('process_state');
		const progressBar = document.getElementById('process_bar');

		let listingEnded = false;
		let count = 0,  processed = 0;
		const requestQueue = [];
		const requestScheduler = setInterval(async function () {
			const name = requestQueue.shift();
			if (name){
				try {
					const result = await parseNameTadance(name);
					if(result)
						people.push(...result);
					progressMessage.innerText = `Обработано ${processed++} имён из ${count}`;
					progressBar.value = `${(processed / count) * 100}`;
				}catch (e){
					requestQueue.push(name);
					console.warn(e, name);
				}
			}else
				if (listingEnded){
					clearInterval(requestScheduler);
					progressMessage.innerText = `Обработка звершена. Найдено ${people.length} спортсменов.`;
					progressBar.value = '100';
					resolve();
				}
		}, 250);

		count = await listNames(async (e) => {
			count += e.length;
			requestQueue.push(...e);
		});
		listingEnded = true;
	})

	await writeValues(listName, TABLE_ID, people);

	runButton.disabled = false;
	runButton.innerText = "Запустить";
}
