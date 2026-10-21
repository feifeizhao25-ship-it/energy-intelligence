import { loadMember } from './load-member';
const originalFetch = global.fetch;
const member = {id:'owner',plan:'FREE',effectivePlan:'FREE',nextResetAt:'2026-10-22T00:00:00Z',dailyAiCalls:0,dailyResourceQueries:0,dailyCalculations:0,dailyPaperSearches:0,dailyDiagnoses:0,projectCount:0,paperCount:0,stationCount:0,folderCount:0,subscription:null};
afterEach(()=>{global.fetch=originalFetch;jest.useRealTimers();});
test('returns actual valid membership',async()=>{global.fetch=jest.fn().mockResolvedValue(Response.json({success:true,data:member}));expect(await loadMember('/test')).toEqual(member);});
test.each([
 [503,'<html>upstream failure</html>','暂时无法读取'],
 [401,'{}','登录已失效'],
 [200,'<html>bad gateway</html>','响应格式异常'],
 [200,'{"success":true}','不完整'],
 [200,JSON.stringify({success:false,data:member}),'不完整'],
 [200,JSON.stringify({success:true,data:{...member,effectivePlan:'FAKE'}}),'不完整'],
 [200,JSON.stringify({success:true,data:{...member,dailyAiCalls:-1}}),'不完整'],
])('rejects invalid response %s %s',async(status,body,error)=>{global.fetch=jest.fn().mockResolvedValue(new Response(body,{status}));await expect(loadMember('/test')).rejects.toThrow(error);});
test('offline errors are Chinese',async()=>{global.fetch=jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));await expect(loadMember('/test')).rejects.toThrow('网络连接失败');});
test('hung request times out and aborts underlying transport',async()=>{
 jest.useFakeTimers();let signal:AbortSignal;
 global.fetch=jest.fn((_url,options)=>new Promise((_resolve,reject)=>{signal=options!.signal as AbortSignal;signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')));}));
 const result=expect(loadMember('/test')).rejects.toThrow('读取超时');await jest.advanceTimersByTimeAsync(20000);await result;expect(signal!.aborted).toBe(true);
});
test('unmount cancellation stays silent for caller',async()=>{
 global.fetch=jest.fn((_url,options)=>new Promise((_resolve,reject)=>options!.signal!.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')))));
 const controller=new AbortController();const result=expect(loadMember('/test',controller.signal)).rejects.toMatchObject({name:'AbortError'});controller.abort();await result;
});
