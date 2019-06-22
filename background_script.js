var upInterval = 15*1000; //15 seconds
var manifest = browser.runtime.getManifest();
var isUpdate;
var initTime;
var nico,whow,orec,twc,yt,fc2,badgeStatus;
var keys = ["nico","whow","orec","twc","yt","fc2"];

var homePage = "https://github.com/mkn000/streambulletin";
var updateURL = "https://raw.githubusercontent.com/mkn000/streambulletin/"+
    "master/updates.json";

class Broadcast{
  constructor(channel,id,title,startTime,thumbUrl,serv){
    this.channel = channel;
    this.id = id;
    this.title = title;
    this.startTime = startTime;
    this.thumbUrl = thumbUrl;
    this.serv = serv;
  }

  append(obj){
    Object.entries(obj).forEach(entry => {
      this[entry[0]] = entry[1];
    })
  }
}

class Serv{
  constructor(){
    this.lives = [];
    this.login;
    this.status;
  }
  
  add(broadcast){
    this.lives.push(broadcast);
  }
  
  remove(ix) {
    this.lives.splice(ix,1);
  }
  
  enterLoop(){
    if (this.status != "offline"){
      this.status = setTimeout(()=>{this.routine()},upInterval);
    }
  }

  online(){
    this.status = "online";
    setTimeout(() => this.loginCheck(),10000)
  }
  
  offline(){
    if (typeof this.status == "number") {
      clearTimeout(this.status);
    }
    this.status = "offline";
  }

  statusMonitor(){
    if (navigator.onLine && this.status == "offline"){
      this.online();
    }
  }
  
  checkDuplicates(){
    if (this.lives.length > 1){
      let i = 0;
      while (i < this.lives.length-1){
        for (let j=i+1; j < this.lives.length; j++){
          if (this.lives[i].id == this.lives[j].id){
            this.remove(j);
	    j=i;
          }
        }
        i++;
      }
    }
  }

  
  errReport(err){
    console.log(`${moment().local().format("Do MMM HH:mm")} | `+
                `${this.constructor.name} | ${err}\n--> Restarting`);
    (navigator.onLine) ? this.loginCheck() : this.offline()
  }

  checkExpired(cookie){
    let timeDiff = moment.now()-(cookie.expirationDate*1000);
    if (timeDiff > 0) {
      return true;
    } else if (timeDiff > -24*3600000) {
      setTimeout(() => {this.login=false;this.offline()},timeDiff+1);
    } 
    return false;
  }
  
}


class Niconama extends Serv{
  constructor(){
    super();
    this.baseUrl = "https://live.nicovideo.jp/watch/lv";
    this.apiUrl = "https://live.nicovideo.jp/api/bookmark/json?type=on_air";
    this.loginCheck();
  }
  
  loginCheck(){
    let cn = browser.cookies.get({name: "user_session",
                                  url: "https://www.nicovideo.jp"});
    cn.then(cookie => {
      if (cookie && !this.checkExpired(cookie)){
        this.login = true;
        this.routine();
      }
    })
  }

  routine(){
    fetch(this.apiUrl)
      .then(resp => resp.json())
      .then(data => this.nicoCheck(data.bookmarkStreams))
      .then(() => this.enterLoop())
      .catch(err => this.errReport(err))
  }

  nicoCheck(data){
    this.lives.forEach((rec,ix) => {
      let isIn = data.some(live => {return rec.id == live.id});
      if (!isIn) {this.remove(ix)}
    })

    data.forEach(live => {
      let isIn = this.lives.some(rec => {return live.id == rec.id})
      if (!isIn) {this.nicoAdd(live)}
    })

    this.checkDuplicates();
  }

  async nicoAdd(live){
    let more = await fetch(`https://live2.nicovideo.jp/watch/lv${live.id}`+
                           `/programinfo`).then(resp => resp.json())
    let startTime = moment.unix(more.data.beginAt);
    let channel = more.data.socialGroup.name;
    fetch(live._communityinfo.thumbnail)
      .then(resp => resp.blob())
      .then(blob => {
        this.add(new Broadcast(channel,
                               live.id,
                               live.title,
                               startTime,
                               URL.createObjectURL(blob),
                               "nico"
                              )
                )
      })
      .catch(err => this.errReport(err))
  }
}

class Whowatch extends Serv{
  constructor(){
    super();
    this.baseUrl = "https://whowatch.tv/viewer/";
    this.apiUrl = "https://api.whowatch.tv/lives?category_id=0"+
      "&list_type=popular";
    this.loginCheck();
  }

  loginCheck(){
    fetch("https://api.whowatch.tv/users/me/profile")
      .then(resp => resp.json())
      .then(data => {
        if (data.name){
          this.login = true;
          this.routine();
        }
      })
      .catch(err => this.errReport(err))
  }

  routine(){
    fetch(this.apiUrl)
      .then(resp => resp.json())
      .then(data => this.whowCheck(data[0].popular))
      .then(() => this.enterLoop())
      .catch(err => this.errReport(err))
  }

  whowCheck(data){
    let i;
    for (i=0;i < data.length; i++){
      if (data[i].is_follow){
        let isIn = this.lives.some(rec => {
          return data[i].id == rec.id;
        })
        if (!isIn) {this.whowAdd(data[i])}
      } else if (data[i].user.is_admin){
        continue;
      } else {
        break;
      }
    }

    let online = data.slice(0,i);
    this.lives.forEach((rec,ix) => {
      let isIn = online.some(live => {
        return live.id == rec.id;
      })
      if (!isIn) {this.remove(ix)}
    })

    this.checkDuplicates();
  }

  whowAdd(live){
    fetch(live.user.icon_url)
      .then(resp => resp.blob())
      .then(blob => {
        this.add(new Broadcast(live.user.name,
                               live.id,
                               live.title,
                               moment(live.started_at),
                               URL.createObjectURL(blob),
                               "whow"
                              )
                )
      })
      .catch(err => this.errReport(err))
  }
  
  
}

class Openrec extends Serv{
  constructor(){
    super();
    this.baseUrl = "https://www.openrec.tv/live/";
    this.apiUrl = "https://www.openrec.tv/viewapp/api/v3/timeline/more";
    this.loginCheck();
  }

  async loginCheck(){
    let params = new URLSearchParams();
    for (let item of ["Uuid","Token","Random"]){
      let co = await browser.cookies.get({name:item.toLowerCase(),
                                          url:"https://www.openrec.tv"});
      if (co){
        params.set(item,co.value);
      } else {
        params = false;
        break;
      }
    }
    if(params){
      this.login = params.toString();
      let cookie = [];
      for (let item of ["lang","device","init_dt"]){
        let co =
            await browser.cookies.get({name:item,
                                       url: "https://www.openrec.tv"});
        cookie.push(`${item}=${co.value}`);
      }
      this.cookie = cookie.join('; ');
      this.routine();
    } else {
      this.login = false;
    }
  }

  async routine(){
    let last_page = false;
    let live = [];
    for (let p=1; !last_page;++p){
      try{
	let odata =
            await fetch(this.apiUrl+`?${this.login}&page_number=${p}&term=1`,
                      {headers:{'Cookie':this.cookie}})
            .then(resp => resp.json())
            .catch(err => this.errReport(err))
        if (odata.data.items){
          for (let item of odata.data.items){
            if(item.movie_live.onair_status == 1){
              live.push(item);
            }
          }
        }
        last_page = odata.data.is_last_page;
        setTimeout(() => {},100);
      }
      catch(err) {this.errReport(err)}
    }
    this.openRecCheck(live);
    this.enterLoop();
  }

  openRecCheck(data){
    this.lives.forEach((rec,ix) => {
      let isIn = data.some(live => live.identify_id == rec.id);
      if (!isIn) {this.remove(ix)}
    })

    data.forEach(live => {
      let isIn = this.lives.some(rec =>
                                 {return rec.id == live.identify_id});
      if (!isIn) {this.openRecAdd(live)}
    })

    this.checkDuplicates();
  }

  openRecAdd(live){
    fetch(live.user_icon)
      .then(resp => resp.blob())
      .then(blob => {
        let startTime = moment.tz(live.movie_live.onair_start_dt,
                                  "YYYY-MM-DD HH:mm:ss","Asia/Tokyo");
        this.add(new Broadcast(live.user_name,
                               live.identify_id,
                               live.meta_data,
                               startTime,
                               URL.createObjectURL(blob),
                               "orec"
                              )
                )
      })
      .then(err => this.errReport(err))
  }
}

class Twitcasting extends Serv{
  constructor(){
    super();
    this.baseUrl = "https://twitcasting.tv/";
    this.loginCheck();
  }

  async loginCheck(){
    let cookie = [];
    let broken;
    for (let item of ['hl','did','tc_id','tc_ss']){
      let tc = await browser.cookies.get({name:item,
                                          url:"https://twitcasting.tv"})
      if(tc){
        cookie.push(`${item}=${tc.value}`);
      } else {
        broken = true;
        break;
      }
    }
    if (!broken) {
      this.login = cookie.join('; ');
      this.routine();
    }
  }

  routine(){
    fetch(this.baseUrl,{headers:{'Cookie':this.login}})
      .then(resp => resp.text())
      .then(html => {
        let parser = new DOMParser();
        let doc = parser.parseFromString(html,"text/html")
        return doc;
      })
      .then(page => {
        let online =
            page.getElementsByClassName("tw-index-support-column");
        this.twitcastCheck(Array.from(online));
      })
      .then(() => this.enterLoop())
      .catch(err => this.errReport(err))
  }

  twitcastCheck(data){
    this.lives.forEach((rec,ix) => {
      let isIn = data.some(live => {
        let user = live.children[0].pathname.split('/')[1];
        return user == rec.id;
      })
      if (!isIn) {this.remove(ix)}
    })

    data.forEach(live => {
      let user = live.children[0].pathname.split('/')[1];
      let isIn = this.lives.some(rec => {return rec.id == user});
      if (!isIn) {this.twitcastAdd(user)}
    })

    this.checkDuplicates();
  }

  twitcastAdd(live){
    fetch(this.baseUrl+live)
      .then(resp => resp.text())
      .then(async html => {
        let resp2 =
            await fetch(this.baseUrl+`userajax.php?c=status&u=${live}`)
            .then(resp => resp.json())
        let dur = moment()-moment.duration(resp2.duration,'seconds');
        let parser = new DOMParser();
        let doc = parser.parseFromString(html,"text/html");
        let title = doc.getElementById("movietitle").children[0].
            innerText.trim();
        let channel = doc.
            getElementsByClassName("tw-live-author__info-username")[0]
            .innerText.trim();
        let thumb = doc.getElementsByClassName("authorthumbnail")[0]
            .attributes.src.nodeValue;
        let blob =
            await fetch("https:"+thumb).then(resp => resp.blob())
        this.add(new Broadcast(channel,
                               live,
                               title,
                               moment(dur),
                               URL.createObjectURL(blob),
                               "twc"
                              )
                )
      })
      .catch(err => this.errReport(err))
  }
  
}

class Youtube extends Serv{
  constructor(){
    super();
    this.fetched = [];
    this.baseUrl = "https://www.youtube.com/watch?v=";
    this.apiUrl = "https://www.youtube.com/feed/subscriptions?flow=2&pbj=1";
    this.apiUrl2 = "https://www.youtube.com/guide_ajax?action_load_guide=1";
    this.loginCheck();
  }

  async loginCheck(){
    let cy = await browser.cookies.get({name: "LOGIN_INFO",
                                        url: "https://www.youtube.com/"});
    let cy2 = await browser.storage.local.get('ytauth');
    if (cy && cy2.hasOwnProperty('ytauth')){
      this.login = cy2.ytauth;
      initTime = moment();
      setTimeout(() => this.routine(),200);
    } else {
      this.login = false;
    }
  }

  routine(){
    fetch(this.apiUrl,{headers: this.login})
      .then(resp => resp.json())
      .then(data => this.youtubeCheck(data))
      .then(() => this.routine2())
      .then(() => this.enterLoop())
      .catch(err => this.errReport(err))
  }

  routine2(){
    fetch(this.apiUrl2,{headers:this.login})
      .then(resp => resp.json())
      .then(data => this.youtubeCheck2(data))
      .then(() => this.youtubeEnded())
  }
  
  youtubeCheck(data){
    let i = 0;
    let feed = data[1].response.contents.twoColumnBrowseResultsRenderer.
        tabs[0].tabRenderer.content.sectionListRenderer.contents;
    feed.forEach(item => {
      let yTop = item.itemSectionRenderer.contents[0].shelfRenderer;
      if (yTop.title.simpleText == 'Live'){
        let y = yTop.content.expandedShelfContentsRenderer.items[0]
            .videoRenderer;
        this.fetched.push(y.videoId);
        let isIn = this.lives.some(rec => {
          return rec.id == y.videoId});
        if (!isIn){this.youtubeAdd(y)}
      }
    })

  }

  youtubeCheck2(data){
    let temp = [];
    let feed = data.response.items[1].guideSubscriptionsSectionRenderer;
    for (let i=0;i<feed.items.length-2;i++){
      let item = feed.items[i].guideEntryRenderer;
      if (item.badges.liveBroadcasting){
        temp.push(item);
      } else {
        break;
      }
      
    }

    temp.forEach(item => {
      let isIn = this.lives.some(rec => {
        return rec.channelID == item.navigationEndpoint.browseEndpoint.
	  browseId;
      })
      if (!isIn){
        fetch("https://www.youtube.com/channel/"
              +item.navigationEndpoint.browseEndpoint.browseId+"?pbj=1",
	      {headers:this.login})
          .then(resp => resp.json())
          .then(data => {
            let path = data[1].response.contents.
		twoColumnBrowseResultsRenderer.
                tabs[0].tabRenderer.content.sectionListRenderer.
                contents[0].itemSectionRenderer.contents[0].
                channelFeaturedContentRenderer.items[0].
                videoRenderer;
            this.fetched.push(path.videoId);
            this.youtubeAdd(path);
          })
          .catch(err => this.errReport(err))
      }
    })
  }
  
  youtubeAdd(live){
    fetch(live.channelThumbnailSupportedRenderers.
          channelThumbnailWithLinkRenderer.thumbnail.thumbnails[0].url)
      .then(resp => resp.blob())
      .then(blob => {
        let stream = new Broadcast(live.ownerText.runs[0].text,
                                   live.videoId,
                                   live.title.simpleText,
                                   moment(),
                                   URL.createObjectURL(blob),
                                   "yt"
                                  )
        if (moment().diff(initTime) < 20000){
          stream.append({startUnclear: true})
        }
        stream.append({channelID:live.ownerText.runs[0].
                       navigationEndpoint.browseEndpoint.browseId})
        this.add(stream);
      })
      .catch(err => this.errReport(err))
  }

  youtubeEnded(){
    this.lives.forEach((rec,ix) => {
      let isIn = this.fetched.some(live => {return rec.id == live})
      if (!isIn) {this.remove(ix)}
    })
    
    this.checkDuplicates();
    this.fetched = [];    
  }
  
}

class FC2 extends Serv{
  constructor(){
    super();
    this.favs = [];
    this.apiUrl = "https://live.fc2.com/api/memberApi.php?";
    this.baseUrl = "https://live.fc2.com/"
    this.loginCheck();
  }


  async loginCheck(){
    let co = await browser.cookies.get({name:"fcu",
                                        url:"https://live.fc2.com"});
    if (co && !this.checkExpired(co)){
      this.login = true;
      this.routine();
    } else {
      this.login = false;
    }
  }

  routine(){
    fetch("https://live.fc2.com/contents/favorite.php",{method:'POST'})
      .then(resp => resp.json())
      .then(channels => channels.data)
      .then(async favs => {
        await favs.forEach((id,ix,arr) => {
          fetch(this.apiUrl+`streamid=${id}&channel=1&profile=1`,
		{method:'POST'})
            .then(resp => resp.json())
            .then(info => {this.fc2CheckInv(info.data)})
        })
        this.fc2CheckFav(favs);
      })
      .then(() => this.enterLoop())
      .catch(err => this.errReport(err))
  }
  
  fc2CheckInv(data){
    let isIn = false;
    let i=0;
    while(i < this.lives.length){
      if (this.lives[i].id == data.channel_data.channelid){
        isIn = true;
        break;
      }
      i++;
    }
    if (data.channel_data.is_publish && !isIn){
      this.fc2Add(data);
    } else if (!data.channel_data.is_publish && isIn) {
      this.remove(i);
    }

    
  }

  fc2CheckFav(favs){
    this.lives.forEach((rec,ix) => {
      let isIn = favs.some(fav => {return rec.id == fav})
      if (!isIn) {this.remove(ix)}
    })
  }
  

  fc2Add(live){
    fetch(live.channel_data.image)
      .then(resp => resp.blob())
      .then(blob => {
        let stream = new Broadcast(live.profile_data.name,
                                   live.channel_data.channelid,
                                   live.channel_data.title,
                                   moment(live.channel_data.start),
                                   URL.createObjectURL(blob),
                                   "fc2");
        this.lives.push(stream)
      })
  }

}


class badgeUpdater{
  constructor(){
    this.status;
    this.update();
  }

  update(){
    this.status = setInterval(() => {
      let total = 0;
      for (let item of keys){
        total += window[item].lives.length;
      }
      browser.browserAction.setBadgeText({text: total.toString()});
      browser.browserAction.setBadgeBackgroundColor({color: "blue"});
    },upInterval/5)
  }

  offline(){
    clearInterval(this.status);
    this.status = "offline";
    browser.browserAction.setBadgeText({text: ""});
    browser.browserAction.setBadgeBackgroundColor({color: "red"});
  }
}

(function startUp(){
  versionCheck();
  initTime = moment();
  nico = new Niconama();
  whow = new Whowatch();
  orec = new Openrec();
  twc = new Twitcasting();
  yt = new Youtube();
  fc2 = new FC2();
  badgeStatus = new badgeUpdater();
})();



function versionCheck(){
  fetch(updateURL)
    .then(resp => resp.json())
    .then(data => {
      for (let id in data.addons){
        let latest = data.addons[id].updates.pop().version;
        isUpdate = versionDiff(manifest.version,latest);
      }
    })

}


function versionDiff(old,newe){
  let cur = old.split('.');
  let lat = newe.split('.');

  for (i=0;i < 3;i++){
    if (lat[i] > cur[i]) {return true}
  }
  return false;
}


window.addEventListener("online",() => {
  try {
    initTime = moment();
    this.badgeStatus.update();
    let stillDown = true;
    let setOnline = setInterval(() => {
      for (let item of keys){
        if (typeof window[item].status != 'number'){
          window[item].online();
        }
      }
      stillDown = keys.some(key => {
        return window[key].status == 'offline';
      });

      (!stillDown) ? clearInterval(setOnline) : {}
    },5000);
  }
  catch(err) {console.log(err)}
})

window.addEventListener("offline",() => {
  this.badgeStatus.offline();
  for (let item of keys){
    window[item].offline();
  }
})

