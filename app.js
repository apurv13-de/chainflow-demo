
const STORAGE_KEY="chainflow_ci2001_state_v1";
class Transaction{
  constructor(id,fee,size,urgent=false){this.id=id;this.fee=+fee;this.size=+size;this.urgent=urgent}
  get density(){return this.size>0?this.fee/this.size:0}
}
class Deque{
  constructor(a=[]){this.a=a}
  pushFront(x){this.a.unshift(x)} pushBack(x){this.a.push(x)}
  popFront(){return this.a.shift()} get size(){return this.a.length} items(){return [...this.a]}
}
class MaxPriorityQueue{
  constructor(a=[]){this.h=[];a.forEach(x=>this.push(x))}
  higher(a,b){return a.density>b.density}
  push(x){this.h.push(x);this.up(this.h.length-1)}
  pop(){if(!this.h.length)return null;const t=this.h[0],last=this.h.pop();if(this.h.length){this.h[0]=last;this.down(0)}return t}
  up(i){while(i){const p=Math.floor((i-1)/2);if(this.higher(this.h[p],this.h[i]))break;[this.h[p],this.h[i]]=[this.h[i],this.h[p]];i=p}}
  down(i){for(;;){let l=i*2+1,r=l+1,b=i;if(l<this.h.length&&this.higher(this.h[l],this.h[b]))b=l;if(r<this.h.length&&this.higher(this.h[r],this.h[b]))b=r;if(b===i)break;[this.h[b],this.h[i]]=[this.h[i],this.h[b]];i=b}}
  items(){return [...this.h].sort((a,b)=>b.density-a.density)} get size(){return this.h.length}
}
class Node{constructor(data){this.data=data;this.prev=null;this.next=null}}
class DoublyLinkedList{
 constructor(a=[]){this.head=null;this.tail=null;this.length=0;a.forEach(x=>this.append(x))}
 append(data){const n=new Node(data);if(!this.head)this.head=this.tail=n;else{n.prev=this.tail;this.tail.next=n;this.tail=n}this.length++}
 pop(){if(!this.tail)return null;const x=this.tail.data;this.tail=this.tail.prev;if(this.tail)this.tail.next=null;else this.head=null;this.length--;return x}
 items(){const a=[];let n=this.head;while(n){a.push(n.data);n=n.next}return a}
}
class Stack{constructor(a=[]){this.a=a}push(x){this.a.push(x)}pop(){return this.a.pop()}items(){return [...this.a]}get size(){return this.a.length}}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,"0")+Math.abs(s.length*2654435761).toString(16).slice(0,8)}
function freshState(){return{counter:1,buffer:[],pool:[],chain:[{index:0,txs:[],prev:"00000000",hash:"GENESIS"}],rollback:[]}}
function loadState(){try{const s=JSON.parse(localStorage.getItem(STORAGE_KEY));return s||freshState()}catch(e){return freshState()}}
function saveState(s){localStorage.setItem(STORAGE_KEY,JSON.stringify(s))}
let STATE=loadState();
function txFrom(x){return new Transaction(x.id,x.fee,x.size,x.urgent)}
function instances(){return{buffer:new Deque(STATE.buffer.map(txFrom)),pool:new MaxPriorityQueue(STATE.pool.map(txFrom)),chain:new DoublyLinkedList(STATE.chain),stack:new Stack(STATE.rollback)}}
function commit(buffer,pool,chain,stack){STATE.buffer=buffer.items();STATE.pool=pool.items();STATE.chain=chain.items();STATE.rollback=stack.items();saveState(STATE);renderAll()}
function toast(m){let el=document.getElementById("toast");if(!el)return;el.textContent=m;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),1800)}
function renderAll(){document.querySelectorAll("[data-buffer-count]").forEach(e=>e.textContent=STATE.buffer.length);document.querySelectorAll("[data-pool-count]").forEach(e=>e.textContent=STATE.pool.length);document.querySelectorAll("[data-block-count]").forEach(e=>e.textContent=STATE.chain.length);document.querySelectorAll("[data-chain-status]").forEach(e=>e.textContent="VALID");window.renderPage&&window.renderPage()}
function addTransaction(urgent=false){
 const id=(document.getElementById("txId")?.value.trim())||`TX${String(STATE.counter++).padStart(5,"0")}`;
 const fee=+(document.getElementById("txFee")?.value)||Math.floor(Math.random()*900)+100;
 const size=+(document.getElementById("txSize")?.value)||Math.floor(Math.random()*900)+100;
 const {buffer}=instances();const t=new Transaction(id,fee,size,urgent);urgent?buffer.pushFront(t):buffer.pushBack(t);commit(buffer,instances().pool,instances().chain,instances().stack);toast(id+" added to buffer")
}
function moveBuffer(){
 const {buffer,pool,chain,stack}=instances();if(!buffer.size){toast("Buffer is empty");return}
 while(buffer.size)pool.push(buffer.popFront());commit(buffer,pool,chain,stack);toast("Transactions moved to MemPool")
}
function mineBlock(){
 const {buffer,pool,chain,stack}=instances();if(!pool.size){toast("MemPool is empty");return}
 const capMB=Math.max(.01,Math.min(16,+(document.getElementById("capacityMB")?.value)||1));const capacity=Math.floor(capMB*1048576);
 const txs=[],selected=[];let total=0;
 while(pool.size&&txs.length<1000){const t=pool.pop();if(total+t.size<=capacity){txs.push(t);total+=t.size}else selected.push(t)}
 selected.forEach(x=>pool.push(x));
 const prev=chain.tail.data.hash,index=chain.length;
 const block={index,txs,prev,hash:hash(prev+txs.map(x=>x.id).join("")+Date.now()),capacity};
 chain.append(block);stack.push(block);commit(buffer,pool,chain,stack);toast(`Block #${index} built`)
}
function rollbackBlock(){
 const {buffer,pool,chain,stack}=instances();if(chain.length<=1){toast("Genesis cannot be rolled back");return}
 const b=chain.pop();if(stack.size)stack.pop();b.txs.forEach(x=>pool.push(txFrom(x)));commit(buffer,pool,chain,stack);toast(`Block #${b.index} rolled back`)
}
function binarySearch(id,a){a=[...a].sort((x,y)=>x.id.localeCompare(y.id));let l=0,r=a.length-1;while(l<=r){let m=(l+r)>>1;if(a[m].id===id)return a[m];if(a[m].id<id)l=m+1;else r=m-1}return null}
function sentinelSearch(id,a){a=[...a];const n=a.length;a.push(new Transaction(id,0,1));let i=0;while(a[i].id!==id)i++;return i<n?a[i]:null}
function quickSort(a){if(a.length<2)return a;const p=a[a.length>>1],l=[],e=[],r=[];for(const x of a)(x<p?l:x>p?r:e).push(x);return quickSort(l).concat(e,quickSort(r))}
function radixSort(a){let max=Math.max(...a,0);for(let exp=1;Math.floor(max/exp)>0;exp*=10){const out=new Array(a.length),c=Array(10).fill(0);for(const x of a)c[Math.floor(x/exp)%10]++;for(let i=1;i<10;i++)c[i]+=c[i-1];for(let i=a.length-1;i>=0;i--){const x=a[i],d=Math.floor(x/exp)%10;out[--c[d]]=x}a=out}return a}
function benchmark(){
 const out=[];for(const n of [100,1000,10000]){const a=Array.from({length:n},()=>Math.floor(Math.random()*100000));let t=performance.now();quickSort([...a]);const q=performance.now()-t;t=performance.now();radixSort([...a]);const r=performance.now()-t;out.push({n,q,r})}return out
}
function generateBatch(){
 const n=Math.max(1,Math.min(500,+(document.getElementById("batchSize")?.value)||25));const mode=document.getElementById("congestion")?.value||"medium";const {buffer,pool,chain,stack}=instances();
 for(let i=0;i<n;i++){const fee=Math.floor((mode==="high"?900:mode==="medium"?500:220)+Math.random()*(mode==="high"?2500:mode==="medium"?1300:500));const size=Math.floor(180+Math.random()*1500);const tx=new Transaction(`TX${String(STATE.counter++).padStart(5,"0")}`,fee,size,Math.random()<.12);tx.urgent?buffer.pushFront(tx):buffer.pushBack(tx)}
 commit(buffer,pool,chain,stack);toast(`${n} transactions generated · ${mode} congestion`)
}
function stepSimulation(){if(STATE.buffer.length)moveBuffer();else if(STATE.pool.length)mineBlock();else toast("No pending transactions to process")}
function exportSnapshot(){const payload={exportedAt:new Date().toISOString(),simulation:"ChainFlow local simulation",state:STATE};const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="chainflow-snapshot.json";a.click();URL.revokeObjectURL(url);toast("Snapshot export started")}
function resetProject(){localStorage.removeItem(STORAGE_KEY);STATE=freshState();saveState(STATE);renderAll();toast("Project reset")}
function startAmbient(){
 const c=document.getElementById("ambient");if(!c)return;
 const ctx=c.getContext("2d");if(!ctx)return;
 const reduced=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 let w=0,h=0,dpr=1,points=[],raf=0,last=0;
 const rand=(a,b)=>a+Math.random()*(b-a);
 function resize(){
  dpr=Math.min(window.devicePixelRatio||1,2);w=window.innerWidth;h=window.innerHeight;
  c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);c.style.width=w+"px";c.style.height=h+"px";
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const count=Math.min(90,Math.max(42,Math.floor(w*h/14500)));
  points=Array.from({length:count},(_,i)=>({x:rand(0,w),y:rand(0,h),vx:rand(-.16,.16),vy:rand(-.14,.14),r:rand(1.5,2.7),phase:rand(0,Math.PI*2),id:i}));
 }
 function draw(now){
  if(now-last<30){raf=requestAnimationFrame(draw);return}last=now;
  ctx.clearRect(0,0,w,h);
  const maxDist=Math.min(155,Math.max(105,w*.12));
  // Fine network links with a restrained teal/blue glow.
  for(let i=0;i<points.length;i++){
   const a=points[i];
   for(let j=i+1;j<points.length;j++){
    const b=points[j],dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy);
    if(dist<maxDist){const alpha=(1-dist/maxDist)*.30;
     ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
     ctx.strokeStyle=`rgba(55,132,157,${alpha})`;ctx.lineWidth=.95;ctx.shadowBlur=5;ctx.shadowColor="rgba(53,157,190,.24)";ctx.stroke();ctx.shadowBlur=0;
     // Small moving data packets glide over a subset of links.
     const phase=((now*.000045+(a.id*7+b.id*3)*.071)%1);
     if((a.id+b.id)%5===0&&dist>35){const px=a.x+dx*phase,py=a.y+dy*phase;
      ctx.beginPath();ctx.arc(px,py,2.15,0,Math.PI*2);ctx.shadowBlur=10;ctx.shadowColor="rgba(32,155,157,.8)";ctx.fillStyle="rgba(20,174,160,.82)";ctx.fill();ctx.shadowBlur=0;}
    }
   }
  }
  for(const p of points){
   if(!reduced){p.x+=p.vx;p.y+=p.vy;}
   if(p.x<-8)p.x=w+8;if(p.x>w+8)p.x=-8;if(p.y<-8)p.y=h+8;if(p.y>h+8)p.y=-8;
   const pulse=.7+.3*Math.sin(now*.0012+p.phase);
   ctx.beginPath();ctx.arc(p.x,p.y,p.r*pulse,0,Math.PI*2);
   ctx.shadowBlur=p.id%7===0?14:8;ctx.shadowColor=p.id%7===0?"rgba(30,190,153,.7)":"rgba(69,139,205,.58)";
   ctx.fillStyle=p.id%7===0?"rgba(20,171,139,.86)":"rgba(57,126,190,.72)";ctx.fill();ctx.shadowBlur=0;
  }
  // Faint linked-block motif in the upper-right; stays behind content.
  const bx=w*.79,by=h*.19,sz=18,drift=reduced?0:Math.sin(now*.00035)*5;
  ctx.save();ctx.translate(drift,0);ctx.lineWidth=1;ctx.strokeStyle="rgba(25,145,165,.30)";ctx.shadowBlur=8;ctx.shadowColor="rgba(25,145,165,.20)";
  for(let i=0;i<4;i++){
   const xx=bx+(i%2)*30,yy=by+Math.floor(i/2)*30;
   ctx.strokeRect(xx,yy,sz,sz);ctx.beginPath();ctx.moveTo(xx+sz,yy+sz/2);ctx.lineTo(xx+30,yy+sz/2);ctx.stroke();
  }
  ctx.restore();
  if(!reduced)raf=requestAnimationFrame(draw);
 }
 resize();window.addEventListener("resize",resize,{passive:true});
 if(reduced){draw(0)}else{raf=requestAnimationFrame(draw)}
}
document.addEventListener("DOMContentLoaded",()=>{startAmbient();renderAll()});
