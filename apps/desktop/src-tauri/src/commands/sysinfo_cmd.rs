use serde::Serialize;
use crate::commands::settings::load_settings;
use crate::ssh;

#[derive(Serialize, Clone)]
pub struct CpuInfo {
    pub name: String,
    pub usage: f32,
    pub frequency: u64,
    pub cores: Vec<f32>,
}

#[derive(Serialize, Clone)]
pub struct MemoryInfo {
    pub total_ram: u64,
    pub used_ram: u64,
    pub free_ram: u64,
    pub total_swap: u64,
    pub used_swap: u64,
}

#[derive(Serialize, Clone)]
pub struct GpuInfo {
    pub name: String,
    pub vram_total: u64,
    pub vram_used: u64,
    pub vram_free: u64,
    pub temperature: f32,
    pub utilization: u32,
    pub power_draw: f32,
    pub available: bool,
}

#[derive(Serialize, Clone)]
pub struct SystemMetrics {
    pub cpu: CpuInfo,
    pub memory: MemoryInfo,
    pub gpu: GpuInfo,
    pub cpu_temp: f32,
    pub uptime: u64,
    pub hostname: String,
}

const METRICS_SCRIPT: &str = r#"python3 -c "
import json,os,time,subprocess
s1=[l.strip() for l in open('/proc/stat') if l.startswith('cpu')]
time.sleep(0.5)
s2=[l.strip() for l in open('/proc/stat') if l.startswith('cpu')]
cores=[]
cpu_total=0
for l1,l2 in zip(s1,s2):
    p1=list(map(int,l1.split()[1:]))
    p2=list(map(int,l2.split()[1:]))
    d=[b-a for a,b in zip(p1,p2)]
    t=sum(d)
    i=d[3] if len(d)>3 else 0
    pct=round((t-i)/t*100,1) if t>0 else 0
    if l1.startswith('cpu '):
        cpu_total=pct
    else:
        cores.append(pct)
ci=open('/proc/cpuinfo').read()
cn=[l.split(':')[1].strip() for l in ci.split('\n') if 'model name' in l]
cf=[l.split(':')[1].strip().split('.')[0] for l in ci.split('\n') if 'cpu MHz' in l]
mi={}
for l in open('/proc/meminfo'):
    p=l.split()
    k=p[0].rstrip(':')
    if k in ('MemTotal','MemFree','MemAvailable','SwapTotal','SwapFree','Buffers','Cached'):
        mi[k]=int(p[1])*1024
try:
    g=subprocess.check_output(['nvidia-smi','--query-gpu=name,memory.total,memory.used,memory.free,temperature.gpu,utilization.gpu,power.draw','--format=csv,noheader,nounits'],text=True).strip().split(',')
    gpu={'name':g[0].strip(),'vram_total':int(g[1]),'vram_used':int(g[2]),'vram_free':int(g[3]),'temperature':float(g[4]),'utilization':int(g[5]),'power_draw':float(g[6]),'available':True}
except:
    gpu={'name':'N/A','vram_total':0,'vram_used':0,'vram_free':0,'temperature':0,'utilization':0,'power_draw':0,'available':False}
try:
    ct=0
    for f in os.listdir('/sys/class/thermal/'):
        if f.startswith('thermal_zone'):
            t=int(open(f'/sys/class/thermal/{f}/temp').read().strip())
            if t>ct: ct=t
    ct=round(ct/1000,1)
except:
    ct=0
r={'cpu':{'name':cn[0] if cn else 'Unknown','usage':cpu_total,'frequency':int(cf[0]) if cf else 0,'cores':cores},'memory':{'total_ram':mi.get('MemTotal',0),'used_ram':mi.get('MemTotal',0)-mi.get('MemAvailable',mi.get('MemFree',0)),'free_ram':mi.get('MemAvailable',mi.get('MemFree',0)),'total_swap':mi.get('SwapTotal',0),'used_swap':mi.get('SwapTotal',0)-mi.get('SwapFree',0)},'gpu':gpu,'cpu_temp':ct,'uptime':int(float(open('/proc/uptime').read().split()[0])),'hostname':os.uname().nodename}
print(json.dumps(r))
"
"#;

#[tauri::command]
pub async fn get_system_metrics() -> Result<SystemMetrics, String> {
    let s = load_settings();
    let key = ssh::key_opt(&s.ssh_key_path);

    let output = ssh::ssh_exec(&s.host, &s.ssh_user, s.ssh_port, &key, METRICS_SCRIPT).await?;

    let json: serde_json::Value = serde_json::from_str(output.trim())
        .map_err(|e| format!("Failed to parse metrics JSON: {} — raw: {}", e, output.trim()))?;

    let cpu = &json["cpu"];
    let mem = &json["memory"];
    let gpu = &json["gpu"];

    Ok(SystemMetrics {
        cpu: CpuInfo {
            name: cpu["name"].as_str().unwrap_or("Unknown").to_string(),
            usage: cpu["usage"].as_f64().unwrap_or(0.0) as f32,
            frequency: cpu["frequency"].as_u64().unwrap_or(0),
            cores: cpu["cores"]
                .as_array()
                .map(|a| a.iter().map(|v| v.as_f64().unwrap_or(0.0) as f32).collect())
                .unwrap_or_default(),
        },
        memory: MemoryInfo {
            total_ram: mem["total_ram"].as_u64().unwrap_or(0),
            used_ram: mem["used_ram"].as_u64().unwrap_or(0),
            free_ram: mem["free_ram"].as_u64().unwrap_or(0),
            total_swap: mem["total_swap"].as_u64().unwrap_or(0),
            used_swap: mem["used_swap"].as_u64().unwrap_or(0),
        },
        gpu: GpuInfo {
            name: gpu["name"].as_str().unwrap_or("N/A").to_string(),
            vram_total: gpu["vram_total"].as_u64().unwrap_or(0),
            vram_used: gpu["vram_used"].as_u64().unwrap_or(0),
            vram_free: gpu["vram_free"].as_u64().unwrap_or(0),
            temperature: gpu["temperature"].as_f64().unwrap_or(0.0) as f32,
            utilization: gpu["utilization"].as_u64().unwrap_or(0) as u32,
            power_draw: gpu["power_draw"].as_f64().unwrap_or(0.0) as f32,
            available: gpu["available"].as_bool().unwrap_or(false),
        },
        cpu_temp: json["cpu_temp"].as_f64().unwrap_or(0.0) as f32,
        uptime: json["uptime"].as_u64().unwrap_or(0),
        hostname: json["hostname"].as_str().unwrap_or("unknown").to_string(),
    })
}
