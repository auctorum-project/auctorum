import { Router } from 'express';
import { executeSSH, getSSHConfig } from '../ssh.js';

const router = Router();

const METRICS_PYTHON_SCRIPT = `python3 -c "
import json, subprocess, os, time

cpu_info = subprocess.run(['grep', '-c', 'processor', '/proc/cpuinfo'], capture_output=True, text=True)
cores_count = int(cpu_info.stdout.strip())
load = os.getloadavg()
cpu_usage = min(load[0] / cores_count * 100, 100)

mem = {}
with open('/proc/meminfo') as f:
    for line in f:
        parts = line.split()
        mem[parts[0].rstrip(':')] = int(parts[1]) * 1024

hostname = open('/etc/hostname').read().strip()
uptime_s = float(open('/proc/uptime').read().split()[0])

# Try nvidia-smi
gpu = {'available': False, 'name': 'N/A', 'vram_total': 0, 'vram_used': 0, 'vram_free': 0, 'temperature': 0, 'utilization': 0, 'power_draw': 0}
try:
    nv = subprocess.run(['nvidia-smi', '--query-gpu=name,memory.total,memory.used,memory.free,temperature.gpu,utilization.gpu,power.draw', '--format=csv,noheader,nounits'], capture_output=True, text=True)
    if nv.returncode == 0:
        parts = [p.strip() for p in nv.stdout.strip().split(',')]
        gpu = {'available': True, 'name': parts[0], 'vram_total': int(parts[1]), 'vram_used': int(parts[2]), 'vram_free': int(parts[3]), 'temperature': float(parts[4]), 'utilization': int(parts[5]), 'power_draw': float(parts[6])}
except: pass

# Per-core usage from /proc/stat snapshot
def get_cpu_times():
    with open('/proc/stat') as f:
        lines = f.readlines()
    cores = []
    for l in lines[1:]:
        if not l.startswith('cpu'): break
        vals = list(map(int, l.split()[1:]))
        idle = vals[3] + vals[4]
        total = sum(vals)
        cores.append((idle, total))
    return cores

t1 = get_cpu_times()
time.sleep(0.5)
t2 = get_cpu_times()
core_usages = []
for (i1,t1c),(i2,t2c) in zip(t1,t2):
    dt = t2c - t1c
    di = i2 - i1
    core_usages.append(round((1 - di/dt)*100, 1) if dt > 0 else 0)

# CPU temp
cpu_temp = 0
try:
    for z in sorted(os.listdir('/sys/class/thermal/')):
        if z.startswith('thermal_zone'):
            cpu_temp = int(open(f'/sys/class/thermal/{z}/temp').read().strip()) / 1000
            break
except: pass

cpuinfo_text = open('/proc/cpuinfo').read()
cpu_name = 'Unknown'
if 'model name' in cpuinfo_text:
    cpu_name = cpuinfo_text.split('model name')[1].split('\\\\n')[0].split(':')[1].strip()

print(json.dumps({
    'cpu': {
        'name': cpu_name,
        'usage': round(cpu_usage, 1),
        'frequency': 3600,
        'cores': core_usages
    },
    'memory': {
        'total_ram': mem.get('MemTotal', 0),
        'used_ram': mem.get('MemTotal', 0) - mem.get('MemAvailable', mem.get('MemFree', 0)),
        'free_ram': mem.get('MemAvailable', mem.get('MemFree', 0)),
        'total_swap': mem.get('SwapTotal', 0),
        'used_swap': mem.get('SwapTotal', 0) - mem.get('SwapFree', 0)
    },
    'gpu': gpu,
    'cpu_temp': cpu_temp,
    'uptime': int(uptime_s),
    'hostname': hostname
}))
"`;

function getMockMetrics() {
  return {
    cpu: {
      name: 'Mock CPU (SSH unavailable)',
      usage: 25.0,
      frequency: 3600,
      cores: [20.0, 30.0, 15.0, 35.0],
    },
    memory: {
      total_ram: 34359738368,
      used_ram: 17179869184,
      free_ram: 17179869184,
      total_swap: 8589934592,
      used_swap: 1073741824,
    },
    gpu: {
      available: false,
      name: 'N/A',
      vram_total: 0,
      vram_used: 0,
      vram_free: 0,
      temperature: 0,
      utilization: 0,
      power_draw: 0,
    },
    cpu_temp: 45.0,
    uptime: 86400,
    hostname: 'mock-host',
  };
}

// GET /api/system/metrics
router.get('/api/system/metrics', async (req, res) => {
  try {
    const output = await executeSSH(METRICS_PYTHON_SCRIPT);
    const metrics = JSON.parse(output.trim());
    res.json(metrics);
  } catch (err) {
    console.error('[system/metrics] SSH failed, returning mock data:', err.message);
    res.json(getMockMetrics());
  }
});

// GET /api/system/test
router.get('/api/system/test', async (req, res) => {
  const start = Date.now();
  try {
    const output = await executeSSH('hostname');
    const latency = Date.now() - start;
    res.json({
      ok: true,
      latency,
      hostname: output.trim(),
    });
  } catch (err) {
    const latency = Date.now() - start;
    res.json({
      ok: false,
      latency,
      error: err.message,
    });
  }
});

export default router;
