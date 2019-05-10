var keys;
var page;
var style;
var index = {nico: "ニコ生",
	     whow: "whowatch",
	     orec: "OPENREC",
	     twc: "TwitCasting",
	     yt: "YouTube"}

document.addEventListener("DOMContentLoaded",async function(){
    let head = `Stream Bulletin v.${browser.runtime.getManifest().version}`;
    document.getElementById("verInfo").textContent = head;
    page = await browser.runtime.getBackgroundPage();
    keys = page.keys;
    menuSetup();
    getLives();
})

	
function menuSetup(){
    let button = document.getElementsByClassName("loginButton")[0];
    button.innerText = browser.i18n.getMessage("loginStatusButton");
    
    let box = document.createElement("input");
    box.type = "checkbox";
    box.addEventListener('change',() => {
	let menu = document.getElementById("menu");
	if (box.checked) {
	    menu.style.display = "flex";
	} else {
	    menu.style.display = "none"
	}
    })
    button.appendChild(box);
    
    let isOff = false;
    let menu = document.getElementById("menu");
    for (let item of keys) {
	if  (!page[item].login){
	    isOff = true;
	    let offsite = document.createElement("span");
	    offsite.innerText = index[item];
	    offsite.className = "offline";
	    offsite.title = browser.i18n.getMessage("loginTip");
	    offsite.addEventListener("click",function(){
		page[item].loginCheck();
		setTimeout(() => window.location.reload(),250);
	    })
	    menu.appendChild(offsite);
	}
    }
    if (!isOff) {
	menu.innerText = browser.i18n.getMessage("loginOK");
    } else {
	button.style.backgroundColor = "red";
    }
}

function getLives(){
    let lives = [];
    for (let key of keys){
	lives = lives.concat(page[key].lives);
    }
    lives.sort(function(a,b){return b.startTime.diff(a.startTime)});
    if (lives.length == 0){
	let nope = document.createElement("p");
	nope.textContent = browser.i18n.getMessage("noStreams");
	document.body.appendChild(nope);
    } else {
	lives.forEach(crElements);
    }
}


function crElements(ar){
    var info = document.createElement("div");
    info.id = ar.id;
    info.className = "live";
    let startTime;
    if (ar.timeNote) {
	startTime = ar.timeNote;
    } else {
	startTime = ar.startTime.local().format(
	    browser.i18n.getMessage("timeFormat"));
    }
    info.title = `${startTime}\n${ar.title}`;
    document.body.appendChild(info);

    var channel = document.createElement("div")
    channel.textContent = ar.channel;
    channel.className = "channel";
    info.appendChild(channel);
    
    var image = document.createElement("div");
    var icon = document.createElement("img");
    icon.src = ar.thumbUrl;
    icon.className = "icon";
    image.appendChild(icon);
    info.appendChild(image);
    
    document.getElementById(ar.id).addEventListener("click",function(){
	browser.tabs.create({url:page[ar.serv].baseUrl+ar.id});
    })

}
