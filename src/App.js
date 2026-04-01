import { useState, useEffect, useCallback } from "react";

const SHIFTS = [
  { id:"empty",   s:"·", label:"–",   bg:"transparent", border:"#E2E8F0", tc:"#D1D5DB" },
  { id:"morning", s:"ช", label:"เช้า", bg:"#FEF3C7",     border:"#F59E0B", tc:"#92400E" },
  { id:"night",   s:"ด", label:"ดึก",  bg:"#E0E7FF",     border:"#6366F1", tc:"#3730A3" },
  { id:"off",     s:"ห", label:"หยุด", bg:"#F3F4F6",     border:"#9CA3AF", tc:"#4B5563" },
  { id:"leave",   s:"ล", label:"ลา",   bg:"#FEE2E2",     border:"#F87171", tc:"#991B1B" },
];

const TASK_TYPES = [
  { id:"pickup",   label:"รับคนไข้",       icon:"🚗" },
  { id:"errand",   label:"ติดต่อประสานงาน", icon:"📋" },
  { id:"medical",  label:"พาพบแพทย์",      icon:"🏥" },
  { id:"supply",   label:"ซื้อของ/เวชภัณฑ์", icon:"🛒" },
  { id:"other",    label:"อื่นๆ",           icon:"📌" },
];

const TH_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const THAI_YEAR_OFFSET = 543;
const COLORS = ["#0EA5E9","#10B981","#F59E0B","#EC4899","#8B5CF6","#EF4444","#14B8A6","#F97316","#06B6D4","#84CC16"];

const initStaff = [
  {id:1, name:"อรุณ วงศ์ดี",  role:"CG",    color:"#0EA5E9"},
  {id:2, name:"สมหญิง ใจดี",  role:"CG",    color:"#10B981"},
  {id:3, name:"วิภา ทองคำ",   role:"CG",    color:"#F59E0B"},
  {id:4, name:"นิดา สุขสม",   role:"CG",    color:"#EC4899"},
  {id:5, name:"ประภา มีสุข",  role:"Nurse", color:"#8B5CF6"},
];

const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
const dayOfWeek   = (y, m, d) => new Date(y, m, d).getDay();
const makeKey     = (y, m) => `${y}-${m}`;
const makeMonthSch = (staffIds, y, m) => {
  const s = {};
  staffIds.forEach(id => { s[id] = Array(daysInMonth(y, m)).fill("empty"); });
  return s;
};

export default function App() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [staff, setStaff] = useState(initStaff);
  const [allSch, setAllSch] = useState(() => {
    const k = makeKey(now.getFullYear(), now.getMonth());
    return { [k]: makeMonthSch(initStaff.map(x=>x.id), now.getFullYear(), now.getMonth()) };
  });
  // tasks: { [monthKey]: { [staffId]: { [dayIdx]: [{type,desc,cost}] } } }
  const [allTasks, setAllTasks] = useState({});
  const [showForm,  setShowForm]  = useState(false);
  const [newName,   setNewName]   = useState("");
  const [newRole,   setNewRole]   = useState("CG");
  const [activeTab, setActiveTab] = useState("schedule");
  const [saved,      setSaved]     = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const BIN_ID     = "69ccf940aaba882197b453f4";
  const MASTER_KEY = "$2a$10$JCjeP9gPY4mX/bZIxRdgXePiqJyDZ2KvVPZ0dR05rf85vUmm9psy6";
  const ACCESS_KEY = "$2a$10$Tb2NOADcN531rJGdhXShbus48pgIlXgXI7VMXDvzf9FnWAkLp2meu";
  const BIN_URL    = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
  // Modal state
  const [modal, setModal] = useState(null); // {staffId, di}
  const [taskType, setTaskType] = useState("pickup");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskCost, setTaskCost] = useState("");

  const key  = makeKey(year, month);
  const days = daysInMonth(year, month);

  const getSch = useCallback(() => {
    if (!allSch[key]) return makeMonthSch(staff.map(s=>s.id), year, month);
    const sch = { ...allSch[key] };
    staff.forEach(m => { if (!sch[m.id]) sch[m.id] = Array(days).fill("empty"); });
    return sch;
  }, [allSch, key, staff, year, month, days]);

  const sch = getSch();

  const getTasksForCell = (staffId, di) =>
    allTasks?.[key]?.[staffId]?.[di] || [];

  // Save — local + Google Sheets
  useEffect(() => {
    const save = async () => {
      try {
        const payload = { staff, schedules: allSch, tasks: allTasks };
        // Local storage
        await window.storage.set("staff",     JSON.stringify(staff));
        await window.storage.set("schedules", JSON.stringify(allSch));
        await window.storage.set("tasks",     JSON.stringify(allTasks));
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        // Save to JSONBin
        setSyncStatus("syncing");
        const payload = { staff, schedules: allSch, tasks: allTasks };
        await fetch(BIN_URL, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Master-Key": MASTER_KEY,
            "X-Access-Key": ACCESS_KEY,
          },
          body: JSON.stringify(payload),
        });
        setSyncStatus("synced");
        setTimeout(() => setSyncStatus(""), 2000);
      } catch(e) {
        setSyncStatus("error");
        setTimeout(() => setSyncStatus(""), 3000);
      }
    };
    save();
  }, [staff, allSch, allTasks]);

  // Load — try Google Sheets first, fallback to local
  useEffect(() => {
    const load = async () => {
      try {
        setSyncStatus("syncing");
        const res  = await fetch(BIN_URL + "/latest", {
          headers: {
            "X-Master-Key": MASTER_KEY,
            "X-Access-Key": ACCESS_KEY,
          },
        });
        const json = await res.json();
        if (json.record) {
          const d = json.record;
          if (d.staff && d.staff.length > 0)     setStaff(d.staff);
          if (d.schedules) setAllSch(d.schedules);
          if (d.tasks)     setAllTasks(d.tasks);
          setSyncStatus("synced");
          setTimeout(() => setSyncStatus(""), 2000);
          return;
        }
      } catch(e) {}
      // Fallback to local storage
      try {
        const sr   = await window.storage.get("staff");
        const schr = await window.storage.get("schedules");
        const tkr  = await window.storage.get("tasks");
        if (sr?.value)   setStaff(JSON.parse(sr.value));
        if (schr?.value) setAllSch(JSON.parse(schr.value));
        if (tkr?.value)  setAllTasks(JSON.parse(tkr.value));
        setSyncStatus("");
      } catch(e) {}
    };
    load();
  }, []);

  const cycle = (staffId, di) => {
    setAllSch(prev => {
      const cur     = (prev[key]||{})[staffId]?.[di] || "empty";
      const idx     = SHIFTS.findIndex(s=>s.id===cur);
      const prevSch = prev[key] || makeMonthSch(staff.map(s=>s.id), year, month);
      const row     = [...(prevSch[staffId] || Array(days).fill("empty"))];
      row[di] = SHIFTS[(idx+1) % SHIFTS.length].id;
      return { ...prev, [key]: { ...prevSch, [staffId]: row } };
    });
  };

  const openModal = (staffId, di) => {
    setModal({staffId, di});
    setTaskType("pickup");
    setTaskDesc("");
    setTaskCost("");
  };

  const addTask = () => {
    if (!taskDesc.trim()) return;
    const task = {
      id: Date.now(),
      type: taskType,
      desc: taskDesc.trim(),
      cost: parseFloat(taskCost) || 0,
    };
    setAllTasks(prev => {
      const m  = prev[key] || {};
      const s  = m[modal.staffId] || {};
      const d  = s[modal.di] || [];
      return { ...prev, [key]: { ...m, [modal.staffId]: { ...s, [modal.di]: [...d, task] } } };
    });
    setTaskDesc("");
    setTaskCost("");
  };

  const removeTask = (staffId, di, taskId) => {
    setAllTasks(prev => {
      const m = prev[key] || {};
      const s = m[staffId] || {};
      const d = (s[di] || []).filter(t => t.id !== taskId);
      return { ...prev, [key]: { ...m, [staffId]: { ...s, [di]: d } } };
    });
  };

  const addStaff = () => {
    if (!newName.trim()) return;
    const id    = Date.now();
    const color = COLORS[staff.length % COLORS.length];
    setStaff(p => [...p, { id, name: newName.trim(), role: newRole, color }]);
    setAllSch(prev => {
      const upd = { ...prev };
      Object.keys(upd).forEach(k => {
        const [y2, m2] = k.split("-").map(Number);
        upd[k] = { ...upd[k], [id]: Array(daysInMonth(y2,m2)).fill("empty") };
      });
      return upd;
    });
    setNewName("");
    setShowForm(false);
  };

  const delStaff = id => {
    setStaff(p => p.filter(s=>s.id!==id));
    setAllSch(prev => {
      const upd = {...prev};
      Object.keys(upd).forEach(k => { const n={...upd[k]}; delete n[id]; upd[k]=n; });
      return upd;
    });
  };

  const prevMonth = () => { if(month===0){setYear(y=>y-1);setMonth(11);}else setMonth(m=>m-1); };
  const nextMonth = () => { if(month===11){setYear(y=>y+1);setMonth(0);}else setMonth(m=>m+1); };

  const getShift = id => SHIFTS.find(s=>s.id===id)||SHIFTS[0];

  // Stats
  const allCells   = staff.flatMap(m => sch[m.id]||[]);
  const countSh    = id => allCells.filter(s=>s===id).length;
  const totalWork  = allCells.filter(s=>s!=="empty"&&s!=="off"&&s!=="leave").length;
  const coverage   = Array(days).fill(0).map((_,di) =>
    staff.filter(m=>{ const s=sch[m.id]?.[di]; return s&&s!=="empty"&&s!=="off"&&s!=="leave"; }).length
  );

  // Task stats for the month
  const monthTasks = Object.entries(allTasks[key]||{}).flatMap(([sid, dayMap]) =>
    Object.entries(dayMap).flatMap(([di, tasks]) =>
      tasks.map(t => ({ ...t, staffId: parseInt(sid), di: parseInt(di) }))
    )
  );
  const totalCost = monthTasks.reduce((s,t) => s + (t.cost||0), 0);

  const staffStats = staff.map(m => {
    const row      = sch[m.id]||[];
    const myTasks  = monthTasks.filter(t=>t.staffId===m.id);
    const myCost   = myTasks.reduce((s,t)=>s+(t.cost||0),0);
    return {
      ...m,
      morning: row.filter(s=>s==="morning").length,
      night:   row.filter(s=>s==="night").length,
      off:     row.filter(s=>s==="off").length,
      leave:   row.filter(s=>s==="leave").length,
      total:   row.filter(s=>s!=="empty"&&s!=="off"&&s!=="leave").length,
      taskCount: myTasks.length,
      taskCost:  myCost,
    };
  });

  const card = { background:"white", borderRadius:12, border:"1px solid #E2E8F0" };

  // Modal staff+day info
  const modalStaff = modal ? staff.find(m=>m.id===modal.staffId) : null;
  const modalTasks = modal ? getTasksForCell(modal.staffId, modal.di) : [];

  return (
    <div style={{ fontFamily:"'Sarabun','Noto Sans Thai',sans-serif", background:"#F0F9FF", minHeight:"100vh", paddingBottom:24 }}>

      {/* Task Modal */}
      {modal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:50, display:"flex", alignItems:"flex-end" }}
          onClick={e=>{ if(e.target===e.currentTarget) setModal(null); }}>
          <div style={{ background:"white", borderRadius:"20px 20px 0 0", width:"100%", maxHeight:"85vh", overflowY:"auto", padding:20 }}>
            {/* Modal Header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:"#0F172A" }}>
                  {modalStaff?.name}
                </div>
                <div style={{ fontSize:12, color:"#64748B" }}>
                  วันที่ {modal.di+1} {TH_MONTHS[month]} · {getShift(sch[modal.staffId]?.[modal.di]).label}
                </div>
              </div>
              <button onClick={()=>setModal(null)} style={{ background:"#F1F5F9", border:"none", borderRadius:8, padding:"6px 12px", fontSize:13, cursor:"pointer", color:"#64748B" }}>ปิด</button>
            </div>

            {/* Existing Tasks */}
            {modalTasks.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#64748B", marginBottom:8, letterSpacing:1 }}>รายการ task</div>
                {modalTasks.map(t => {
                  const tt = TASK_TYPES.find(x=>x.id===t.type);
                  return (
                    <div key={t.id} style={{ display:"flex", alignItems:"center", gap:8, background:"#F8FAFC", borderRadius:10, padding:"10px 12px", marginBottom:6 }}>
                      <span style={{ fontSize:16 }}>{tt?.icon}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:700 }}>{t.desc}</div>
                        <div style={{ fontSize:10, color:"#64748B" }}>{tt?.label}</div>
                      </div>
                      {t.cost > 0 && (
                        <div style={{ fontSize:12, fontWeight:800, color:"#10B981", whiteSpace:"nowrap" }}>
                          ฿{t.cost.toLocaleString()}
                        </div>
                      )}
                      <button onClick={()=>removeTask(modal.staffId, modal.di, t.id)}
                        style={{ background:"none", border:"none", color:"#FCA5A5", cursor:"pointer", fontSize:14, padding:"2px 4px" }}>✕</button>
                    </div>
                  );
                })}
                <div style={{ textAlign:"right", fontSize:12, fontWeight:700, color:"#10B981", marginTop:4 }}>
                  รวม ฿{modalTasks.reduce((s,t)=>s+(t.cost||0),0).toLocaleString()}
                </div>
              </div>
            )}

            {/* Add Task Form */}
            <div style={{ ...card, padding:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#64748B", marginBottom:10, letterSpacing:1 }}>+ เพิ่ม task</div>
              {/* Task Type */}
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
                {TASK_TYPES.map(t => (
                  <button key={t.id} onClick={()=>setTaskType(t.id)}
                    style={{ padding:"5px 10px", borderRadius:20, border:`1.5px solid ${taskType===t.id?"#0EA5E9":"#E2E8F0"}`,
                      background: taskType===t.id?"#EFF6FF":"white", color: taskType===t.id?"#0EA5E9":"#64748B",
                      fontFamily:"inherit", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
              <input value={taskDesc} onChange={e=>setTaskDesc(e.target.value)}
                placeholder="รายละเอียด เช่น รับคุณลุงสมชายไปโรงพยาบาล"
                style={{ width:"100%", border:"1.5px solid #E2E8F0", borderRadius:8, padding:"9px 12px", fontFamily:"inherit", fontSize:13, outline:"none", marginBottom:8 }} />
              <div style={{ display:"flex", gap:8 }}>
                <div style={{ position:"relative", flex:1 }}>
                  <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:13, color:"#94A3B8", fontWeight:700 }}>฿</span>
                  <input value={taskCost} onChange={e=>setTaskCost(e.target.value)} type="number" placeholder="ค่าใช้จ่าย (ถ้ามี)"
                    style={{ width:"100%", border:"1.5px solid #E2E8F0", borderRadius:8, padding:"9px 12px 9px 26px", fontFamily:"inherit", fontSize:13, outline:"none" }} />
                </div>
                <button onClick={addTask}
                  style={{ background:"#0EA5E9", color:"white", border:"none", borderRadius:8, padding:"9px 18px", fontFamily:"inherit", fontSize:13, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
                  + เพิ่ม
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div style={{ background:"white", borderBottom:"1px solid #E2E8F0", padding:"12px 16px", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:9, fontWeight:700, color:"#0EA5E9", letterSpacing:2, textTransform:"uppercase" }}>เจริญรักษ์ ประชาสโมสร</div>
            <div style={{ fontSize:18, fontWeight:800, color:"#0F172A" }}>ตารางเวร</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            {syncStatus === "syncing" && <div style={{ fontSize:11, color:"#F59E0B", fontWeight:700 }}>⟳ กำลัง sync...</div>}
            {syncStatus === "synced"  && <div style={{ fontSize:11, color:"#10B981", fontWeight:700 }}>✓ Sync แล้ว</div>}
            {syncStatus === "error"   && <div style={{ fontSize:11, color:"#EF4444", fontWeight:700 }}>⚠ Sync ไม่ได้</div>}
            {syncStatus === "" && saved && <div style={{ fontSize:11, color:"#10B981", fontWeight:700 }}>✓ บันทึกแล้ว</div>}
            <button onClick={()=>setShowForm(!showForm)} style={{ background:"#0EA5E9", color:"white", border:"none", borderRadius:8, padding:"7px 12px", fontFamily:"inherit", fontSize:12, fontWeight:700, cursor:"pointer" }}>+ เพิ่ม</button>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:10 }}>
          <button onClick={prevMonth} style={{ background:"#F1F5F9", border:"none", borderRadius:8, padding:"6px 14px", fontSize:16, cursor:"pointer" }}>‹</button>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:16, fontWeight:800 }}>{TH_MONTHS[month]}</div>
            <div style={{ fontSize:12, color:"#64748B" }}>พ.ศ. {year+THAI_YEAR_OFFSET}</div>
          </div>
          <button onClick={nextMonth} style={{ background:"#F1F5F9", border:"none", borderRadius:8, padding:"6px 14px", fontSize:16, cursor:"pointer" }}>›</button>
        </div>
        <div style={{ display:"flex", gap:6, marginTop:10 }}>
          {[{id:"schedule",l:"📅 ตารางเวร"},{id:"stats",l:"📊 สรุป"},{id:"expenses",l:"💰 ค่าใช้จ่าย"}].map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)}
              style={{ flex:1, padding:"7px 0", border:"none", borderRadius:8, fontFamily:"inherit", fontSize:11, fontWeight:700, cursor:"pointer",
                background: activeTab===t.id?"#0EA5E9":"#F1F5F9", color: activeTab===t.id?"white":"#64748B" }}>{t.l}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:"12px 12px 0" }}>
        {/* Add Staff Form */}
        {showForm && (
          <div style={{ ...card, border:"2px solid #0EA5E9", padding:14, marginBottom:12, display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ fontSize:13, fontWeight:700 }}>เพิ่มพนักงานใหม่</div>
            <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="ชื่อ-นามสกุล"
              style={{ border:"1.5px solid #E2E8F0", borderRadius:8, padding:"8px 10px", fontFamily:"inherit", fontSize:13, outline:"none" }} />
            <select value={newRole} onChange={e=>setNewRole(e.target.value)}
              style={{ border:"1.5px solid #E2E8F0", borderRadius:8, padding:"8px 10px", fontFamily:"inherit", fontSize:13, outline:"none", background:"white" }}>
              <option value="CG">CG (Care Giver)</option>
              <option value="Nurse">Nurse</option>
              <option value="Team Support">Team Support</option>
              <option value="Admin">Admin</option>
            </select>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={addStaff} style={{ flex:1, background:"#10B981", color:"white", border:"none", borderRadius:8, padding:10, fontFamily:"inherit", fontSize:13, fontWeight:700, cursor:"pointer" }}>✓ เพิ่ม</button>
              <button onClick={()=>setShowForm(false)} style={{ flex:1, background:"#F1F5F9", color:"#64748B", border:"none", borderRadius:8, padding:10, fontFamily:"inherit", fontSize:13, cursor:"pointer" }}>ยกเลิก</button>
            </div>
          </div>
        )}

        {/* Legend */}
        {activeTab==="schedule" && (
          <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:10, alignItems:"center" }}>
            {SHIFTS.filter(s=>s.id!=="empty").map(s=>(
              <div key={s.id} style={{ background:s.bg, border:`1.5px solid ${s.border}`, color:s.tc, borderRadius:20, padding:"2px 8px", fontSize:10, fontWeight:700 }}>
                {s.s} {s.label}
              </div>
            ))}
            <div style={{ fontSize:10, color:"#94A3B8" }}>📌 = มี task</div>
          </div>
        )}
      </div>

      {/* SCHEDULE TAB */}
      {activeTab==="schedule" && (
        <div style={{ overflowX:"auto", paddingLeft:12 }}>
          <table style={{ borderCollapse:"collapse", background:"white", borderRadius:14, overflow:"hidden", boxShadow:"0 4px 20px rgba(0,0,0,0.07)" }}>
            <thead>
              <tr style={{ background:"#F8FAFC" }}>
                <th style={{ padding:"8px 10px", textAlign:"left", fontSize:10, color:"#94A3B8", fontWeight:700, minWidth:130, position:"sticky", left:0, background:"#F8FAFC", borderRight:"2px solid #E2E8F0", zIndex:2 }}>พนักงาน</th>
                {Array(days).fill(0).map((_,di)=>{
                  const dow     = dayOfWeek(year,month,di+1);
                  const isWE    = dow===0||dow===6;
                  const isToday = year===now.getFullYear()&&month===now.getMonth()&&di===now.getDate()-1;
                  return (
                    <th key={di} style={{ padding:"4px 2px", minWidth:36, textAlign:"center", borderLeft:"1px solid #F1F5F9" }}>
                      <div style={{ fontSize:11, fontWeight:800, color:isToday?"#0EA5E9":isWE?"#EF4444":"#0F172A",
                        background:isToday?"#EFF6FF":"transparent", borderRadius:6, padding:"1px 3px" }}>{di+1}</div>
                      <div style={{ fontSize:9, color:isWE?"#FCA5A5":"#CBD5E1" }}>
                        {["อา","จ","อ","พ","พฤ","ศ","ส"][dow]}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {staff.map(m => (
                <tr key={m.id} style={{ borderBottom:"1px solid #F8FAFC" }}>
                  <td style={{ padding:"6px 10px", position:"sticky", left:0, background:"white", borderRight:"2px solid #E2E8F0", zIndex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ width:26, height:26, borderRadius:"50%", background:m.color, color:"white", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, flexShrink:0 }}>
                        {m.name.charAt(0)}
                      </div>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:11, fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:78 }}>{m.name}</div>
                        <div style={{ fontSize:9, color:"#94A3B8" }}>{m.role}</div>
                      </div>
                      <button onClick={()=>delStaff(m.id)} style={{ background:"none", border:"none", color:"#E2E8F0", cursor:"pointer", fontSize:11, padding:"1px 3px", flexShrink:0 }}>✕</button>
                    </div>
                  </td>
                  {Array(days).fill(0).map((_,di)=>{
                    const sid      = sch[m.id]?.[di]||"empty";
                    const sh       = getShift(sid);
                    const on       = sid!=="empty";
                    const isWE     = [0,6].includes(dayOfWeek(year,month,di+1));
                    const tasks    = getTasksForCell(m.id, di);
                    const hasTasks = tasks.length > 0;
                    const hasCost  = tasks.some(t=>t.cost>0);
                    return (
                      <td key={di} style={{ textAlign:"center", padding:"4px 2px", borderLeft:"1px solid #F8FAFC", background:isWE&&!on?"#FFFBF5":"transparent" }}>
                        {/* Shift badge — tap to cycle */}
                        <div onClick={()=>cycle(m.id,di)}
                          style={{ width:30, height:30, borderRadius:7, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"center",
                            background:sh.bg, border:`1.5px ${on?"solid":"dashed"} ${on?sh.border:"#E2E8F0"}`,
                            fontSize:11, fontWeight:800, color:sh.tc, cursor:"pointer" }}>
                          {sh.s}
                        </div>
                        {/* Task button */}
                        <div onClick={()=>openModal(m.id,di)}
                          style={{ marginTop:2, fontSize:9, cursor:"pointer", color: hasTasks?"#F59E0B":"#E2E8F0",
                            display:"flex", alignItems:"center", justifyContent:"center", gap:1 }}>
                          {hasTasks ? (hasCost ? "💰" : "📌") : "+"}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background:"#F8FAFC", borderTop:"2px solid #E2E8F0" }}>
                <td style={{ padding:"6px 10px", fontSize:9, color:"#94A3B8", fontWeight:700, position:"sticky", left:0, background:"#F8FAFC", borderRight:"2px solid #E2E8F0" }}>Coverage</td>
                {coverage.map((w,i)=>(
                  <td key={i} style={{ textAlign:"center", padding:"4px 2px", borderLeft:"1px solid #F1F5F9" }}>
                    <div style={{ fontSize:13, fontWeight:800, color:w<2?"#EF4444":w>=3?"#10B981":"#F59E0B" }}>{w}</div>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
          <div style={{ textAlign:"center", marginTop:8, marginRight:12, fontSize:10, color:"#CBD5E1", paddingBottom:4 }}>
            แตะตัวเลข = สลับเวร · แตะ + / 📌 = เพิ่ม task
          </div>
        </div>
      )}

      {/* STATS TAB */}
      {activeTab==="stats" && (
        <div style={{ padding:"0 12px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
            {[
              {l:"เวรเช้า",   v:countSh("morning"), i:"🌅", c:"#F59E0B"},
              {l:"เวรดึก",    v:countSh("night"),   i:"🌙", c:"#6366F1"},
              {l:"วันหยุด",   v:countSh("off"),     i:"🏖️", c:"#10B981"},
              {l:"วันลา",     v:countSh("leave"),   i:"📋", c:"#EF4444"},
              {l:"รวมเวรงาน", v:totalWork,           i:"✅", c:"#0EA5E9"},
              {l:"Task เดือนนี้", v:monthTasks.length, i:"📌", c:"#F59E0B"},
            ].map(s=>(
              <div key={s.l} style={{ ...card, padding:"10px 12px" }}>
                <div style={{ fontSize:18 }}>{s.i}</div>
                <div style={{ fontSize:20, fontWeight:800, color:s.c }}>{s.v}</div>
                <div style={{ fontSize:10, color:"#94A3B8", fontWeight:600 }}>{s.l}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize:12, fontWeight:700, color:"#64748B", marginBottom:8, letterSpacing:1 }}>สรุปรายบุคคล</div>
          {staffStats.map(m=>(
            <div key={m.id} style={{ ...card, padding:12, marginBottom:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <div style={{ width:30, height:30, borderRadius:"50%", background:m.color, color:"white", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800 }}>{m.name.charAt(0)}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700 }}>{m.name}</div>
                  <div style={{ fontSize:10, color:"#94A3B8" }}>{m.role} · ทำงาน {m.total} วัน</div>
                </div>
                {m.taskCost > 0 && <div style={{ fontSize:12, fontWeight:800, color:"#10B981" }}>฿{m.taskCost.toLocaleString()}</div>}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:4 }}>
                {[
                  {l:"เช้า",  v:m.morning, c:"#F59E0B", bg:"#FEF3C7"},
                  {l:"ดึก",   v:m.night,   c:"#6366F1", bg:"#E0E7FF"},
                  {l:"หยุด",  v:m.off,     c:"#9CA3AF", bg:"#F3F4F6"},
                  {l:"ลา",    v:m.leave,   c:"#F87171", bg:"#FEE2E2"},
                ].map(x=>(
                  <div key={x.l} style={{ background:x.bg, borderRadius:8, padding:"6px 4px", textAlign:"center" }}>
                    <div style={{ fontSize:14, fontWeight:800, color:x.c }}>{x.v}</div>
                    <div style={{ fontSize:9, color:"#94A3B8" }}>{x.l}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ fontSize:12, fontWeight:700, color:"#64748B", marginBottom:8, letterSpacing:1 }}>Coverage รายวัน</div>
          <div style={{ ...card, padding:12, marginBottom:12 }}>
            <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
              {coverage.map((w,i)=>{
                const bg2=w===0?"#FEE2E2":w===1?"#FEF3C7":w===2?"#D1FAE5":"#A7F3D0";
                const tc2=w===0?"#991B1B":w===1?"#92400E":w===2?"#065F46":"#047857";
                return (
                  <div key={i} style={{ width:36, height:36, borderRadius:8, background:bg2, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                    <div style={{ fontSize:13, fontWeight:800, color:tc2 }}>{w}</div>
                    <div style={{ fontSize:8, color:tc2, opacity:.7 }}>{i+1}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* EXPENSES TAB */}
      {activeTab==="expenses" && (
        <div style={{ padding:"0 12px" }}>
          {/* Total */}
          <div style={{ ...card, padding:16, marginBottom:12, display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ fontSize:32 }}>💰</div>
            <div>
              <div style={{ fontSize:12, color:"#64748B", fontWeight:600 }}>ค่าใช้จ่ายรวมเดือน {TH_MONTHS[month]}</div>
              <div style={{ fontSize:28, fontWeight:800, color:"#10B981" }}>฿{totalCost.toLocaleString()}</div>
              <div style={{ fontSize:11, color:"#94A3B8" }}>{monthTasks.length} รายการ</div>
            </div>
          </div>

          {/* By task type */}
          <div style={{ fontSize:12, fontWeight:700, color:"#64748B", marginBottom:8, letterSpacing:1 }}>แยกตามประเภท</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
            {TASK_TYPES.map(tt => {
              const tasks = monthTasks.filter(t=>t.type===tt.id);
              const cost  = tasks.reduce((s,t)=>s+(t.cost||0),0);
              return (
                <div key={tt.id} style={{ ...card, padding:"10px 12px" }}>
                  <div style={{ fontSize:18, marginBottom:2 }}>{tt.icon}</div>
                  <div style={{ fontSize:14, fontWeight:800, color:"#0F172A" }}>{tasks.length} รายการ</div>
                  <div style={{ fontSize:12, fontWeight:700, color:"#10B981" }}>฿{cost.toLocaleString()}</div>
                  <div style={{ fontSize:10, color:"#94A3B8" }}>{tt.label}</div>
                </div>
              );
            })}
          </div>

          {/* Full task log */}
          <div style={{ fontSize:12, fontWeight:700, color:"#64748B", marginBottom:8, letterSpacing:1 }}>รายละเอียดทั้งหมด</div>
          {monthTasks.length === 0 ? (
            <div style={{ ...card, padding:24, textAlign:"center", color:"#94A3B8", fontSize:13 }}>ยังไม่มี task เดือนนี้</div>
          ) : (
            [...monthTasks].sort((a,b)=>a.di-b.di).map(t => {
              const m2  = staff.find(s=>s.id===t.staffId);
              const tt  = TASK_TYPES.find(x=>x.id===t.type);
              return (
                <div key={t.id} style={{ ...card, padding:"10px 12px", marginBottom:6, display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:28, height:28, borderRadius:"50%", background:m2?.color, color:"white", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, flexShrink:0 }}>
                    {m2?.name.charAt(0)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:700 }}>{t.desc}</div>
                    <div style={{ fontSize:10, color:"#94A3B8" }}>
                      {m2?.name} · วันที่ {t.di+1} · {tt?.icon} {tt?.label}
                    </div>
                  </div>
                  {t.cost > 0 && (
                    <div style={{ fontSize:13, fontWeight:800, color:"#10B981", whiteSpace:"nowrap" }}>฿{t.cost.toLocaleString()}</div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
