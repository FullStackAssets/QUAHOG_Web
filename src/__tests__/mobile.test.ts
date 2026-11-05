import { describe, it, expect } from "vitest";
import { FrameClock, mobileBudget } from "../mobile/profile";
import { requestLimit, trimCache } from "../mobile/requests";
import { releaseInput, setVirtualMove, setVirtualHold, virtualTap, isDown, consumeTap, moveAxis } from "../input";
import { FAST_TRAVEL } from "../places";
import { pushOutOfBuildings, setBuildingFootprints } from "../world/buildingAvoid";

describe("mobile resource policy", () => {
  it("caps a phone's pixel workload and default aerial fetch count", () => {
    const b = mobileBudget(0, true);
    expect(b.dpr).toBeLessThanOrEqual(1);
    expect((2*b.aerialRadius+1)**2).toBeLessThanOrEqual(9);
    expect(b.tileConcurrency).toBeLessThanOrEqual(2);
    expect(b.parkedCars+b.traffic).toBeLessThan(30);
    expect(b.shadows).toBe(false);
    expect(mobileBudget(2,true).dpr).toBeLessThan(mobileBudget(2,false).dpr);
  });
  it("renders about 30 frames from 120 display callbacks without speedup", () => {
    const c = new FrameClock(); let renders=0;
    for(let i=0;i<120;i++) if(c.next(i*1000/120,30)!==null) renders++;
    expect(renders).toBeGreaterThanOrEqual(29); expect(renders).toBeLessThanOrEqual(31);
    expect(c.time).toBeGreaterThan(.9); expect(c.time).toBeLessThan(1.01);
  });
  it("does not simulate a long Safari suspension", () => {
    const c = new FrameClock(); c.next(0,30); c.next(34,30); const time=c.time;
    c.suspend(); expect(c.next(300_000,30)).toBe(time);
    const next=c.next(300_034,30)!; expect(next-time).toBeLessThan(.05);
  });
  it("bounds old tile memory while retaining active collision data", () => {
    const cache=new Map(Array.from({length:90},(_,i)=>[String(i),i]));
    const keep=new Set(['0','1','2','89']); trimCache(cache,keep,40);
    expect(cache.size).toBe(40); for(const k of keep) expect(cache.has(k)).toBe(true);
  });
  it("limits parallel tile requests across overlapping batches, including a failure", async () => {
    const limit=requestLimit(2); let active=0, peak=0;
    const job=(i:number)=>limit(async()=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,1));active--;if(i===2)throw Error('offline');return i});
    const result=await Promise.allSettled(Array.from({length:12},(_,i)=>job(i)));
    expect(peak).toBe(2); expect(active).toBe(0); expect(result.filter(r=>r.status==='rejected')).toHaveLength(1);
  });
  it("clears movement and held actions on blur or suspension", () => {
    setVirtualMove(.8,.4);setVirtualHold('ShiftLeft',true);virtualTap('KeyE');releaseInput();
    expect(moveAxis()).toEqual({x:0,y:0});expect(isDown('ShiftLeft')).toBe(false);expect(consumeTap('KeyE')).toBe(false);
  });
});

describe("merged gameplay regressions", () => {
  it("places Bethel fast travel outside the chapel and tower", () => {
    const [x,z]=FAST_TRAVEL.find(p=>p.name==="Seamen's Bethel")!.pos;
    expect(x).toBeGreaterThan(-272.23+10.2+1);expect(z).toBe(106);
  });
  it("keeps kinematic pedestrians outside registered building walls", () => {
    setBuildingFootprints('test',[{footprint:[[0,0],[10,0],[10,10],[0,10]],height:8}]);
    const [x,z]=pushOutOfBuildings(5,-5,.45);
    expect(x<0||x>10||z>0||z< -10).toBe(true);
    setBuildingFootprints('test',[]);
    expect(pushOutOfBuildings(5,-5)).toEqual([5,-5]);
  });
});
