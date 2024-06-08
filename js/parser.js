const NAME_COLUMN = 1;
const AGE_COLUMN = 4;

const domParser = new DOMParser();

async function parseNameTadance(name){
	let response = await fetchSeProxy(name);
	const html = (await response.json()).viewSearchResult;
	if(!html) return;

	const dom = domParser.parseFromString(`<div>${html}</div>`, "text/xml");
	const people = [...dom.children[0].children].map(el => {
		const result = [
			el.getAttribute("href").substring(17),
			el.children[0].innerHTML.replace("(из архива)", "").trim()
		];
		let ageClubCity;
		if(el.children[1].innerHTML.includes("Класс (St/La)")) {
			const match = el.children[1].innerHTML.split("-")[1].match(/\w\/\w/i);
			if (match)
				result.push(...match[0].split('/'));
			else
				result.push(null, null);
			ageClubCity = el.children[2].innerHTML.split(",");
		}else{
			result.push(null, null);
			ageClubCity = el.children[1].innerHTML.split(",");
		}
		if(ageClubCity.length < 3)
			result.push((ageClubCity[0].match(/\d+/) || [null])[0], null, ageClubCity[ageClubCity.length - 1].trim());
		else
			result.push(ageClubCity[0].match(/\d+/)[0], ageClubCity[1].trim(), ageClubCity.slice(2).join(",").trim());
		if(!isNaN(result[AGE_COLUMN])) result[AGE_COLUMN] = +result[AGE_COLUMN];
		return result;
	})
	return people;
}

function fetchThingProxy(name){
	return fetch("https://thingproxy.freeboard.io/fetch/https://tadance.ru/Athlete/SearchAthletes", {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({pageNum: 1, term: name})
	});
}

function fetchSeProxy(name){
	return fetch("https://se.ifmo.ru/~s373739/proxy.php", {
		method: "POST",
		headers: {
			"Content-type": "application/json",
		},
		body: JSON.stringify({
			"cors": "https://tadance.ru/Athlete/SearchAthletes",
			"method": "POST",
			"pageNum": 1,
			"term": name
		})
	});
}
