var index = {nico:{lives:[]},
	     whow:{lives:[]},
	     orec:{lives:[]},
	     twc:{lives:[]},
	     yt:{lives:[]}
	    }
var oh = ["Uuid","Token","Random"];//openrec login
var oc = ["lang","device","init_dt"];//openrec header
var tc = ["hl","did","tc_id","tc_ss"];//twitcasting login
var option = {show: "all"};
var startUpTime;
browser.storage.local.set(option);

window.addEventListener("online",function(){startUpTime = moment();
					    console.log("works")});

(function startup(){
    new Promise((resolve) => {
	startUpTime = moment();
	Object.entries(index).forEach(([key,value]) => loginCheck(key));
	resolve();
    })
	.then(mainRoutine())
})();

//check login status
async function loginCheck(site){
    switch(site) {
    //niconama	
    case "nico":
	let cn = browser.cookies.get({name: "user_session",
				      url: "https://www.nicovideo.jp"})
	cn.then(cookie => {(cookie) ? index.nico.login = true : {}})
	cn.catch(err => console.log(err))
	break;
    //whowatch	
    case "whow":
	fetch("https://api.whowatch.tv/users/me/profile")
	    .then(resp => resp.json())
	    .then(data => {
		if (data.name){
		    index.whow.login = true;
		}
	    })
	    .catch(err => console.log(err))
	break;
    //openrec
    case "orec":
	arr = [];
	for (let item of [...oh.map(x => x.toLowerCase()),...oc]) {
	    let co2 = browser.cookies.get({name:item,
					   url:"https://www.openrec.tv"});
	    co2.then(cookie => arr.push(cookie))
	}
	
	let co = new Promise((resolve) =>
			     setTimeout(function(){resolve(arr)},100));
	co.then(cookies => {
	    if (cookies){
		let cookie = "";
		let params = new URLSearchParams();
		for (let val of cookies) {
		    if (oc.find(function(h){return val.name==h;})){
			cookie = cookie+`${val.name}=${val.value}; `
		    }

		    let ix = oh.findIndex(function(o){
			let x = o.localeCompare(val.name,undefined,
						{sensitivity:'base'})
			return (x == 0) ? true:false;
		    })
		    
		    if (ix >= 0){
			params.set(oh[ix],val.value);
		    }
		}
		Object.assign(index.orec,{cookie:cookie.slice(0,-2),
					  login: params.toString()});
	    }
	})
	break;
    //twitcasting
    case "twc":
	cookie2 = "";
	let broken;
	for (let item of tc){
	    let ctc = await browser.cookies.get({name: item,
						 url: "https://twitcasting.tv"})
	    if (ctc) {
		cookie2 = cookie2+`${ctc.name}=${ctc.value}; `;
	    } else {
		broken = true;
		break;
	    }
	}
	if (!broken) {
	    Object.assign(index.twc,{login:cookie2.slice(0,-2)});
	}
	break;
    case "yt":
	let cy = await browser.storage.local.get();
	index.yt.login = cy.ytauth;
	break;
    }
    
}

//fetch live information every 15 seconds
function mainRoutine(){
    setTimeout(function(){
	updateFun();
	mainRoutine();
    },15*1000)
}

function updateFun() {
    if ( Object.keys(index).some(key => key.login)) {
	browser.browserAction.setTitle(
	    {title:"Stream Bulletin - ログインしてください"})
	browser.browserAction.setBadgeTextColor({color: "red"});
	browser.browserAction.setBadgeText({text:"0"});
	browser.browserAction.setBadgeBackgroundColor({color:"red"});
    } else {
	//niconama
	if (index.nico.login){
	    fetch("https://live.nicovideo.jp/api/bookmark/json?type=on_air")
		.then(resp => resp.json())
		.then(data => nicoCheck(data.bookmarkStreams))
		.catch(err => console.log(err))
	}
	//whowatch
	if (index.whow.login){
	    fetch("https://api.whowatch.tv/lives?category_id=0"+
		  "&list_type=popular")
		.then(resp => resp.json())
		.then(data => whowCheck(data[0].popular))
		.catch(err => console.log(err))
	}
	//openrec
	if (index.orec.login){
	    let page = 0;
	    let oLive = [];
	    (function orecFetch(){
		++page;
		p = new Promise((resolve) => {
		fetch('https://www.openrec.tv/viewapp/api/v3/timeline/more?'+
		      index.orec.login+`&page_number=${page}&term=1`,
		      {headers:{'Cookie':index.orec.cookie}}
		     )
			.then(resp => resp.json())
			.then(od => {
			    if (od.data.hasOwnProperty("items")) {
				od.data.items.forEach(function(entry){
				    if (entry.movie_live.onair_status == 1){
					oLive.push(entry);
				    }
				})
			    }
			    resolve(function(){return od.data.is_last_page});
			});
		});
		p.then(last_page => last_page ? orecCheck(oLive) : orecFetch())
		p.catch(err => console.log(err))
	    })();
	}

	 //twitcasting
	 if (index.twc.login){
	     fetch('https://twitcasting.tv/',
		   {headers:{'Cookie':index.twc.login}})
		 .then(resp => resp.text())
		 .then(html => {let parser = new DOMParser();
				let doc = parser.parseFromString(
				    html,"text/html");
				return doc;
			       })
		 .then(pg => {
		     let online =
			 pg.getElementsByClassName("tw-index-support-column");
		     twcCheck(Array.from(online));
		 })
		 .catch(err => console.log(err))
	 }

	//youtube
	if (index.yt.login) {
	    fetch('https://www.youtube.com/feed/subscriptions?flow=2&pbj=1',
		  {headers:index.yt.login})
		.then(resp => resp.json())
		.then(data => ytCheck(data))
	}
	
	 //toolbar icon
	let total = 0;
	Object.entries(index).forEach(([key,value]) =>
				      total += value.lives.length);
	browser.browserAction.setBadgeText({text: total.toString()});
	browser.browserAction.setBadgeBackgroundColor({color: "blue"});
    }
}
    
//niconama
function nicoCheck(ar){
//Check that internal list matches fetched list
    //check if ended broadcast needs to be removed from internal list
    index.nico.lives.forEach(function(curval,ix){
	let isin = ar.some(function(newval){
	    return curval.id == newval.id;
	})	
	if (!isin){index.nico.lives.splice(ix,1);}
    })
    
    //check if new broadcast needs to be added to internal list
    ar.forEach(function(newval){
	let isin = index.nico.lives.some(function(curval){
	    return newval.id == curval.id;
	})
	if (!isin){nicoParse(newval)}
    })
}
    
function nicoParse(arr){
//format niconama broadcast info
    
    fetch("https://live2.nicovideo.jp/watch/lv"+arr.id+"/programinfo")
	.then(resp => resp.json())
	.then(moreInfo => {
	    let jpTime = moment.unix(moreInfo.data.beginAt);
	    let supInfo = {name:moreInfo.data.broadcaster.name,
			   startTime:jpTime
			  }
	    return supInfo;
	})
	.then(supInfo => {
	    let img = "";
	    let blob = fetch(arr._communityinfo.thumbnail)
		.then(resp => resp.blob())
		.then(daBlob => {
		    let housou = {id:arr.id,
				  title:arr.title,
				  thumbUrl:URL.createObjectURL(daBlob),
				  serv:"niconama"
				 }
		    index.nico.lives.unshift({...supInfo,...housou})
		})
	})
}

//whowatch
function whowCheck(ar){
    //check that whowatch live list matches internal list

    //check if new broadcast needs to be added
    for (i=0;i < ar.length; i++){
	if (ar[i].is_follow){
	    let isin = index.whow.lives.some(function(cur){
		return ar[i].id == cur.id;
	    })
	    if (!isin){whowParse(ar[i])}
	} else if (ar[i].user.is_admin){
	    continue;
	} else {
	    break;
	}
    }

    //check if ended broadcast needs to be removed
    let online = ar.slice(0,i);
    index.whow.lives.forEach(function(curval,ix){
	let isin = online.some(function(newval){
	    return newval.id == curval.id;
	})
	if (!isin){index.whow.lives.splice(ix,1)}
    })
}

function whowParse(entry){
    //format whowatch broadcast info
    fetch(entry.user.icon_url)
	.then(resp => resp.blob())
	.then(daBlob => {
	    let jpTime = moment(entry.started_at);
	    let info = {name: entry.user.name,
			startTime: jpTime,
			title: entry.title,
			id: entry.id,
			thumbUrl: URL.createObjectURL(daBlob),
			serv: "whowatch"
		       }
	    index.whow.lives.unshift(info);
	})
}

//openrec
function orecCheck(data){
    //check if ended broadcast needs to removed
    index.orec.lives.forEach(function(curval,ix){
	let isin = data.some(function(newval){
	    return newval.identify_id == curval.id;
	})
	if (!isin) {index.orec.lives.splice(ix,1);}
    })	
    
    //check if openrec broadcast needs to be added
    data.forEach(function(entry){
	let isin = index.orec.lives.some(function(curval){
	    return curval.id == entry.identify_id;
	})
	if (!isin) {orecParse(entry);}
    })	
}

function orecParse(entry){
    //format openrec broadcast info
    let jpTime = moment.tz(entry.movie_live.onair_start_dt,
			   "YYYY-MM-DD HH:mm:ss","Asia/Tokyo");

    let info = {name: entry.user_name,
		startTime: jpTime,
		title: entry.meta_data,
		id: entry.identify_id,
		thumbUrl: entry.user_icon,
		serv: "orec"
	       }
    index.orec.lives.unshift(info);
}

//twitcasting
function twcCheck(ar){
    //check if broadcast needs to be removed
    index.twc.lives.forEach(function(curval,ix){
	let isin = ar.some(function(newval){
	    let user = newval.children[0].pathname.split('/')[1];
	    return user == curval.id;
	})
	if (!isin) {index.twc.lives.splice(ix,1)}
    })

    //check if broadcast needs to be added
    ar.forEach(function(entry){
	let user = entry.children[0].pathname.split('/')[1];
	let isin = index.twc.lives.some(function(curval){
	    return curval.id == user;
	})
	if (!isin) {twcParse(user)}
    })
}

function twcParse(path){
    let info = {}
    fetch("https://twitcasting.tv/"+path)
	.then(resp => resp.text())
	.then(html => {
	    fetch("https://twitcasting.tv/userajax.php?c=status&u="+path)
		.then(resp => resp.json())
		.then(data => {
		    let sTime =
			moment.now()-moment.duration(data.duration,'seconds');
		    Object.assign(info,{startTime:moment(sTime)});
		})
	    	    
	    let parser = new DOMParser();
	    let doc = parser.parseFromString(html,"text/html")
	    Object.assign(info,{
		title:doc.getElementById("movietitle").innerText,
		id:path,
		serv:"twc"
	    })
	    let imgurl =
		doc.getElementsByClassName("authorthumbnail")[0].
		attributes.src.nodeValue;
	    fetch("https:"+imgurl)
		.then(resp => resp.blob())
		.then(daBlob => {
		    Object.assign(info,{thumbUrl:URL.createObjectURL(daBlob)})
		})
	})
	.then(()=>{index.twc.lives.unshift(info);return true})
	.catch(p => console.log(p))
}

function ytCheck(arr){
    let feed = arr[1].response.contents.twoColumnBrowseResultsRenderer.
	tabs[0].tabRenderer.content.sectionListRenderer.contents;
    for (i=0;i < feed.length-1;i++){
	let yEntryTop = feed[i].itemSectionRenderer.contents[0].shelfRenderer;
	if (yEntryTop.title.simpleText == 'Live'){
	    let yEntry = yEntryTop.content.expandedShelfContentsRenderer.
		items[0].videoRenderer;
	    let isin = index.yt.lives.some(function(curval){
		return curval.id == yEntry.videoId;
	    })
	    if (!isin){ytParse(yEntry)};
	} else {
	    break;
	}
    }

    let online = feed.slice(0,i);
    index.yt.lives.forEach(function(curval,ix){
	let isin = online.some(function(newval){
	    return curval.id == newval.itemSectionRenderer.contents[0].
		shelfRenderer.content.expandedShelfContentsRenderer.items[0].
		videoRenderer.videoId;
	})
	if (!isin){index.yt.lives.splice(ix,1)}
    })
}


function ytParse(entry){    
    fetch(entry.channelThumbnailSupportedRenderers.
	  channelThumbnailWithLinkRenderer.thumbnail.thumbnails[0].url)
	.then(resp => resp.blob())
	.then(daBlob => {
	    let info = {id: entry.videoId,
			title: entry.title.simpleText,
			thumbUrl: URL.createObjectURL(daBlob),
			serv: "yt",
			startTime: moment()
		       }
	    let timeNote = "開始時点不明";
	    if (moment().diff(startUpTime) < 30000){
		info.timeNote = timeNote;
	    }
	    index.yt.lives.unshift(info)
	})
}
