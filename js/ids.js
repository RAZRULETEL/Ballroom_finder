
const autoComplete = document.createElement('div');
document.body.appendChild(autoComplete);
autoComplete.className = "auto-complete";

document.getElementById("table_id").addEventListener("focusin", (e) => {
	const input = e.currentTarget;

	let ids = localStorage.getItem('ids');
	const suggestions = [];
	if(ids && (ids = JSON.parse(ids))){
		const spreadSheetIcon = document.createElement('img');
		spreadSheetIcon.src = 'img/spreadsheet_icon.png';
		for (let id of Object.keys(ids).sort((a, b) => ids[a].last_access - ids[b].last_access)) {
			const div = document.createElement('div');
			div.innerHTML = `<p>${id}</p>`;
			div.addEventListener('click', () => {
				input.value = id;
				input.dispatchEvent(new Event('input', { bubbles: true }));
				hideAutoComplete();
			});

			const link = document.createElement('a');
			link.href = `https://docs.google.com/spreadsheets/d/${id}/`;
			link.innerHTML = spreadSheetIcon.outerHTML + " " + ids[id].title;
			link.className = "table_link";
			link.target = "_blank";
			link.addEventListener('click', (e) => {
				e.stopImmediatePropagation();
			});

			const remove = document.createElement('img');
			remove.src = 'img/close.svg';
			remove.style.height = '20px';
			remove.style.padding = '0 5px';
			remove.addEventListener('click', (e) => {
				e.stopImmediatePropagation()
				delete ids[id];
				localStorage.setItem('ids', JSON.stringify(ids));
				autoComplete.removeChild(div);
			});

			div.appendChild(link);
			div.appendChild(remove);
			suggestions.push(div);
		}
		autoComplete.replaceChildren(...suggestions)
		autoComplete.style.top = (input.getBoundingClientRect().bottom - 1) + "px";
		autoComplete.style.left = input.getBoundingClientRect().left + "px";
		autoComplete.style.width = (input.getBoundingClientRect().width - 2) + "px";
	}
})

// document.getElementById("table_id").addEventListener("focusout", hideAutoComplete);

function hideAutoComplete(){
	autoComplete.style.top = "-100000px";
}

/**
 * Updates or adds an ID to the local storage.
 *
 * @param {string} id ID to be updated or added
 * @param {Object} info information about the spreadsheet
 * @return {void}
 */
function addOrUpdateId(id, info){
	if(!id)
		return;
	const ids = JSON.parse(localStorage.getItem('ids')) || {};
	info.last_access = Date.now();
	ids[id] = info;
	localStorage.setItem('ids', JSON.stringify(ids));
}
