var show;
var index;
var baseUrls = {niconama:"https://live.nicovideo.jp/watch/lv",
		whowatch:"https://whowatch.tv/viewer/",
		orec:"https://www.openrec.tv/live/",
		twc:"https://twitcasting.tv/",
		yt:"https://www.youtube.com/watch?v="
	       }

document.addEventListener("DOMContentLoaded",async function(){
    let head = `Stream Bulletin v.${browser.runtime.getManifest().version}`;
    document.getElementsByTagName("header")[0].textContent = head;
    let page = await browser.runtime.getBackgroundPage();
    index = page.index;
    let getOption = await browser.storage.local.get();
    show = getOption.show;
    menuSetup();
    if (show == "all" || index[show].login){
	getLives(show);
    } else {
	let pls = document.createElement("p");
	pls.innerText = "ログインして、下の「リロード」ボタンを押してください。";
	document.body.appendChild(pls);
	let but = document.createElement("button");
	but.innerText = "リロード";
	but.className = "reloadButton";
	but.addEventListener("click",function(){
	    page.loginCheck(show);
	    window.location.reload();
	})
	document.body.appendChild(but)
    }
    
})

	
function menuSetup(){
    let menu = document.getElementsByClassName("selection");
    for (let item of menu) {
	if (item.id == show) {
	    item.style.backgroundColor = "blue";
	    item.style.color = "white";
	} else if (item.id != "all" && !index[item.id].login){
	    item.className = "selection offline";
	}
	item.addEventListener("click",function(){
	    let change = browser.storage.local.set({show:item.id})
	    change.then(function(){window.location.reload()})
	})
    }
}

function getLives(show){
    let lives = [];
    if (show == "all"){
	Object.entries(index).forEach(([key,value]) =>
				      lives = lives.concat(value.lives));
    } else {
	lives = index[show].lives;
    }
    lives.sort(function(a,b){return b.startTime.diff(a.startTime)});
    if (lives.length == 0){
	let nope = document.createElement("p");
	nope.textContent = "現在、配信はありません";
	document.body.appendChild(nope);
    } else {
	lives.forEach(crElements);
    }
}


function crElements(ar){
    var info = document.createElement("div");
    info.id = ar.id;
    info.className = "live";
    document.body.appendChild(info);
    
    var heading = document.createElement("div");
    if (ar.timeNote) {
	heading.textContent = ar.timeNote;
    } else {
	heading.textContent =
	    ar.startTime.local().format("M[月]D[日]　HH:mm[開始]");
    }
    heading.className = "time";
    info.appendChild(heading);
    
    var image = document.createElement("div");
    var icon = document.createElement("img");
    icon.src = ar.thumbUrl;
    icon.className = "icon";
    image.appendChild(icon);
    info.appendChild(image);

    var content = document.createElement("div");
    content.innerText = ar.title;
    content.className = "title";
    info.appendChild(content);
    
    document.getElementById(ar.id).addEventListener("click",function(){
	browser.tabs.create({url:baseUrls[ar.serv]+ar.id});
    })

}
