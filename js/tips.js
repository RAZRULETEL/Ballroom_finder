const tips = document.getElementsByClassName("info");
for (let tip of tips) {
	const description = document.createElement("div");
	description.className = "description";
	description.innerHTML = tip.getAttribute("data-title");
	document.body.appendChild(description);
	const rect = tip.getBoundingClientRect();
	tip.addEventListener("mouseenter", (e) => {
		description.style.top = Math.max((rect.y - description.getBoundingClientRect().height), 0) + "px"
		description.style.left = Math.min((rect.x + rect.width), window.innerWidth - 200) + "px";
	})
	tip.addEventListener("mouseout", (e) => {
		description.style.top = "-100000px";
	})
}
