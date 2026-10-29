/* The House Menu — a menu for guests, a recipe box for the kitchen.
   Data: menu.json in this repo (what everyone sees). Edits are kept on this
   device until you press Publish, which commits menu.json (and any new photos)
   back to GitHub through the GitHub API. */
(function(){
"use strict";
var CATS=[{k:"meal",label:"Meals",one:"Meal",hash:"meals"},{k:"dessert",label:"Desserts",one:"Dessert",hash:"desserts"},{k:"cocktail",label:"Cocktails",one:"Cocktail",hash:"cocktails"}];
var catOf=function(k){for(var i=0;i<CATS.length;i++)if(CATS[i].k===k)return CATS[i];return CATS[0]};
var EMPTY={title:"The House Menu",subtitle:"",guestRecipes:true,updatedAt:0,dishes:[]};
var STATE=clone(EMPTY), PUBLISHED=clone(EMPTY);
var ui={tab:"meal",q:"",tag:"",open:null,edit:false,sheet:null};
var cap={canEdit:false,offline:!navigator.onLine};
var root=document.getElementById("root");
var MODEL_QUICK="claude-haiku-4-5-20251001", MODEL_ART="claude-sonnet-5-5";

/* ---------- helpers ---------- */
function clone(o){return JSON.parse(JSON.stringify(o))}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function rich(s){return esc(s).replace(/\*\*([^*]+)\*\*|\*([^*]+)\*/g,function(m,a,b){return '<b>'+(a||b)+'</b>'})}
function uid(){return "d"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function normTag(t){return String(t||"").toLowerCase().trim().replace(/^#/,"").replace(/\s+/g,"-").replace(/[^a-z0-9&\-一-鿿]/g,"").slice(0,28)}
function hash(s){var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return Math.abs(h)}
function byCat(k){return STATE.dishes.filter(function(d){return d.cat===k})}
function find(id){for(var i=0;i<STATE.dishes.length;i++)if(STATE.dishes[i].id===id)return STATE.dishes[i];return null}
function allTags(){var m={};STATE.dishes.forEach(function(d){(d.tags||[]).forEach(function(t){m[t]=(m[t]||0)+1})});return m}
function metaFor(d){if(d.cat==="cocktail")return d.glass||"";return d.time||(d.serves?("serves "+d.serves):"")}
function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch(e){return null}}
function dirty(){return JSON.stringify(strip(STATE))!==JSON.stringify(strip(PUBLISHED))}
function strip(s){var c=clone(s);delete c.updatedAt;return c}
function toast(msg,err){var t=document.getElementById("toast");if(t)t.remove();t=document.createElement("div");t.id="toast";t.className="toast"+(err?" err":"");t.setAttribute("role","status");t.textContent=msg;var kb=document.querySelector(".kitchen");if(kb)t.style.bottom=(kb.offsetHeight+14)+"px";document.body.appendChild(t);clearTimeout(toast.t);toast.t=setTimeout(function(){t.remove()},err?6000:3200)}

/* ---------- tiny IndexedDB key-value store (drafts can hold photos) ---------- */
var kv=(function(){
  var dbp=null;
  function db(){if(dbp)return dbp;dbp=new Promise(function(res,rej){try{var r=indexedDB.open("house-menu",1);r.onupgradeneeded=function(){r.result.createObjectStore("kv")};r.onsuccess=function(){res(r.result)};r.onerror=function(){rej(r.error)}}catch(e){rej(e)}});return dbp}
  function tx(mode,fn){return db().then(function(d){return new Promise(function(res,rej){var t=d.transaction("kv",mode),st=t.objectStore("kv"),r=fn(st);t.oncomplete=function(){res(r&&r.result)};t.onerror=function(){rej(t.error)}})})}
  return{get:function(k){return tx("readonly",function(s){return s.get(k)}).catch(function(){return null})},
         set:function(k,v){return tx("readwrite",function(s){s.put(v,k)}).catch(function(){})},
         del:function(k){return tx("readwrite",function(s){s.delete(k)}).catch(function(){})}};
})();

/* ---------- settings kept on this device only ---------- */
function gh(){var r=ls("hm-gh");try{return r?JSON.parse(r):null}catch(e){return null}}
function aiKey(){return ls("hm-ai-key")||""}
function hasAI(){return !!aiKey()}
function guessRepo(){
  var h=location.hostname,m=/^([^.]+)\.github\.io$/i.exec(h),seg=location.pathname.split("/").filter(Boolean)[0];
  if(!m)return{owner:"",repo:""};
  return{owner:m[1],repo:seg&&!/\.html?$/.test(seg)?seg:(m[1]+".github.io")};
}

/* ---------- illustration (default art, drawn in the page) ---------- */
var artCache={}, LOCALIMG={}; // LOCALIMG: published path -> this device's copy, shown until GitHub Pages serves the file
function artSVG(d){
  var a=d.art||{}, h=(a.hue!=null?a.hue:hash(d.name||d.id)%360);
  var bg="hsl("+((h+180)%360)+" 22% 88%)", bg2="hsl("+((h+180)%360)+" 18% 80%)";
  var c1="hsl("+h+" 62% 52%)", c2="hsl("+((h+35)%360)+" 55% 42%)", c3="hsl("+((h+120)%360)+" 38% 44%)";
  var s='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="'+bg+'"/>';
  s+='<rect y="210" width="400" height="90" fill="'+bg2+'"/>';
  var r=hash(d.id||d.name);
  if(d.cat==="cocktail"){
    var g=(a.glass||(d.glass||"").toLowerCase());
    var liq="hsl("+h+" 70% 58% / .9)";
    s+='<ellipse cx="200" cy="262" rx="70" ry="10" fill="hsl(0 0% 0% / .12)"/>';
    if(/rock|old/.test(g)){
      s+='<path d="M140 130 L150 258 Q200 268 250 258 L260 130 Z" fill="hsl(0 0% 100% / .55)" stroke="hsl(0 0% 20% / .35)" stroke-width="3"/>';
      s+='<path d="M146 170 L152 252 Q200 261 248 252 L254 170 Z" fill="'+liq+'"/>';
      s+='<rect x="168" y="178" width="62" height="54" rx="8" fill="hsl(0 0% 100% / .45)"/>';
      s+='<rect x="214" y="112" width="44" height="14" rx="4" transform="rotate(20 236 119)" fill="hsl(35 70% 55%)"/>';
    }else if(/high|collins/.test(g)){
      s+='<path d="M160 80 L166 258 Q200 266 234 258 L240 80 Z" fill="hsl(0 0% 100% / .55)" stroke="hsl(0 0% 20% / .35)" stroke-width="3"/>';
      s+='<path d="M163 120 L168 252 Q200 259 232 252 L237 120 Z" fill="'+liq+'"/>';
      s+='<rect x="214" y="40" width="6" height="120" rx="3" transform="rotate(10 217 100)" fill="'+c2+'"/>';
    }else{
      var nick=/nick|nora/.test(g);
      s+='<rect x="196" y="160" width="8" height="92" fill="hsl(0 0% 100% / .7)" stroke="hsl(0 0% 20% / .3)" stroke-width="2"/>';
      s+='<ellipse cx="200" cy="254" rx="44" ry="8" fill="hsl(0 0% 100% / .7)" stroke="hsl(0 0% 20% / .3)" stroke-width="2"/>';
      if(nick){s+='<path d="M150 80 Q150 165 200 165 Q250 165 250 80 Z" fill="hsl(0 0% 100% / .55)" stroke="hsl(0 0% 20% / .35)" stroke-width="3"/><path d="M154 100 Q156 160 200 160 Q244 160 246 100 Z" fill="'+liq+'"/>';}
      else{s+='<path d="M120 100 Q126 165 200 165 Q274 165 280 100 Z" fill="hsl(0 0% 100% / .55)" stroke="hsl(0 0% 20% / .35)" stroke-width="3"/><path d="M126 112 Q134 158 200 158 Q266 158 274 112 Z" fill="'+liq+'"/>';}
      s+='<circle cx="'+(nick?238:258)+'" cy="'+(nick?96:104)+'" r="18" fill="none" stroke="'+c3+'" stroke-width="6"/>';
    }
  }else if(d.cat==="dessert"){
    s+='<ellipse cx="200" cy="215" rx="150" ry="52" fill="hsl(0 0% 100% / .85)"/><ellipse cx="200" cy="211" rx="118" ry="38" fill="hsl(0 0% 97%)"/>';
    s+='<path d="M130 205 L200 120 L270 205 Q200 222 130 205 Z" fill="hsl('+h+' 60% 72%)"/>';
    s+='<path d="M130 205 Q200 222 270 205 L270 188 Q200 205 130 188 Z" fill="'+c2+'"/>';
    s+='<path d="M200 120 L270 188 L270 170 L205 112 Z" fill="hsl('+h+' 45% 60%)"/>';
    for(var i=0;i<4;i++){s+='<circle cx="'+(150+((r>>i*3)%100))+'" cy="'+(200+((r>>i*2)%16))+'" r="7" fill="'+c1+'"/>'}
  }else{
    s+='<circle cx="200" cy="150" r="118" fill="hsl(0 0% 100% / .88)"/><circle cx="200" cy="150" r="92" fill="hsl(0 0% 97%)" stroke="hsl(0 0% 85%)" stroke-width="2"/>';
    s+='<ellipse cx="190" cy="160" rx="60" ry="30" fill="hsl(40 30% 90%)"/>';
    s+='<path d="M150 150 Q200 105 250 140 Q235 175 185 172 Q150 170 150 150 Z" fill="'+c1+'"/>';
    s+='<path d="M165 150 Q205 125 235 143" stroke="'+c2+'" stroke-width="7" fill="none" stroke-linecap="round"/>';
    for(var j=0;j<6;j++){var an=(r%7+j*1.05),x=200+Math.cos(an)*70,y=150+Math.sin(an)*55;s+='<ellipse cx="'+x.toFixed(0)+'" cy="'+y.toFixed(0)+'" rx="10" ry="5" transform="rotate('+(j*37)+' '+x.toFixed(0)+' '+y.toFixed(0)+')" fill="'+c3+'"/>'}
  }
  return s+'</svg>';
}
function imgSrc(d){
  if(d.image&&d.image.src)return LOCALIMG[d.image.src]||d.image.src;
  var key=d.id+"|"+d.cat+"|"+(d.name||"")+"|"+(d.glass||"")+"|"+JSON.stringify(d.art||{});
  if(!artCache[key])artCache[key]="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(artSVG(d));
  return artCache[key];
}

/* ---------- tagging (works offline; Chinese and English recipes) ---------- */
var LEX=[
 [/\bchicken|thigh|breast\b|鸡/,"chicken"],[/\bbeef|steak|brisket|short rib|牛肉|牛排/,"beef"],[/\bpork|bacon|pancetta|guanciale|sausage|chorizo|prosciutto|ham\b|猪|培根|火腿/,"pork"],[/\blamb\b|羊/,"lamb"],
 [/salmon|三文鱼/,"salmon"],[/salmon|tuna|cod|halibut|trout|sea bass|anchov|sardine|fish|鱼/,"fish"],[/shrimp|prawn|scallop|clam|mussel|crab|lobster|squid|虾|扇贝|蛤|蟹/,"seafood"],[/\btofu|tempeh\b|豆腐/,"tofu"],
 [/pasta|rigatoni|spaghetti|linguine|penne|orecchiette|fettuccine|意面|意大利面/,"pasta"],[/noodle|ramen|udon|面条|拉面/,"noodles"],[/\brice\b|risotto|米饭|炒饭/,"rice"],[/curry|garam|turmeric|咖喱/,"curry"],[/soup|broth|stew|汤|炖/,"soup"],[/salad|沙拉/,"salad"],
 [/chili flake|chile|chili|jalape|gochujang|sriracha|cayenne|harissa|chipotle|辣/,"spicy"],[/miso|soy sauce|fish sauce|parmigiano|parmesan|anchov|mushroom|味噌|酱油|帕玛森|蘑菇/,"umami"],[/garlic|大蒜|蒜/,"garlic"],
 [/chocolate|cocoa|cacao|巧克力|可可/,"chocolate"],[/lemon|lime|orange|grapefruit|yuzu|citrus|柠檬|青柠|橙|西柚/,"citrus"],[/berr|strawberr|raspberr|blueberr|cherr|莓|樱桃/,"berries"],[/coffee|espresso|咖啡/,"coffee"],[/caramel|toffee|dulce|焦糖/,"caramel"],[/cream|custard|mascarpone|奶油/,"creamy"],
 [/cookie|饼干|曲奇/,"cookies"],[/\bcake\b|蛋糕/,"cake"],[/\bpie\b|tart|galette|派|挞/,"pie"],[/ice cream|gelato|sorbet|冰淇淋/,"frozen"],
 [/\bgin\b|金酒/,"gin"],[/\brum\b|朗姆/,"rum"],[/bourbon|波本/,"bourbon"],[/\brye\b/,"rye"],[/scotch|islay|single malt|威士忌/,"scotch"],[/tequila|龙舌兰/,"tequila"],[/mezcal/,"mezcal"],[/vodka|伏特加/,"vodka"],[/brandy|cognac|calvados|pisco|白兰地/,"brandy"],
 [/campari|aperol|amaro|fernet|cynar|nonino|montenegro/,"amaro"],[/vermouth|味美思/,"vermouth"],[/champagne|prosecco|sparkling|cava|香槟|起泡/,"sparkling"],[/bitters|苦精/,"bitters"],[/mint|basil|thyme|rosemary|sage|shiso|薄荷|罗勒|迷迭香/,"herbal"],[/ginger|姜/,"ginger"],[/honey|蜂蜜/,"honey"],[/egg white|aquafaba|蛋清/,"foamy"],[/islay|mezcal|smoked|smoky|烟熏/,"smoky"],[/watermelon|西瓜/,"watermelon"],[/elderflower|接骨木/,"elderflower"]
];
var MEAT=/chicken|beef|pork|lamb|bacon|pancetta|guanciale|sausage|chorizo|prosciutto|ham\b|salmon|tuna|cod|fish|anchov|shrimp|prawn|scallop|clam|mussel|crab|lobster|squid|halibut|trout|sardine|duck|turkey|veal|gelatin|鸡|牛|猪|羊|鱼|虾|蟹|鸭|培根|火腿|肉/;
function localTags(d){
  var txt=((d.name||"")+" \n"+(d.ingredients||[]).join("\n")+"\n"+(d.steps||[]).join("\n")).toLowerCase();
  var out=[];
  LEX.forEach(function(p){if(p[0].test(txt)&&out.indexOf(p[1])<0)out.push(p[1])});
  if(d.cat==="meal"){if(!MEAT.test(txt))out.push("vegetarian");var m=/(\d+)\s*min/.exec(d.time||"");if(m&&+m[1]<=30&&!/hr|hour/.test(d.time))out.push("weeknight")}
  if(d.cat==="cocktail"){var me=((d.method||"")+" "+(d.steps||[]).join(" ")).toLowerCase();if(/shake|摇/.test(me))out.push("shaken");else if(/stir|搅拌/.test(me))out.push("stirred");if(/lemon|lime|柠檬/.test(txt)&&/syrup|honey|agave|糖浆/.test(txt))out.push("sour")}
  return out.slice(0,6);
}

/* ---------- optional AI (your own Claude API key, kept on this device) ---------- */
function claude(prompt,model,maxTokens){
  return fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{
    "content-type":"application/json","x-api-key":aiKey(),"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
    body:JSON.stringify({model:model,max_tokens:maxTokens,messages:[{role:"user",content:prompt}]})
  }).then(function(r){return r.json().then(function(j){
    if(!r.ok)throw{message:r.status===401?"Your Claude API key was rejected. Check it in Settings.":((j&&j.error&&j.error.message)||"The AI request failed.")};
    return (j.content||[]).map(function(c){return c.text||""}).join("");
  })},function(){throw{message:"Couldn't reach Claude. Check your connection."}});
}
function parseJSON(t){try{return JSON.parse(t)}catch(e){}var a=t.indexOf("{"),b=t.lastIndexOf("}");if(a>=0&&b>a){try{return JSON.parse(t.slice(a,b+1))}catch(e){}}return null}
function aiTagsAndTaste(d){
  var vocab=Object.keys(allTags()).slice(0,80).join(", ");
  var wantTaste=d.cat==="cocktail"&&!(d.taste||"").trim();
  var prompt="You tag recipes in a personal recipe collection.\n"+
   "Return ONLY JSON: {\"tags\": [3 to 6 short lowercase English tags, hyphenated if multi-word]"+(wantTaste?", \"taste\": \"one sentence, max 14 words, describing how the drink tastes\"":"")+"}.\n"+
   "Tags should help find the dish later: main ingredient or base spirit, cuisine, flavor profile, occasion or technique. Reuse these existing tags when they fit: "+(vocab||"(none yet)")+".\n\n"+
   "Category: "+catOf(d.cat).one+"\nName: "+d.name+"\n"+(d.glass?"Glass: "+d.glass+"\n":"")+(d.method?"Method: "+d.method+"\n":"")+
   "Ingredients:\n"+(d.ingredients||[]).join("\n").slice(0,2500)+"\nSteps:\n"+(d.steps||[]).join("\n").slice(0,2500);
  return claude(prompt,MODEL_QUICK,300).then(function(t){
    var res=parseJSON(t)||{};
    var tags=(Array.isArray(res.tags)?res.tags:[]).map(normTag).filter(Boolean);
    return {tags:tags.slice(0,6),taste:wantTaste&&typeof res.taste==="string"?res.taste.trim().slice(0,160):""};
  });
}
function sanitizeSVG(t){
  var a=t.indexOf("<svg"),b=t.lastIndexOf("</svg>");
  if(a<0||b<0)return null;
  var s=t.slice(a,b+6);
  s=s.replace(/<script[\s\S]*?<\/script>/gi,"").replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi,"").replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi,"")
     .replace(/(xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi,"").replace(/<image\b[^>]*\/?>(<\/image>)?/gi,"");
  if(!/xmlns=/.test(s))s=s.replace("<svg",'<svg xmlns="http://www.w3.org/2000/svg"');
  if(s.length>90000)return null;
  return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(s);
}
function generateArt(d){
  var prompt="Draw an appetizing flat editorial illustration of this "+catOf(d.cat).one.toLowerCase()+" for a restaurant menu.\n"+
   "Dish: "+d.name+"\n"+(d.glass?"Served in: "+d.glass+" glass\n":"")+(d.taste?"Taste: "+d.taste+"\n":"")+"Key ingredients: "+(d.ingredients||[]).slice(0,8).join("; ")+"\n\n"+
   "Rules: reply with ONLY one <svg> element, nothing else. viewBox=\"0 0 400 300\", width and height omitted. A solid soft background colour filling the frame, the dish centred, "+
   (d.cat==="cocktail"?"the correct glass shape with the drink's true colour and garnish, ":"three-quarter or top-down view on a plate or bowl, ")+
   "6 to 9 flat colours, simple geometric shapes with a few highlight shapes for depth, no text, no outlines thicker than 3px, no external references, no scripts, under 9000 characters.";
  return claude(prompt,MODEL_ART,8000).then(function(t){var src=sanitizeSVG(t||"");if(!src)throw{message:"The illustration came back unusable. Try again."};return src});
}

/* ---------- photo upload ---------- */
function readPhoto(file){
  return new Promise(function(res,rej){
    if(!file||!/^image\//.test(file.type)){rej({message:"Pick a JPEG, PNG or WebP image."});return}
    var url=URL.createObjectURL(file),img=new Image();
    img.onload=function(){
      var max=1100,w=img.naturalWidth,h=img.naturalHeight,sc=Math.min(1,max/Math.max(w,h));
      var c=document.createElement("canvas");c.width=Math.round(w*sc);c.height=Math.round(h*sc);
      c.getContext("2d").drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);
      res(c.toDataURL("image/jpeg",0.78));
    };
    img.onerror=function(){URL.revokeObjectURL(url);rej({message:"That file couldn't be opened as an image. iPhone HEIC photos may need converting to JPEG first."})};
    img.src=url;
  });
}

/* ---------- saving: drafts live on this device until published ---------- */
function save(msg){
  STATE.updatedAt=Date.now();
  return kv.set("draft",STATE).then(function(){render();if(msg)toast(msg)});
}
function discard(){
  STATE=clone(PUBLISHED);
  return kv.del("draft").then(function(){closeSheet();render();toast("Changes discarded")});
}

/* ---------- publishing to GitHub ---------- */
function b64utf8(s){var bytes=new TextEncoder().encode(s),bin="";for(var i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return btoa(bin)}
function dataUrlToB64(u){var i=u.indexOf(",");var meta=u.slice(5,i),body=u.slice(i+1);return /;base64/.test(meta)?body:b64utf8(decodeURIComponent(body))}
function ghFetch(path,opt){
  var g=gh();opt=opt||{};
  opt.headers=Object.assign({"Accept":"application/vnd.github+json","Authorization":"Bearer "+g.token,"X-GitHub-Api-Version":"2022-11-28"},opt.headers||{});
  opt.cache="no-store";
  return fetch("https://api.github.com/repos/"+encodeURIComponent(g.owner)+"/"+encodeURIComponent(g.repo)+path,opt).then(function(r){
    if(r.status===404&&opt.method!=="PUT")return null;
    return r.json().catch(function(){return{}}).then(function(j){
      if(!r.ok)throw{status:r.status,message:r.status===401?"GitHub rejected the token. Reconnect in Settings.":r.status===403?"The token can't write to this repository. Give it Contents: Read and write.":r.status===409?"GitHub reported a conflict. Try publishing again.":((j&&j.message)||"GitHub request failed ("+r.status+").")};
      return j;
    });
  },function(){throw{message:"Couldn't reach GitHub. Check your connection."}});
}
function ghGetFile(path){var g=gh();return ghFetch("/contents/"+path.split("/").map(encodeURIComponent).join("/")+"?ref="+encodeURIComponent(g.branch))}
function ghPutFile(path,b64,message){
  var g=gh();
  return ghGetFile(path).then(function(cur){
    var body={message:message,content:b64,branch:g.branch};if(cur&&cur.sha)body.sha=cur.sha;
    return ghFetch("/contents/"+path.split("/").map(encodeURIComponent).join("/"),{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  });
}
function publish(force){
  var g=gh();if(!g){showConnect();return}
  if(!navigator.onLine){toast("You're offline. Your changes are saved here; publish when you're back online.",true);return}
  var bar=document.querySelector("[data-act=publish]");if(bar){bar.disabled=true;bar.textContent="Publishing…"}
  var out=clone(STATE),uploads=[];
  // Check nobody published from another device since we loaded.
  ghGetFile("menu.json").then(function(cur){
    var remote=null;try{remote=cur&&cur.content?JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(cur.content.replace(/\n/g,"")),function(c){return c.charCodeAt(0)}))):null}catch(e){}
    if(!force&&remote&&(remote.updatedAt||0)>(PUBLISHED.updatedAt||0)){
      throw{conflict:true};
    }
    out.dishes.forEach(function(d){
      if(d.image&&/^data:/.test(d.image.src||"")){
        var svg=/^data:image\/svg/.test(d.image.src),name="images/"+d.id.replace(/[^a-z0-9-]/gi,"")+"-"+Date.now().toString(36)+(svg?".svg":".jpg");
        uploads.push({path:name,b64:dataUrlToB64(d.image.src),dish:d.name,src:d.image.src});
        d.image.src=name;
      }
    });
    var chain=Promise.resolve();
    uploads.forEach(function(u,i){chain=chain.then(function(){if(bar)bar.textContent="Uploading image "+(i+1)+" of "+uploads.length+"…";return ghPutFile(u.path,u.b64,"Add image for "+u.dish)})});
    return chain;
  }).then(function(){
    out.updatedAt=Date.now();
    if(bar)bar.textContent="Saving menu…";
    return ghPutFile("menu.json",b64utf8(JSON.stringify(out,null,1)+"\n"),"Update menu ("+out.dishes.length+" dishes)");
  }).then(function(){
    PUBLISHED=clone(out);STATE=clone(out);
    uploads.forEach(function(u){LOCALIMG[u.path]=u.src});
    var used={};STATE.dishes.forEach(function(d){if(d.image)used[d.image.src]=1});
    Object.keys(LOCALIMG).forEach(function(k){if(!used[k])delete LOCALIMG[k]});
    return Promise.all([kv.set("published",PUBLISHED),kv.del("draft"),kv.set("localImages",LOCALIMG)]);
  }).then(function(){
    render();toast("Published. The live menu updates in about a minute.");
  }).catch(function(e){
    render();
    if(e&&e.conflict){
      openSheet('<div class="sheet-body"><div class="form"><h2>The menu changed elsewhere</h2><p>Someone published a newer menu (maybe you, from another device) since this one loaded. Publishing now replaces it with the version on this device.</p><div class="actions"><button class="btn danger" data-act="publish-force">Replace it with mine</button><button class="btn" data-act="close">Cancel</button></div></div></div>',"Conflict");
      return;
    }
    toast((e&&e.message)||"Publishing failed. Try again.",true);
  });
}

/* ---------- rendering ---------- */
function matches(d,q){
  if(!q)return true;q=q.toLowerCase().replace(/^#/,"");
  if((d.name||"").toLowerCase().indexOf(q)>=0)return true;
  return (d.tags||[]).some(function(t){return t.indexOf(q)>=0});
}
function itemHTML(d,q){
  var tags=(d.tags||[]).map(function(t){return (q&&t.indexOf(q.toLowerCase().replace(/^#/,""))>=0)||t===ui.tag?"<b>"+esc(t)+"</b>":esc(t)}).join(" · ");
  var meta=metaFor(d);
  return '<button class="item" data-open="'+esc(d.id)+'">'+
    '<img class="thumb" alt="" loading="lazy" data-dish="'+esc(d.id)+'" src="'+esc(imgSrc(d))+'">'+
    '<span class="item-body"><span class="item-top"><span class="item-name">'+esc(d.name)+(d.sample&&ui.edit?'<span class="sample">sample</span>':'')+'</span>'+
    (meta?'<span class="leader" aria-hidden="true"></span><span class="item-meta">'+esc(meta)+'</span>':'')+'</span>'+
    (d.cat==="cocktail"&&d.taste?'<span class="taste" style="display:block">'+esc(d.taste)+'</span>':'')+
    (tags?'<span class="item-tags" style="display:block">'+tags+'</span>':'')+'</span></button>';
}
function render(){
  var q=ui.q.trim(), active=document.activeElement&&document.activeElement.id==="q", pos=active?document.activeElement.selectionStart:0;
  document.title=STATE.title||"The House Menu";
  var h='<header class="mast"><div class="eyebrow">'+esc(STATE.dishes.length)+' dishes &amp; drinks'+(cap.offline?'<span class="offline">offline</span>':'')+'</div><h1>'+esc(STATE.title||"The House Menu")+'</h1>'+
    (STATE.subtitle?'<p class="sub">'+esc(STATE.subtitle)+'</p>':'')+'<div class="flourish" aria-hidden="true"><span>&#10043;</span></div></header>';
  h+='<nav class="tabs" role="tablist">'+CATS.map(function(c){return '<button class="tab" role="tab" data-tab="'+c.k+'" aria-selected="'+(!q&&ui.tab===c.k)+'">'+c.label+'<span class="n">'+byCat(c.k).length+'</span></button>'}).join("")+'</nav>';
  h+='<div class="searchrow"><label class="search" for="q"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'+
     '<input id="q" type="search" placeholder="Search by name or tag" autocomplete="off" value="'+esc(ui.q)+'" aria-label="Search by name or tag"></label></div>';
  if(q){
    var any=false;
    CATS.forEach(function(c){
      var list=byCat(c.k).filter(function(d){return matches(d,q)});
      if(!list.length)return;any=true;
      h+='<div class="section-h"><h2>'+c.label+'</h2><span class="rule"></span><span class="count">'+list.length+' found</span></div><div class="menu">'+list.map(function(d){return itemHTML(d,q)}).join("")+'</div>';
    });
    if(!any)h+='<div class="empty"><strong>Nothing matches “'+esc(q)+'”</strong>Try a dish name, an ingredient tag like <em>gin</em>, or clear the search.</div>';
  }else{
    var list=byCat(ui.tab),tagCount={};
    list.forEach(function(d){(d.tags||[]).forEach(function(t){tagCount[t]=(tagCount[t]||0)+1})});
    var top=Object.keys(tagCount).sort(function(a,b){return tagCount[b]-tagCount[a]||a.localeCompare(b)}).slice(0,12);
    if(ui.tag&&top.indexOf(ui.tag)<0)top.unshift(ui.tag);
    if(top.length)h+='<div class="chips">'+top.map(function(t){return '<button class="chip'+(ui.tag===t?' on':'')+'" data-tag="'+esc(t)+'">'+esc(t)+(ui.tag===t?'<span class="x" aria-label="clear">×</span>':'')+'</button>'}).join("")+'</div>';
    var shown=ui.tag?list.filter(function(d){return (d.tags||[]).indexOf(ui.tag)>=0}):list;
    var c=catOf(ui.tab);
    if(!list.length)h+='<div class="empty"><strong>No '+c.label.toLowerCase()+' yet</strong>'+(ui.edit?'Use <em>Add dish</em> below to write the first one.':'Check back soon.')+'</div>';
    else h+='<div class="menu">'+shown.map(function(d){return itemHTML(d,"")}).join("")+'</div>';
  }
  h+='<div class="foot">'+esc(STATE.title||"The House Menu")+' · '+new Date().getFullYear()+(cap.canEdit?'':' · <button class="link" data-act="connect">Kitchen</button>')+'</div>';
  root.innerHTML=h;
  if(active){var qi=document.getElementById("q");qi.focus();try{qi.setSelectionRange(pos,pos)}catch(_){}}
  renderChrome();
}
function renderChrome(){
  var old=document.getElementById("chrome");if(old)old.remove();
  if(!cap.canEdit)return;
  var el=document.createElement("div");el.id="chrome";
  var pending=dirty();
  if(!ui.edit){el.innerHTML='<button class="edit-toggle" data-act="edit-on">Edit menu'+(pending?' ·  unpublished':'')+'</button>'}
  else{
    var samples=STATE.dishes.some(function(d){return d.sample});
    el.innerHTML='<div class="kitchen"><div class="in">'+
      (pending?'<div class="pub"><i class="dot"></i><span>Unpublished changes on this device</span><button class="kbtn" data-act="discard">Discard</button><button class="kbtn primary" data-act="publish">Publish</button></div>':'')+
      '<span class="label">Editing</span>'+
      '<button class="kbtn primary" data-act="add">Add dish</button><button class="kbtn" data-act="tags">Tags</button><button class="kbtn" data-act="settings">Settings</button>'+
      (samples?'<button class="kbtn" data-act="clear-samples">Remove samples</button>':'')+'<button class="kbtn" data-act="edit-off">Done</button></div></div>';
  }
  document.body.appendChild(el);
  document.body.style.paddingBottom=ui.edit?(pending?"170px":"120px"):"";
}

/* ---------- sheets ---------- */
function openSheet(inner,label){
  closeSheet(true);
  var s=document.createElement("div");s.className="scrim";s.id="scrim";
  s.innerHTML='<div class="sheet" role="dialog" aria-modal="true" aria-label="'+esc(label||"")+'"><button class="sheet-close" data-act="close" aria-label="Close">×</button>'+inner+'</div>';
  document.body.appendChild(s);document.body.style.overflow="hidden";
  var f=s.querySelector(".sheet-close");if(f)f.focus({preventScroll:true});
  return s;
}
function closeSheet(silent){
  var s=document.getElementById("scrim");if(s)s.remove();document.body.style.overflow="";
  if(!silent){ui.open=null;ui.sheet=null;setHash(catOf(ui.tab).hash)}
}
function setHash(h){try{history.replaceState(null,"","#"+h)}catch(e){}}

function showDish(id){
  var d=find(id);if(!d)return;
  ui.open=id;ui.sheet="dish";setHash(id);
  var c=catOf(d.cat),facts=[];
  if(d.cat==="cocktail"){if(d.glass)facts.push(["Glass",d.glass]);if(d.method)facts.push(["Method",d.method])}
  else{if(d.serves)facts.push([/^\D/.test(d.serves)?"Yield":"Serves",d.serves]);if(d.time)facts.push(["Time",d.time])}
  var showRecipe=ui.edit||cap.canEdit||STATE.guestRecipes!==false;
  var h='<img class="hero" alt="'+esc(d.name)+'" data-dish="'+esc(d.id)+'" src="'+esc(imgSrc(d))+'"><div class="sheet-body">'+
    '<div class="d-cat">'+c.one+(d.image&&d.image.kind==="ai"?' · illustrated by Claude':'')+'</div><h2 class="d-name">'+esc(d.name)+'</h2>'+
    (d.taste?'<p class="d-taste">'+esc(d.taste)+'</p>':'')+
    ((d.tags||[]).length?'<div class="d-tags">'+d.tags.map(function(t){return '<button class="chip" data-tagjump="'+esc(t)+'">'+esc(t)+'</button>'}).join("")+'</div>':'')+
    (facts.length?'<dl class="facts">'+facts.map(function(f){return '<div class="fact"><dt>'+f[0]+'</dt><dd>'+esc(f[1])+'</dd></div>'}).join("")+'</dl>':'');
  if(showRecipe){
    h+='<div class="recipe"><div><h3>'+(d.cat==="cocktail"?"Spec":"Ingredients")+'</h3><ul class="ing">'+(d.ingredients||[]).map(function(i){return '<li>'+esc(i)+'</li>'}).join("")+'</ul></div>'+
      '<div><h3>Method</h3><ol class="steps">'+(d.steps||[]).map(function(s){return '<li><span>'+rich(s)+'</span></li>'}).join("")+'</ol></div></div>'+
      (d.notes?'<div class="notes"><b>Kitchen note</b>'+esc(d.notes)+'</div>':'');
  }else h+='<p class="private">The recipe for this one stays in the kitchen.</p>';
  if(ui.edit){
    h+='<div class="actions"><button class="btn primary" data-act="edit-dish" data-id="'+esc(d.id)+'">Edit</button>'+
      (hasAI()?'<button class="btn" data-act="gen-art" data-id="'+esc(d.id)+'">'+(d.image&&d.image.kind==="ai"?"New illustration":"Illustrate with AI")+'</button>':'')+
      '<label class="btn" for="photo-'+esc(d.id)+'">Upload photo</label><input id="photo-'+esc(d.id)+'" type="file" accept="image/*" hidden data-photo="'+esc(d.id)+'">'+
      (d.image?'<button class="btn" data-act="rm-img" data-id="'+esc(d.id)+'">Remove image</button>':'')+
      '<button class="btn danger" data-act="del" data-id="'+esc(d.id)+'">Delete</button></div><div class="status" id="dstatus" role="status"></div><div id="dconfirm"></div>';
  }
  h+='</div>';
  openSheet(h,d.name);
}

/* editor */
var draft=null;
function editDish(id){
  var d=id?find(id):null;
  draft=d?clone(d):{id:uid(),cat:ui.tab,name:"",taste:"",tags:[],ingredients:[],steps:[],notes:"",serves:"",time:"",glass:"",method:"",image:null};
  draft._autotag=!d; ui.sheet="edit";
  renderEditor(!d);
}
function renderEditor(isNew){
  var d=draft,ck=d.cat==="cocktail";
  var h='<div class="sheet-body"><form class="form" id="dishform" novalidate><h2>'+(isNew?"Add a dish":"Edit dish")+'</h2>'+
   '<div class="field"><span class="lab">Section</span><div class="seg" role="group">'+CATS.map(function(c){return '<button type="button" data-cat="'+c.k+'" aria-pressed="'+(d.cat===c.k)+'">'+c.one+'</button>'}).join("")+'</div></div>'+
   '<div class="field"><label for="f-name">Name</label><input class="inp" id="f-name" required value="'+esc(d.name)+'" placeholder="'+(ck?"e.g. Last Word":"e.g. Short rib ragù")+'"></div>'+
   (ck?'<div class="field"><label for="f-taste">How it tastes</label><input class="inp" id="f-taste" value="'+esc(d.taste||"")+'" maxlength="160" placeholder="'+(hasAI()?"Leave blank and it will be written for you":"One short line, e.g. Bright, tart and herbal")+'"><span class="hint">Shown under the name on the menu.</span></div>'+
       '<div class="row2"><div class="field"><label for="f-glass">Glass</label><input class="inp" id="f-glass" list="glasses" value="'+esc(d.glass||"")+'" placeholder="Coupe"><datalist id="glasses"><option>Coupe</option><option>Nick &amp; Nora</option><option>Rocks</option><option>Highball</option><option>Collins</option><option>Martini</option><option>Flute</option><option>Wine glass</option></datalist></div>'+
       '<div class="field"><label for="f-method">Method</label><input class="inp" id="f-method" list="methods" value="'+esc(d.method||"")+'" placeholder="Shaken"><datalist id="methods"><option>Shaken</option><option>Stirred</option><option>Built</option><option>Blended</option><option>Swizzled</option></datalist></div></div>'
      :'<div class="row2"><div class="field"><label for="f-serves">Serves</label><input class="inp" id="f-serves" value="'+esc(d.serves||"")+'" placeholder="4"></div><div class="field"><label for="f-time">Time</label><input class="inp" id="f-time" value="'+esc(d.time||"")+'" placeholder="45 min"></div></div>')+
   '<div class="field"><label for="f-ing">'+(ck?"Spec":"Ingredients")+'</label><textarea class="inp" id="f-ing" placeholder="One per line'+(ck?'\n60 ml gin\n22.5 ml lime juice':'\n2 cups flour\n1 tsp salt')+'">'+esc((d.ingredients||[]).join("\n"))+'</textarea></div>'+
   '<div class="field"><label for="f-steps">Method</label><textarea class="inp" id="f-steps" placeholder="One step per line">'+esc((d.steps||[]).join("\n"))+'</textarea><span class="hint">Wrap amounts in *asterisks* to show them in bold.</span></div>'+
   '<div class="field"><label for="f-notes">Kitchen note</label><textarea class="inp" id="f-notes" style="min-height:70px" placeholder="Optional">'+esc(d.notes||"")+'</textarea></div>'+
   '<div class="field"><span class="lab">Tags</span><div class="tagbox" id="tagbox">'+tagChips()+'<input id="f-tag" placeholder="Add a tag and press Enter" autocomplete="off" list="alltags"></div>'+
     '<datalist id="alltags">'+Object.keys(allTags()).sort().map(function(t){return '<option value="'+esc(t)+'">'}).join("")+'</datalist>'+
     '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button type="button" class="btn small" data-act="suggest">'+(hasAI()?"Suggest tags with AI":"Suggest tags")+'</button><span class="hint">'+(d._autotag?"Tags are created automatically when you save if you leave this empty.":"")+'</span></div></div>'+
   '<div class="field"><span class="lab">Image</span><div class="imgedit"><img id="f-img" alt="" src="'+esc(imgSrc(d))+'"><div class="col">'+
     '<label class="btn small" for="f-photo">Upload photo</label><input id="f-photo" type="file" accept="image/*" hidden>'+
     (hasAI()?'<button type="button" class="btn small" data-act="f-gen">Illustrate with AI</button>':'')+
     (d.image?'<button type="button" class="btn small" data-act="f-rmimg">Use default drawing</button>':'')+'</div></div></div>'+
   '<div class="status" id="fstatus" role="status"></div>'+
   '<div class="actions" style="margin-top:4px"><button type="submit" class="btn primary">Save to menu</button><button type="button" class="btn" data-act="cancel-edit">Cancel</button></div>'+
   '</form></div>';
  openSheet(h,isNew?"Add a dish":"Edit dish");
}
function tagChips(){return (draft.tags||[]).map(function(t){return '<button type="button" class="chip" data-rmtag="'+esc(t)+'">'+esc(t)+'<span class="x">×</span></button>'}).join("")}
function refreshTagbox(){var tb=document.getElementById("tagbox");if(!tb)return;var inp=document.getElementById("f-tag");tb.querySelectorAll(".chip").forEach(function(c){c.remove()});inp.insertAdjacentHTML("beforebegin",tagChips())}
function readForm(){
  var g=function(id){var e=document.getElementById(id);return e?e.value:undefined};
  draft.name=(g("f-name")||"").trim();
  if(g("f-taste")!==undefined)draft.taste=g("f-taste").trim();
  if(g("f-glass")!==undefined)draft.glass=g("f-glass").trim();
  if(g("f-method")!==undefined)draft.method=g("f-method").trim();
  if(g("f-serves")!==undefined)draft.serves=g("f-serves").trim();
  if(g("f-time")!==undefined)draft.time=g("f-time").trim();
  draft.ingredients=(g("f-ing")||"").split("\n").map(function(s){return s.trim()}).filter(Boolean);
  draft.steps=(g("f-steps")||"").split("\n").map(function(s){return s.replace(/^\s*\d+[.)]\s*/,"").trim()}).filter(Boolean);
  draft.notes=(g("f-notes")||"").trim();
  var pending=normTag(g("f-tag"));if(pending&&draft.tags.indexOf(pending)<0)draft.tags.push(pending);
}
function fstatus(msg,err){var s=document.getElementById("fstatus")||document.getElementById("dstatus");if(s){s.textContent=msg||"";s.className="status"+(err?" err":"")}else if(msg)toast(msg,err)}
function submitDish(){
  readForm();
  if(!draft.name){fstatus("Give the dish a name first.",true);document.getElementById("f-name").focus();return}
  var chain=Promise.resolve();
  var needTags=!draft.tags.length, needTaste=draft.cat==="cocktail"&&!draft.taste;
  if((needTags||needTaste)&&hasAI()&&navigator.onLine){
    fstatus(needTags?"Creating tags…":"Writing the taste line…");
    chain=aiTagsAndTaste(draft).then(function(r){if(needTags)draft.tags=r.tags.length?r.tags:localTags(draft);if(needTaste&&r.taste)draft.taste=r.taste})
      .catch(function(){if(needTags)draft.tags=localTags(draft)});
  }else if(needTags){draft.tags=localTags(draft)}
  chain.then(function(){
    var d=clone(draft);delete d._autotag;delete d.sample;
    if(!d.art)d.art={hue:hash(d.name)%360};
    var i=STATE.dishes.findIndex(function(x){return x.id===d.id});
    if(i>=0)STATE.dishes[i]=d;else STATE.dishes.push(d);
    ui.tab=d.cat;ui.q="";ui.tag="";
    return save("Saved "+d.name).then(function(){showDish(d.id)});
  }).catch(function(e){fstatus(e.message||"Saving failed.",true)});
}

/* tags manager */
var tagEdits=null;
function showTags(){
  var m=allTags(),keys=Object.keys(m).sort();
  tagEdits={};keys.forEach(function(k){tagEdits[k]={to:k,del:false}});
  ui.sheet="tags";
  var h='<div class="sheet-body"><div class="form"><h2>Tags</h2><p class="hint" style="margin:0;color:var(--muted)">Rename a tag to change it everywhere. Rename it to an existing tag to merge the two.</p><div id="tagrows">'+
    (keys.length?keys.map(function(k){return '<div class="tagrow" data-row="'+esc(k)+'"><input class="inp" aria-label="Tag '+esc(k)+'" data-rename="'+esc(k)+'" value="'+esc(k)+'"><span class="cnt">'+m[k]+'</span><button class="btn small danger" data-deltag="'+esc(k)+'">Remove</button></div>'}).join(""):'<p class="hint">No tags yet.</p>')+
    '</div><div class="status" id="fstatus" role="status"></div><div class="actions"><button class="btn primary" data-act="save-tags">Save tag changes</button><button class="btn" data-act="close">Cancel</button></div></div></div>';
  openSheet(h,"Tags");
}
function applyTags(){
  var changed=false;
  STATE.dishes.forEach(function(d){
    var out=[];
    (d.tags||[]).forEach(function(t){var e=tagEdits[t];if(!e){out.push(t);return}if(e.del){changed=true;return}var n=normTag(e.to);if(!n){changed=true;return}if(n!==t)changed=true;if(out.indexOf(n)<0)out.push(n)});
    d.tags=out;
  });
  if(!changed){closeSheet();return}
  if(ui.tag&&tagEdits[ui.tag])ui.tag="";
  closeSheet();save("Tags updated");
}

/* connect (owner sign-in) and settings */
function connectFields(){
  var g=gh()||{},guess=guessRepo();
  return '<div class="row2"><div class="field"><label for="g-owner">GitHub user</label><input class="inp" id="g-owner" autocomplete="off" autocapitalize="off" value="'+esc(g.owner||guess.owner)+'" placeholder="your-username"></div>'+
    '<div class="field"><label for="g-repo">Repository</label><input class="inp" id="g-repo" autocomplete="off" autocapitalize="off" value="'+esc(g.repo||guess.repo)+'" placeholder="house-menu"></div></div>'+
    '<div class="row2"><div class="field"><label for="g-branch">Branch</label><input class="inp" id="g-branch" autocomplete="off" autocapitalize="off" value="'+esc(g.branch||"main")+'"></div>'+
    '<div class="field"><label for="g-token">Access token</label><input class="inp" id="g-token" type="password" autocomplete="off" value="'+esc(g.token||"")+'" placeholder="github_pat_…"></div></div>';
}
function showConnect(){
  ui.sheet="connect";
  openSheet('<div class="sheet-body"><form class="form" id="connectform"><h2>Kitchen sign-in</h2>'+
    '<p style="margin:0;color:var(--muted)">Connect this device to the menu\'s GitHub repository to edit and publish. The token stays on this device and is never published.</p>'+
    connectFields()+'<span class="hint">Use a fine-grained token limited to this one repository, with <b>Contents: Read and write</b>. Setup steps are in the README.</span>'+
    '<div class="status" id="fstatus" role="status"></div><div class="actions"><button class="btn primary" type="submit">Connect</button><button class="btn" type="button" data-act="close">Cancel</button></div></form></div>',"Kitchen sign-in");
}
function readConnect(){
  return{owner:document.getElementById("g-owner").value.trim(),repo:document.getElementById("g-repo").value.trim(),branch:document.getElementById("g-branch").value.trim()||"main",token:document.getElementById("g-token").value.trim()};
}
function verifyAndStore(g){
  if(!g.owner||!g.repo||!g.token)return Promise.reject({message:"Fill in the user, repository and token."});
  return fetch("https://api.github.com/repos/"+encodeURIComponent(g.owner)+"/"+encodeURIComponent(g.repo),{cache:"no-store",headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+g.token}})
    .then(function(r){return r.json().then(function(j){
      if(r.status===401)throw{message:"GitHub rejected that token."};
      if(r.status===404)throw{message:"Couldn't find "+g.owner+"/"+g.repo+" with that token. Check the names and that the token includes this repository."};
      if(!r.ok)throw{message:(j&&j.message)||"GitHub check failed."};
      if(j.permissions&&!j.permissions.push)throw{message:"That token can read the repository but not write to it."};
      ls("hm-gh",JSON.stringify(g));return g;
    })},function(e){if(e&&e.message)throw e;throw{message:"Couldn't reach GitHub. Check your connection."}});
}
function showSettings(){
  ui.sheet="settings";
  var size=new Blob([JSON.stringify(STATE)]).size;
  var h='<div class="sheet-body"><form class="form" id="setform"><h2>Settings</h2>'+
   '<div class="field"><label for="s-title">Menu name</label><input class="inp" id="s-title" value="'+esc(STATE.title||"")+'"></div>'+
   '<div class="field"><label for="s-sub">Line under the name</label><input class="inp" id="s-sub" value="'+esc(STATE.subtitle||"")+'"></div>'+
   '<label class="switch" for="s-guest"><input type="checkbox" id="s-guest"'+(STATE.guestRecipes!==false?" checked":"")+'> Guests can open recipes (off: they see the menu only)</label>'+
   '<div class="fieldset"><h3>GitHub</h3>'+connectFields()+'</div>'+
   '<div class="fieldset"><h3>AI illustrations and tags (optional)</h3><p>Add your own Claude API key from console.anthropic.com to draw dishes, write cocktail taste lines and suggest tags. It stays on this device and is billed to your API account.</p>'+
     '<div class="field"><label for="s-ai">Claude API key</label><input class="inp" id="s-ai" type="password" autocomplete="off" value="'+esc(aiKey())+'" placeholder="sk-ant-…"></div></div>'+
   '<div class="fieldset"><h3>Backup</h3><p>Menu data on this device: '+(size/1024).toFixed(0)+' KB.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn small" data-act="export">Download menu.json</button><button type="button" class="btn small danger" data-act="signout">Sign out of the kitchen</button></div></div>'+
   '<div class="status" id="fstatus" role="status"></div><div class="actions"><button class="btn primary" type="submit">Save settings</button><button class="btn" type="button" data-act="close">Cancel</button></div></form></div>';
  openSheet(h,"Settings");
}
function exportJSON(){
  var blob=new Blob([JSON.stringify(STATE,null,1)],{type:"application/json"}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download="menu.json";document.body.appendChild(a);a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1000);
}

/* ---------- events ---------- */
document.addEventListener("click",function(e){
  var t=e.target.closest("[data-open],[data-tab],[data-tag],[data-tagjump],[data-act],[data-cat],[data-rmtag],[data-deltag]");
  if(e.target.id==="scrim"){closeSheet();return}
  if(!t)return;
  if(t.dataset.open){showDish(t.dataset.open);return}
  if(t.dataset.tab){ui.tab=t.dataset.tab;ui.tag="";ui.q="";setHash(catOf(ui.tab).hash);render();return}
  if(t.dataset.tag!==undefined&&t.classList.contains("chip")&&!t.dataset.rmtag){ui.tag=ui.tag===t.dataset.tag?"":t.dataset.tag;render();return}
  if(t.dataset.tagjump){var d=find(ui.open);closeSheet();if(d)ui.tab=d.cat;ui.q="";ui.tag=t.dataset.tagjump;render();window.scrollTo({top:0});return}
  if(t.dataset.cat){readForm();draft.cat=t.dataset.cat;renderEditor(!find(draft.id));return}
  if(t.dataset.rmtag){draft.tags=draft.tags.filter(function(x){return x!==t.dataset.rmtag});refreshTagbox();return}
  if(t.dataset.deltag){var k=t.dataset.deltag,row=t.closest(".tagrow");tagEdits[k].del=!tagEdits[k].del;row.classList.toggle("gone",tagEdits[k].del);t.textContent=tagEdits[k].del?"Undo":"Remove";return}
  var a=t.dataset.act,id=t.dataset.id;
  if(a==="close"){closeSheet();return}
  if(a==="connect"){showConnect();return}
  if(a==="edit-on"){ui.edit=true;render();return}
  if(a==="edit-off"){ui.edit=false;render();return}
  if(a==="add"){editDish(null);return}
  if(a==="tags"){showTags();return}
  if(a==="settings"){showSettings();return}
  if(a==="publish"){publish(false);return}
  if(a==="publish-force"){closeSheet();publish(true);return}
  if(a==="discard"){openSheet('<div class="sheet-body"><div class="form"><h2>Discard your changes?</h2><p>This goes back to the published menu and removes the edits saved on this device.</p><div class="actions"><button class="btn danger" data-act="confirm-discard">Discard changes</button><button class="btn" data-act="close">Keep them</button></div></div></div>',"Discard");return}
  if(a==="confirm-discard"){discard();return}
  if(a==="export"){exportJSON();return}
  if(a==="signout"){ls("hm-gh",null);ls("hm-ai-key",null);cap.canEdit=false;ui.edit=false;closeSheet();render();toast("Signed out. Unpublished changes stay on this device.");return}
  if(a==="clear-samples"){
    var n=STATE.dishes.filter(function(d){return d.sample}).length;
    openSheet('<div class="sheet-body"><div class="form"><h2>Remove the samples?</h2><p>This removes the '+n+' sample dishes and keeps everything you added.</p><div class="actions"><button class="btn danger" data-act="confirm-clear">Remove '+n+' samples</button><button class="btn" data-act="close">Keep them</button></div></div></div>',"Remove samples");return}
  if(a==="confirm-clear"){STATE.dishes=STATE.dishes.filter(function(d){return !d.sample});closeSheet();save("Samples removed");return}
  if(a==="edit-dish"){editDish(id);return}
  if(a==="cancel-edit"){var back=draft&&find(draft.id);draft=null;if(back)showDish(back.id);else closeSheet();return}
  if(a==="del"){document.getElementById("dconfirm").innerHTML='<div class="confirm">Delete this dish for good? <button class="btn small danger" data-act="confirm-del" data-id="'+esc(id)+'">Delete</button><button class="btn small" data-act="no-del">Keep it</button></div>';return}
  if(a==="no-del"){document.getElementById("dconfirm").innerHTML="";return}
  if(a==="confirm-del"){var nm=(find(id)||{}).name;STATE.dishes=STATE.dishes.filter(function(d){return d.id!==id});closeSheet();save("Deleted "+nm);return}
  if(a==="rm-img"){find(id).image=null;save("Image removed").then(function(){showDish(id)});return}
  if(a==="gen-art"){var d2=find(id);t.disabled=true;fstatus("Illustrating "+d2.name+"… this takes 20–60 seconds.");
    generateArt(d2).then(function(src){d2.image={kind:"ai",src:src};return save("Illustration saved").then(function(){if(ui.open===id)showDish(id)})}).catch(function(e){t.disabled=false;fstatus(e.message||"The illustration failed. Try again.",true)});return}
  if(a==="f-gen"){readForm();if(!draft.name){fstatus("Name the dish first so it can be drawn.",true);return}t.disabled=true;fstatus("Illustrating… this takes 20–60 seconds.");
    generateArt(draft).then(function(src){draft.image={kind:"ai",src:src};document.getElementById("f-img").src=src;t.disabled=false;fstatus("Illustration ready. Save to keep it.")}).catch(function(e){t.disabled=false;fstatus(e.message||"The illustration failed. Try again.",true)});return}
  if(a==="f-rmimg"){readForm();draft.image=null;document.getElementById("f-img").src=imgSrc(draft);fstatus("Using the default drawing.");return}
  if(a==="suggest"){readForm();if(!draft.name){fstatus("Name the dish first.",true);return}
    var addLocal=function(msg){localTags(draft).forEach(function(x){if(draft.tags.indexOf(x)<0)draft.tags.push(x)});refreshTagbox();t.disabled=false;fstatus(msg)};
    if(hasAI()&&navigator.onLine){t.disabled=true;fstatus("Suggesting tags…");aiTagsAndTaste(draft).then(function(r){r.tags.forEach(function(x){if(draft.tags.indexOf(x)<0)draft.tags.push(x)});if(r.taste&&!draft.taste){draft.taste=r.taste;var ft=document.getElementById("f-taste");if(ft)ft.value=r.taste}refreshTagbox();t.disabled=false;fstatus("Tags added. Remove any you don't want.")}).catch(function(){addLocal("Added tags from the ingredients.")})}
    else addLocal("Added tags from the ingredients.");
    return}
  if(a==="save-tags"){applyTags();return}
});
document.addEventListener("input",function(e){
  if(e.target.id==="q"){ui.q=e.target.value;render()}
  if(e.target.dataset&&e.target.dataset.rename){tagEdits[e.target.dataset.rename].to=e.target.value}
});
document.addEventListener("keydown",function(e){
  if(e.key==="Escape"&&document.getElementById("scrim")){closeSheet();return}
  if(e.target.id==="f-tag"&&(e.key==="Enter"||e.key===",")){e.preventDefault();var v=normTag(e.target.value);if(v&&draft.tags.indexOf(v)<0)draft.tags.push(v);e.target.value="";refreshTagbox()}
});
document.addEventListener("submit",function(e){
  e.preventDefault();
  if(e.target.id==="dishform")submitDish();
  if(e.target.id==="connectform"){
    fstatus("Checking with GitHub…");
    verifyAndStore(readConnect()).then(function(){cap.canEdit=true;ui.edit=true;closeSheet();render();toast("Connected. You're in the kitchen.")}).catch(function(er){fstatus(er.message,true)});
  }
  if(e.target.id==="setform"){
    var g=readConnect(),prev=gh()||{},key=document.getElementById("s-ai").value.trim();
    var menuChanged=false,nt=document.getElementById("s-title").value.trim()||"The House Menu",ns=document.getElementById("s-sub").value.trim(),gr=document.getElementById("s-guest").checked;
    if(nt!==STATE.title||ns!==STATE.subtitle||gr!==(STATE.guestRecipes!==false)){STATE.title=nt;STATE.subtitle=ns;STATE.guestRecipes=gr;menuChanged=true}
    ls("hm-ai-key",key||null);
    var check=(g.owner!==prev.owner||g.repo!==prev.repo||g.branch!==prev.branch||g.token!==prev.token)?verifyAndStore(g):Promise.resolve();
    fstatus("Saving…");
    check.then(function(){closeSheet();return menuChanged?save("Settings saved"):(render(),toast("Settings saved"))}).catch(function(er){fstatus(er.message,true)});
  }
});
document.addEventListener("change",function(e){
  var f=e.target.files&&e.target.files[0];if(!f)return;
  if(e.target.id==="f-photo"){fstatus("Preparing photo…");readPhoto(f).then(function(src){draft.image={kind:"photo",src:src};document.getElementById("f-img").src=src;fstatus("Photo ready. Save to keep it.")}).catch(function(er){fstatus(er.message,true)});return}
  if(e.target.dataset.photo){var id=e.target.dataset.photo,d=find(id);fstatus("Preparing photo…");readPhoto(f).then(function(src){d.image={kind:"photo",src:src};return save("Photo saved").then(function(){showDish(id)})}).catch(function(er){fstatus(er.message,true)})}
});
document.addEventListener("error",function(e){
  var img=e.target;if(!img||img.tagName!=="IMG"||!img.dataset.dish)return;
  var d=find(img.dataset.dish);if(!d)return;
  var art=imgSrc({id:d.id,cat:d.cat,name:d.name,glass:d.glass,art:d.art});
  if(img.src===art)return;
  if(!img.dataset.retried&&/^images\//.test((d.image&&d.image.src)||"")){
    img.dataset.retried="1";img.src=art;
    setTimeout(function(){var probe=new Image();probe.onload=function(){if(img.isConnected)img.src=probe.src};probe.src=d.image.src+"?r="+Date.now()},20000);
  }else img.src=art;
},true);
window.addEventListener("online",function(){cap.offline=false;render()});
window.addEventListener("offline",function(){cap.offline=true;render()});

/* ---------- boot ---------- */
function boot(){
  var h="";try{h=decodeURIComponent((location.hash||"").slice(1))}catch(e){}
  cap.canEdit=!!gh();
  Promise.all([
    fetch("menu.json",{cache:"no-cache"}).then(function(r){if(!r.ok)throw 0;return r.json()}).catch(function(){return null}),
    kv.get("published"),kv.get("draft"),kv.get("localImages")
  ]).then(function(r){
    var server=r[0],local=r[1],dr=r[2];LOCALIMG=r[3]||{};
    // GitHub Pages can take a minute to serve a fresh publish; prefer the newer copy.
    PUBLISHED=server||local||clone(EMPTY);
    if(local&&server&&(local.updatedAt||0)>(server.updatedAt||0))PUBLISHED=local;
    if(!Array.isArray(PUBLISHED.dishes))PUBLISHED.dishes=[];
    STATE=clone(cap.canEdit&&dr?dr:PUBLISHED);
    if(server)kv.set("published",server.updatedAt>=((local&&local.updatedAt)||0)?server:local);
    CATS.forEach(function(c){if(c.hash===h)ui.tab=c.k});
    var d=h&&find(h);if(d){ui.tab=d.cat}
    render();
    if(d)showDish(d.id);
    if(!server&&!local)toast("Couldn't load the menu. Check your connection and reload.",true);
  });
}
boot();

if("serviceWorker" in navigator&&location.protocol!=="file:"){
  window.addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){})});
}
})();
