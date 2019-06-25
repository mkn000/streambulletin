let token;
let ydb;
window.indexedDB.open("swpushnotificationsdb",1).onsuccess = function(event){
	    ydb = event.target.result;
	    ydb.transaction(["swpushnotificationsstore"])
		.objectStore("swpushnotificationsstore")
		.get("IDToken").onsuccess = function(event){
		    token = event.target.result.value;
		    let ythead = {'X-Youtube-Identity-Token':token,
				'X-Youtube-Client-Name':1,
				'X-Youtube-Client-Version':2.20190625
				 }
		    browser.storage.local.set({ytauth:ythead});
		}
}    
