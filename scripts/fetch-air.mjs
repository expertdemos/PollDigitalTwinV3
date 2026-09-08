/* Air-quality data agent. Reads cities.json, fetches Open-Meteo (CAMS) + weather,
   optional WAQI enrichment, writes data/<city>.json + data/index.json. Node 18+. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const WAQI_TOKEN = process.env.WAQI_TOKEN || "";
const AQ_VARS="pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide,european_aqi";
const HOURLY_VARS="pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide";
async function getJSON(url){const r=await fetch(url,{headers:{"User-Agent":"uet-air-agent/1.0"}});if(!r.ok)throw new Error("HTTP "+r.status+" for "+url);return r.json();}
const aqUrl=p=>`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${p.map(x=>x[0]).join(",")}&longitude=${p.map(x=>x[1]).join(",")}&current=${AQ_VARS}&timezone=auto`;
const hourlyUrl=c=>`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${c[0]}&longitude=${c[1]}&hourly=${HOURLY_VARS}&past_days=1&forecast_days=1&timezone=auto`;
const wxUrl=c=>`https://api.open-meteo.com/v1/forecast?latitude=${c[0]}&longitude=${c[1]}&current=wind_speed_10m,wind_direction_10m,temperature_2m,relative_humidity_2m&timezone=auto`;
const waqiUrl=c=>`https://api.waqi.info/feed/geo:${c[0]};${c[1]}/?token=${WAQI_TOKEN}`;
function normStations(city,aq){const arr=Array.isArray(aq)?aq:[aq];return city.points.map((pt,i)=>{const c=(arr[i]&&arr[i].current)||{};return{lat:pt[0],lon:pt[1],pm25:c.pm2_5??null,pm10:c.pm10??null,no2:c.nitrogen_dioxide??null,o3:c.ozone??null,so2:c.sulphur_dioxide??null,co:c.carbon_monoxide??null,european_aqi:c.european_aqi??null};});}
function normHourly(h){const x=h&&h.hourly;if(!x||!x.time)return null;return{time:x.time,pm25:x.pm2_5,pm10:x.pm10,no2:x.nitrogen_dioxide,o3:x.ozone,so2:x.sulphur_dioxide,co:x.carbon_monoxide};}
function normWeather(w){const c=(w&&w.current)||{};return{windDir:c.wind_direction_10m??null,windSpeed:c.wind_speed_10m!=null?Math.round(c.wind_speed_10m):null,temp:c.temperature_2m!=null?Math.round(c.temperature_2m):null,humidity:c.relative_humidity_2m!=null?Math.round(c.relative_humidity_2m):null};}
async function fetchCity(city){
  const out={id:city.id,name:city.name,country:city.country,standard:city.standard,center:city.center,fetchedAt:new Date().toISOString(),source:"open-meteo/cams",stations:[],hourly:null,weather:null,waqi:null,ok:false,error:null};
  try{
    const [aq,hourly,wx]=await Promise.all([getJSON(aqUrl(city.points)),getJSON(hourlyUrl(city.center)).catch(()=>null),getJSON(wxUrl(city.center)).catch(()=>null)]);
    out.stations=normStations(city,aq); out.hourly=hourly?normHourly(hourly):null; out.weather=wx?normWeather(wx):null;
    if(WAQI_TOKEN){try{const w=await getJSON(waqiUrl(city.center));if(w&&w.status==="ok"&&w.data){out.waqi={station:w.data.city&&w.data.city.name,aqi:w.data.aqi,pm25:w.data.iaqi&&w.data.iaqi.pm25&&w.data.iaqi.pm25.v,time:w.data.time&&w.data.time.iso};out.source="open-meteo/cams + waqi";}}catch(e){}}
    const good=out.stations.filter(s=>s.pm25!=null).length; out.ok=good>=Math.ceil(city.points.length/2); if(!out.ok)out.error="insufficient station data";
  }catch(e){out.error=String(e.message||e);}
  return out;
}
async function main(){
  const cfg=JSON.parse(await readFile(join(ROOT,"cities.json"),"utf8"));
  await mkdir(DATA_DIR,{recursive:true});
  const index={generatedAt:new Date().toISOString(),cities:[]};
  for(const city of cfg.cities){
    process.stdout.write("Fetching "+city.id+" … ");
    const data=await fetchCity(city);
    await writeFile(join(DATA_DIR,city.id+".json"),JSON.stringify(data,null,2));
    index.cities.push({id:city.id,name:city.name,country:city.country,ok:data.ok,error:data.error});
    console.log(data.ok?"ok":"FALLBACK ("+data.error+")");
  }
  await writeFile(join(DATA_DIR,"index.json"),JSON.stringify(index,null,2));
  const ok=index.cities.filter(c=>c.ok).length;
  console.log("\nDone. "+ok+"/"+index.cities.length+" cities fetched OK. Written to /data");
}
main().catch(e=>{console.error("Agent failed:",e);process.exit(1);});
