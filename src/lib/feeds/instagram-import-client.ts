import type { StoredExample } from "@/lib/generation/types";

export const IG_WINDOW_NAME = "style-transfer-instagram";
export const IG_RELAY_WINDOW_NAME = "style-transfer-ig-relay";
export const IG_IMPORT_RELAY_PATH = "/ig-import-relay.html";

type BookmarkletConfig = {
  relayUrl: string;
  relayWindowName: string;
  token: string;
  username: string;
  count: number;
};

export type InstagramImportStatus = {
  status: "pending" | "done" | "error" | "unknown";
  projectId?: string;
  examples: StoredExample[];
  error: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseStoredExamples(value: unknown): StoredExample[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const examples: StoredExample[] = [];
  for (const entry of value) {
    const record = asRecord(entry);
    if (
      !record ||
      typeof record.id !== "string" ||
      typeof record.name !== "string" ||
      typeof record.previewUrl !== "string"
    ) {
      continue;
    }
    examples.push({
      id: record.id,
      name: record.name,
      kind: "upload",
      previewUrl: record.previewUrl,
    });
  }
  return examples;
}

export function parseInstagramImportStatus(
  data: unknown,
): InstagramImportStatus {
  const record = asRecord(data);
  const status = record?.status;
  return {
    status:
      status === "pending" || status === "done" || status === "error"
        ? status
        : "unknown",
    projectId:
      typeof record?.projectId === "string" ? record.projectId : undefined,
    examples: parseStoredExamples(record?.examples),
    error: typeof record?.error === "string" ? record.error : null,
  };
}

export function instagramImportScript(config: BookmarkletConfig) {
  const c = JSON.stringify(config);
  return `(function(){
if(window.__stIgImport)return;
window.__stIgImport=1;
var c=${c};
var APP_ID="936619743392459";
var WALK_MAX_NODES=20000;
var WALK_MAX_DEPTH=12;
var WALK_MAX_FANOUT=2000;
var MAX_JSON_SCRIPTS=40;
var MAX_JSON_SCRIPT_CHARS=1500000;
var MAX_SCAN_CHARS=600000;
var MAX_HASH_CHARS=120000;
function done(){window.__stIgImport=0;}
function cookie(name){
  var m=document.cookie.match(new RegExp("(?:^|; )"+name+"=([^;]*)"));
  return m?decodeURIComponent(m[1]):"";
}
function claim(){
  try{return sessionStorage.getItem("www-claim-v2")||"0";}catch(e){return "0";}
}
function rememberClaim(value){
  if(!value)return;
  try{sessionStorage.setItem("www-claim-v2",value);}catch(e){}
}
function igHeaders(){
  return {
    "X-IG-App-ID":APP_ID,
    "X-Requested-With":"XMLHttpRequest",
    "X-CSRFToken":cookie("csrftoken"),
    "X-ASBD-ID":"129477",
    "X-IG-WWW-Claim":claim()
  };
}
function isCdnUrl(url){
  try{
    var u=new URL(url,location.href);
    if(u.protocol!=="https:")return false;
    var host=u.hostname.toLowerCase();
    return host==="cdninstagram.com"||host.endsWith(".cdninstagram.com")||host==="fbcdn.net"||host.endsWith(".fbcdn.net");
  }catch(e){return false;}
}
function cleanUrl(url){return String(url||"").replace(/&amp;/g,"&").trim();}
function pickCandidate(item){
  var cands=item&&item.image_versions2&&item.image_versions2.candidates;
  if(!cands||!cands.length)return "";
  var best=cands[0];
  for(var i=1;i<cands.length;i++){
    if((cands[i].width||0)*(cands[i].height||0)>(best.width||0)*(best.height||0))best=cands[i];
  }
  return cleanUrl((best&&best.url)||"");
}
function imagesFromRestItem(item){
  var out=[];
  if(!item||Number(item.media_type)===2)return out;
  var code=String(item.code||"");
  var slides=Array.isArray(item.carousel_media)?item.carousel_media:[item];
  for(var i=0;i<slides.length;i++){
    var slide=slides[i];
    if(!slide||Number(slide.media_type)===2)continue;
    var url=pickCandidate(slide);
    if(url&&isCdnUrl(url))out.push({code:code,url:url});
  }
  return out;
}
function imagesFromGraphqlNode(node){
  var out=[];
  if(!node||node.is_video)return out;
  var code=String(node.shortcode||node.code||"");
  var children=node.edge_sidecar_to_children&&node.edge_sidecar_to_children.edges;
  if(children&&children.length){
    for(var i=0;i<children.length;i++){
      var child=children[i]&&children[i].node;
      if(!child||child.is_video)continue;
      var childUrl=cleanUrl(child.display_url||pickCandidate(child));
      if(childUrl&&isCdnUrl(childUrl))out.push({code:code,url:childUrl});
    }
    return out;
  }
  var url=cleanUrl(node.display_url||pickCandidate(node));
  if(url&&isCdnUrl(url))out.push({code:code,url:url});
  return out;
}
function walkJson(root,visit){
  if(!root||typeof root!=="object")return;
  var stack=[[root,0]];
  var budget=WALK_MAX_NODES;
  var seen=null;
  try{seen=new Set();}catch(e){seen=null;}
  while(stack.length&&budget>0){
    budget-=1;
    var frame=stack.pop();
    var value=frame[0];
    var depth=frame[1];
    if(!value||typeof value!=="object")continue;
    if(seen){
      if(seen.has(value))continue;
      seen.add(value);
    }
    if(Array.isArray(value)){
      if(depth>=WALK_MAX_DEPTH)continue;
      for(var i=0;i<value.length&&i<WALK_MAX_FANOUT;i++){
        if(value[i]&&typeof value[i]==="object")stack.push([value[i],depth+1]);
      }
      continue;
    }
    visit(value);
    if(depth>=WALK_MAX_DEPTH)continue;
    var pushed=0;
    for(var k in value){
      if(pushed>=WALK_MAX_FANOUT)break;
      if(!Object.prototype.hasOwnProperty.call(value,k))continue;
      var child=value[k];
      if(child&&typeof child==="object"){
        stack.push([child,depth+1]);
        pushed+=1;
      }
    }
  }
}
function jsonScriptTexts(){
  var nodes=document.querySelectorAll('script[type="application/json"]');
  var out=[];
  for(var i=0;i<nodes.length&&out.length<MAX_JSON_SCRIPTS;i++){
    var text=nodes[i].textContent||"";
    if(!text||text.length>MAX_JSON_SCRIPT_CHARS)continue;
    out.push(text);
  }
  return out;
}
function fromProfileJson(json){
  var user=json&&json.data&&json.data.user;
  if(!user)return {id:"",images:[]};
  var images=[];
  var edges=((user.edge_owner_to_timeline_media)||{}).edges||[];
  for(var i=0;i<edges.length;i++)images=images.concat(imagesFromGraphqlNode(edges[i]&&edges[i].node));
  return {id:String(user.id||user.pk||""),images:images};
}
function fromDom(){
  var images=[];
  var nodes=document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
  for(var i=0;i<nodes.length;i++){
    var a=nodes[i];
    var href=a.href||"";
    if(/\\/reel\\//.test(href))continue;
    var m=href.match(/\\/p\\/([^/?#]+)/);
    var code=m?m[1]:"";
    var img=a.querySelector("img");
    var url="";
    if(img){
      var srcset=img.getAttribute("srcset")||"";
      if(srcset){
        var parts=srcset.split(",");
        url=cleanUrl(((parts[parts.length-1]||"").trim().split(" ")[0])||"");
      }
      url=url||cleanUrl(img.currentSrc||img.src||"");
    }
    if(code&&url&&isCdnUrl(url))images.push({code:code,url:url});
    else if(code)images.push({code:code,url:""});
  }
  return images;
}
function fromPageJson(){
  var images=[];
  function consider(obj){
    if(!obj||obj.is_video||Number(obj.media_type)===2)return;
    var code=obj.shortcode||obj.code;
    if(!code)return;
    var url=cleanUrl(obj.display_url||pickCandidate(obj));
    if(url&&isCdnUrl(url))images.push({code:String(code),url:url});
  }
  try{walkJson(window._sharedData,consider);}catch(e){}
  var texts=jsonScriptTexts();
  for(var i=0;i<texts.length;i++){
    try{walkJson(JSON.parse(texts[i]),consider);}catch(e){}
  }
  return images;
}
function scanText(){
  // Never serialize the whole document: an Instagram profile can be tens of
  // megabytes of innerHTML, which is enough to wedge the tab on its own.
  var parts=[];
  var total=0;
  try{
    var head=(document.head&&document.head.innerHTML)||"";
    parts.push(head.slice(0,MAX_SCAN_CHARS));
    total+=Math.min(head.length,MAX_SCAN_CHARS);
  }catch(e){}
  var scripts=document.querySelectorAll("script:not([src])");
  for(var i=0;i<scripts.length&&total<MAX_SCAN_CHARS;i++){
    var text=(scripts[i].textContent||"").slice(0,MAX_SCAN_CHARS-total);
    if(!text)continue;
    parts.push(text);
    total+=text.length;
  }
  return parts.join("\\n");
}
function userIdFromPage(){
  var html=scanText();
  var m=html.match(/profilePage_(\\d{5,})/);
  if(m)return m[1];
  m=html.match(/"profile_id"\\s*:\\s*"(\\d+)"/);
  if(m)return m[1];
  m=html.match(/instagram:\\/\\/user\\?[^"'<>]*user_id=(\\d+)/);
  if(m)return m[1];
  var found="";
  var uname=String(c.username||"").toLowerCase();
  var texts=jsonScriptTexts();
  for(var i=0;i<texts.length&&!found;i++){
    try{
      walkJson(JSON.parse(texts[i]),function(obj){
        if(found)return;
        var name=String(obj.username||obj.user_name||"").toLowerCase();
        var id=obj.id||obj.pk||obj.profile_id;
        if(name===uname&&id)found=String(id);
      });
    }catch(e){}
  }
  return found;
}
function ageGateVisible(){
  var text=((document.body&&document.body.innerText)||"").slice(0,MAX_SCAN_CHARS);
  return /restricted profile|you must be \\d+ years old|years old or over to see this profile|sensitive content/i.test(text);
}
function igGet(url){
  return fetch(url,{headers:igHeaders(),credentials:"include"}).then(function(r){
    rememberClaim(r.headers.get("x-ig-set-www-claim"));
    return r.json().catch(function(){return {};});
  });
}
function lookupUserId(){
  return igGet("/web/search/topsearch/?context=user&count=8&query="+encodeURIComponent(c.username)).then(function(j){
    var users=j.users||[];
    for(var i=0;i<users.length;i++){
      var u=users[i].user||users[i];
      if(u&&String(u.username||"").toLowerCase()===String(c.username).toLowerCase()){
        return String(u.pk||u.id||"");
      }
    }
    return "";
  }).catch(function(){return "";});
}
function feedImages(userId){
  if(!userId)return Promise.resolve([]);
  var count=String(Math.min(c.count*3,30));
  return igGet("/api/v1/feed/user/"+encodeURIComponent(userId)+"/?count="+count).then(function(feed){
    var items=feed.items||[];
    if(!items.length&&Array.isArray(feed.profile_grid_items))items=feed.profile_grid_items;
    var images=[];
    for(var i=0;i<items.length;i++)images=images.concat(imagesFromRestItem(items[i]));
    return images;
  }).catch(function(){return [];});
}
function enough(images){
  var n=0;
  for(var i=0;i<images.length;i++)if(images[i]&&images[i].url)n+=1;
  return n>=c.count;
}
function collect(){
  var collected=[];
  function add(items){collected=collected.concat(items||[]);}
  function fallback(){
    if(!enough(collected)){
      add(fromPageJson());
      add(fromDom());
    }
    return collected;
  }
  return igGet("/api/v1/users/web_profile_info/?username="+encodeURIComponent(c.username)).then(function(j){
    var parsed=fromProfileJson(j);
    add(parsed.images);
    if(enough(collected))return collected;
    var userId=parsed.id||userIdFromPage();
    function withId(id){
      if(!id)return Promise.resolve(fallback());
      return feedImages(id).then(function(items){add(items);return fallback();});
    }
    if(userId)return withId(userId);
    return lookupUserId().then(withId);
  }).catch(function(){return fallback();});
}
function normalize(items){
  var seenUrl={};
  var seenCode={};
  var out=[];
  for(var i=0;i<items.length;i++){
    var code=items[i]&&items[i].code?String(items[i].code):"";
    var url=items[i]&&items[i].url&&isCdnUrl(items[i].url)?items[i].url:"";
    if(!code&&!url)continue;
    if(url&&seenUrl[url])continue;
    if(!url&&code&&seenCode[code])continue;
    if(url)seenUrl[url]=1;
    if(code)seenCode[code]=1;
    out.push({code:code,url:url});
    if(out.length>=c.count)break;
  }
  return out;
}
function banner(text,tone){
  try{
    var id="st-ig-import-note";
    var old=document.getElementById(id);
    if(old&&old.parentNode)old.parentNode.removeChild(old);
    var box=document.createElement("div");
    box.id=id;
    box.textContent=text;
    box.style.cssText="position:fixed;z-index:2147483647;top:16px;right:16px;max-width:22rem;padding:12px 16px;border-radius:12px;font:14px/1.5 -apple-system,Segoe UI,sans-serif;color:#fff;box-shadow:0 6px 24px rgba(0,0,0,.35);background:"+(tone==="bad"?"#b4232a":tone==="ok"?"#1f7a3d":"#333");
    document.body.appendChild(box);
    setTimeout(function(){if(box.parentNode)box.parentNode.removeChild(box);},tone==="ok"?6000:12000);
  }catch(e){
    console.log("[style-transfer] "+text);
  }
}
function send(items){
  items=normalize(items);
  var withUrls=[];
  for(var i=0;i<items.length;i++)if(items[i].url)withUrls.push(items[i]);
  items=withUrls;
  if(!items.length){
    done();
    if(ageGateVisible())banner("Confirm the age warning on this profile, then run the import script again.","bad");
    else banner("No photo posts found. Log in to Instagram in this browser if the profile is private.","bad");
    return;
  }
  var codes=[];
  var urls=[];
  for(var i=0;i<items.length;i++){
    codes.push(items[i].code||"");
    urls.push(items[i].url);
  }
  // Instagram's Content-Security-Policy blocks any fetch to the app's origin
  // from this page, so the payload rides along in a navigation instead, which
  // CSP does not restrict. The relay tab is same-origin with the app and makes
  // the actual request from there.
  var payload={v:2,token:c.token,codes:codes,urls:urls};
  var hash=encodeURIComponent(JSON.stringify(payload));
  while(hash.length>MAX_HASH_CHARS&&urls.length>1){
    urls.pop();
    codes.pop();
    payload={v:2,token:c.token,codes:codes,urls:urls};
    hash=encodeURIComponent(JSON.stringify(payload));
  }
  // The per-run query string matters: reusing the relay window with only a new
  // fragment is a same-document navigation, so the relay script would not
  // re-run and a second import would silently do nothing.
  var run=String(Date.now())+"-"+Math.random().toString(16).slice(2);
  var target=c.relayUrl+"?r="+encodeURIComponent(run)+"#"+hash;
  var win=null;
  try{win=window.open(target,c.relayWindowName);}catch(e){win=null;}
  done();
  if(win)banner("Importing "+urls.length+" image"+(urls.length===1?"":"s")+". The images appear in your Style Transfer tab.","ok");
  else banner("Allow pop-ups for instagram.com and run this again so the import tab can open.","bad");
}
collect().then(send,function(){send(fromDom().concat(fromPageJson()));});
})();`;
}

export function instagramImportBookmarklet(config: BookmarkletConfig) {
  return `javascript:${encodeURIComponent(instagramImportScript(config))}`;
}
