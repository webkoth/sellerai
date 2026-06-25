#!/usr/bin/env python3
"""Строит плотный клип из keeper-дубля: макро-резы + рез длинных пауз,
кадровое выравнивание, синхронная склейка видео(proxy)+звук(keeper-48k).
Выдаёт: cut.filter (filtergraph для ffmpeg) и segments.json (для Remotion)."""
import json, re, subprocess, sys

FPS = 30
PROXY = "../../public/footage/care-proxy.mp4"
AUDIO = "keeper-48k.wav"

# Макро-блоки (таймлайн keeper, сек): хук→видманштеттен и ржавчина→чистка.
# Выкинуты: 0–8.2 фальстарт, 81.02–91.22 рестарт, >119.2 дубль+хвост.
MACRO = [(8.20, 81.02), (91.22, 119.20)]
PAUSE_THR = 0.85   # паузы длиннее — режем
PAUSE_FLOOR = 0.20 # столько паузы оставляем (дыхание/ритм)
MERGE_GAP = 0.60   # близкие длинные паузы (речь между < этого) — сливаем
MIN_SEG = 0.40     # сегменты короче — выкидываем (осколки/вдохи)

def snap(t):
    return round(t * FPS) / FPS

def silences(path):
    out = subprocess.run(
        ["ffmpeg","-hide_banner","-nostats","-i",path,
         "-af",f"silencedetect=noise=-30dB:d=0.40","-f","null","-"],
        capture_output=True, text=True).stderr
    res=[]; s=None
    for line in out.splitlines():
        m=re.search(r"silence_start: ([0-9.]+)", line)
        if m: s=float(m.group(1))
        m=re.search(r"silence_end: ([0-9.]+)", line)
        if m and s is not None: res.append((s,float(m.group(1)))); s=None
    return res

pauses = silences(AUDIO)

# Внутри каждого макро-блока убираем длинные паузы.
segs=[]  # (src_start, src_end)
for S,E in MACRO:
    # длинные паузы строго внутри блока
    lp=[(ps,pe) for ps,pe in pauses if ps>S and pe<E and pe-ps>PAUSE_THR]
    # сливаем близкие (речь между < MERGE_GAP)
    merged=[]
    for ps,pe in lp:
        if merged and ps-merged[-1][1] < MERGE_GAP:
            merged[-1]=(merged[-1][0],pe)
        else:
            merged.append((ps,pe))
    cur=S
    for ps,pe in merged:
        end=ps+PAUSE_FLOOR
        if end>cur+0.10: segs.append((cur,end))
        cur=pe
    if E>cur+0.10: segs.append((cur,E))
# выкидываем осколки
segs=[(s,e) for s,e in segs if e-s>=MIN_SEG]

# Кадровое выравнивание + расчёт плотного таймлайна.
tight=[]; t=0.0
for s,e in segs:
    s2,e2=snap(s),snap(e)
    d=e2-s2
    if d < 1/FPS: continue
    tight.append({"src_start":round(s2,3),"src_end":round(e2,3),
                  "tight_start":round(t,3),"dur":round(d,3)})
    t+=d

total=round(t,3)
json.dump({"fps":FPS,"total":total,"segments":tight}, open("segments.json","w"),
          ensure_ascii=False, indent=2)

# Filtergraph.
lines=[]; vlab=[]; alab=[]
for i,s in enumerate(tight):
    a,b=s["src_start"],s["src_end"]
    lines.append(f"[0:v]trim=start={a}:end={b},setpts=PTS-STARTPTS[v{i}];")
    lines.append(f"[1:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS[a{i}];")
    vlab.append(f"[v{i}]"); alab.append(f"[a{i}]")
inter="".join(f"{vlab[i]}{alab[i]}" for i in range(len(tight)))
lines.append(f"{inter}concat=n={len(tight)}:v=1:a=1[v][a]")
open("cut.filter","w").write("\n".join(lines))

print(f"Сегментов: {len(tight)}  Плотная длительность: {total:.2f}s "
      f"(из 149.4 → {total/149.4*100:.0f}%)")
for s in tight:
    print(f"  src {s['src_start']:6.2f}-{s['src_end']:6.2f} → tight {s['tight_start']:6.2f} (+{s['dur']:.2f})")
