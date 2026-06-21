import { useState, useEffect } from "react";

// ─── SUPABASE CONNECTION (via REST + fetch, no SDK needed) ────
const SUPABASE_URL = "https://ydzpbtlnckrhkcqfykcr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkenBidGxuY2tyaGtjcWZ5a2NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjExNjcsImV4cCI6MjA5NzUzNzE2N30.bIYqV77b8dqa-SgqwL9PoN-0vpLLmZs3U4Zq2CMiIgk";

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": options.prefer || "return=representation",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); msg = j.message || msg; } catch(e) {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

const db = {
  select: (table, query = "") => sbFetch(`${table}?${query}`),
  update: (table, query, body) => sbFetch(`${table}?${query}`, { method: "PATCH", body: JSON.stringify(body) }),
  insert: (table, body) => sbFetch(table, { method: "POST", body: JSON.stringify(body) }),
  count: async (table, query = "") => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      headers: {
        "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Prefer": "count=exact", "Range": "0-0",
      },
    });
    const range = res.headers.get("content-range");
    return range ? parseInt(range.split("/")[1], 10) : 0;
  },
};

const CATEGORIES = [
  { id:"clothes",icon:"👕",label:"Clothes"},{id:"footwear",icon:"👟",label:"Footwear"},
  { id:"electronics",icon:"📱",label:"Electronics"},{id:"vehicles",icon:"🚗",label:"Vehicles"},
  { id:"furniture",icon:"🛋",label:"Furniture"},{id:"medicine",icon:"💊",label:"Medicine"},
  { id:"food",icon:"🍱",label:"Food & Grocery"},{id:"sports",icon:"⚽",label:"Sports"},
  { id:"books",icon:"📚",label:"Books"},{id:"beauty",icon:"💄",label:"Beauty"},
  { id:"toys",icon:"🧸",label:"Toys"},{id:"hardware",icon:"🔨",label:"Hardware"},
];

function Login({ onSuccess }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const login = () => {
    setLoading(true); setError("");
    setTimeout(()=>{
      if(user==="admin"&&pass==="lokal@2025") onSuccess();
      else { setError("Invalid credentials. Access denied."); setLoading(false); }
    }, 600);
  };

  return (
    <div style={s.loginPage}>
      <div style={s.loginBox}>
        <div style={s.loginLogo}>⚙️</div>
        <div style={s.loginBrand}>Lokál Admin</div>
        <div style={s.loginUrl}>admin.lokal.in · connected to live database</div>
        <div style={s.loginWarning}>🔒 Restricted Access — Authorized Personnel Only</div>
        <div style={s.loginForm}>
          <label style={s.lbl}>Username</label>
          <input style={s.inp} placeholder="Enter username" value={user} onChange={e=>setUser(e.target.value)} autoComplete="off" />
          <label style={s.lbl}>Password</label>
          <div style={{position:"relative"}}>
            <input style={s.inp} type={showPass?"text":"password"} placeholder="Enter password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} />
            <button style={s.eyeBtn} onClick={()=>setShowPass(!showPass)}>{showPass?"🙈":"👁"}</button>
          </div>
          {error && <div style={s.errBox}>⛔ {error}</div>}
          <button style={{...s.loginBtn,opacity:(user&&pass)?1:0.5}} onClick={login}>
            {loading?"Verifying...":"🔐 Login to Admin Panel"}
          </button>
        </div>
        <div style={s.loginHint}>Demo: admin / lokal@2025</div>
      </div>
    </div>
  );
}

function Dashboard({ onLogout }) {
  const [tab, setTab] = useState("overview");
  const [pending, setPending] = useState([]);
  const [live, setLive] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [requestCount, setRequestCount] = useState(0);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  const showToast = (msg, type="success") => {
    setToast({msg, type});
    setTimeout(()=>setToast(null), 3000);
  };

  async function loadAll() {
    setLoading(true);
    try {
      const pendingShops = await db.select("shops", "status=eq.pending&order=created_at.desc");
      const liveShops = await db.select("shops", "status=eq.approved&order=created_at.desc");
      const rejectedShops = await db.select("shops", "status=eq.rejected&order=created_at.desc");
      const custs = await db.select("customers", "order=created_at.desc");
      const count = await db.count("requests");
      setPending([...(pendingShops||[]), ...(rejectedShops||[])]);
      setLive(liveShops||[]);
      setCustomers(custs||[]);
      setRequestCount(count||0);
    } catch(e) {
      console.error(e);
    }
    setLoading(false);
  }

  useEffect(()=>{ loadAll(); }, []);

  const approve = async (id) => {
    try {
      await db.update("shops", `id=eq.${id}`, { status:"approved" });
      showToast("✅ Shop approved! It's now live for customers.");
      loadAll();
    } catch(e) { showToast("❌ "+e.message, "error"); }
  };
  const reject = async (id) => {
    try {
      await db.update("shops", `id=eq.${id}`, { status:"rejected" });
      showToast("❌ Shop rejected.", "error");
      loadAll();
    } catch(e) { showToast("❌ "+e.message, "error"); }
  };
  const suspend = async (id) => {
    try {
      await db.update("shops", `id=eq.${id}`, { status:"suspended", is_open:false });
      showToast("⛔ Shop suspended.", "error");
      loadAll();
    } catch(e) { showToast("❌ "+e.message, "error"); }
  };
  const restore = async (id) => {
    try {      await db.update("shops", `id=eq.${id}`, { status:"approved", is_open:true });
      showToast("✅ Shop restored.");
      loadAll();
    } catch(e) { showToast("❌ "+e.message, "error"); }
  };
  const blockCustomer = async (id) => {
    try {
      await db.update("customers", `id=eq.${id}`, { status:"blocked" });
      showToast("🚫 Customer blocked.", "error");
      loadAll();
    } catch(e) { showToast("❌ "+e.message, "error"); }
  };
  const unblockCustomer = async (id) => {
    try {
      await db.update("customers", `id=eq.${id}`, { status:"active" });
      showToast("✅ Customer unblocked.");
      loadAll();
    } catch(e) { showToast("❌ "+e.message, "error"); }
  };

  const pendingCount = pending.filter(s=>s.status==="pending").length;
  const liveCount = live.filter(s=>s.status==="approved").length;

  const TABS = [
    {k:"overview",l:"📊 Overview"},
    {k:"pending",l:`⏳ Pending (${pendingCount})`},
    {k:"shops",l:`🏪 Shops (${liveCount})`},
    {k:"customers",l:`👥 Customers (${customers.length})`},
    {k:"categories",l:"🗂 Categories"},
  ];

  return (
    <div style={s.root}>
      {toast && <div style={{...s.toast,background:toast.type==="error"?"#EF4444":"#10B981"}}>{toast.msg}</div>}

      <div style={s.nav}>
        <div style={s.navLeft}>
          <div style={s.navLogo}>⚙️</div>
          <div>
            <div style={s.navBrand}>Lokál Admin Panel</div>
            <div style={s.navUrl}>🟢 Connected to live database</div>
          </div>
        </div>
        <div style={s.navRight}>
          <button style={s.refreshBtn} onClick={loadAll}>🔄 Refresh</button>
          <div style={s.navAlert}>🔔 {pendingCount} pending</div>
          <button style={s.logoutBtn} onClick={onLogout}>Logout</button>
        </div>
      </div>

      <div style={s.layout}>
        <div style={s.sidebar}>
          {TABS.map(t=>(
            <button key={t.k} style={{...s.sideBtn,...(tab===t.k?s.sideBtnA:{})}} onClick={()=>setTab(t.k)}>{t.l}</button>
          ))}
          <div style={s.sideFooter}>
            <div style={s.sideVersion}>Live · Supabase</div>
          </div>
        </div>

        <div style={s.main}>
          {loading && <div style={s.loadingBox}>🔄 Loading live data...</div>}

          {!loading && tab==="overview" && <>
            <div style={s.pageTitle}>📊 Platform Overview</div>
            <div style={s.statsGrid}>
              {[
                {icon:"⏳",label:"Pending Approvals",val:pendingCount,color:"#F59E0B",bg:"#FFFBEB"},
                {icon:"🏪",label:"Live Shops",val:liveCount,color:"#10B981",bg:"#D1FAE5"},
                {icon:"👥",label:"Total Customers",val:customers.length,color:"#4F46E5",bg:"#EEF2FF"},
                {icon:"📋",label:"Total Requests",val:requestCount,color:"#8B5CF6",bg:"#F3E8FF"},
              ].map((st,i)=>(
                <div key={i} style={{...s.overviewStat,background:st.bg}}>
                  <div style={s.overviewStatIcon}>{st.icon}</div>
                  <div style={{...s.overviewStatVal,color:st.color}}>{st.val}</div>
                  <div style={s.overviewStatLabel}>{st.label}</div>
                </div>
              ))}
            </div>
            <div style={s.pageTitle2}>🏆 All Live Shops</div>
            {live.length===0 && <div style={s.emptyMini}>No live shops yet. Approve one from Pending tab!</div>}
            {live.map((sh,i)=>(
              <div key={sh.id} style={s.topShopRow}>
                <div style={s.topShopRank}>#{i+1}</div>
                <div style={s.topShopAv}>{sh.name[0]}</div>
                <div style={{flex:1}}>
                  <div style={s.topShopName}>{sh.name}</div>
                  <div style={s.topShopMeta}>📍 {sh.area} · {CATEGORIES.find(c=>c.id===sh.category)?.icon} {CATEGORIES.find(c=>c.id===sh.category)?.label}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={s.topShopRating}>⭐ {sh.rating||0}</div>
                </div>
              </div>
            ))}
          </>}

          {!loading && tab==="pending" && <>
            <div style={s.pageTitle}>⏳ Pending Shop Approvals</div>
            {pendingCount===0 && pending.length===0 && <div style={s.emptyState}><div style={{fontSize:40}}>🎉</div><div style={s.emptyTitle}>All caught up!</div><div style={s.emptySub}>No pending applications.</div></div>}
            {pending.map(sh=>(
              <div key={sh.id} style={s.shopCard}>
                <div style={s.scTop}>
                  <div style={s.scAv}>{sh.name[0]}</div>
                  <div style={{flex:1}}>
                    <div style={s.scName}>{sh.name}</div>
                    <div style={s.scMeta}>👤 {sh.owner} · 📞 {sh.phone}</div>
                    <div style={s.scLoc}>📍 {sh.area}, {sh.city} · {CATEGORIES.find(c=>c.id===sh.category)?.icon} {CATEGORIES.find(c=>c.id===sh.category)?.label}</div>
                  </div>
                  <div style={s.scTime}>{new Date(sh.created_at).toLocaleDateString()}</div>
                </div>
                <div style={s.scDocs}>
                  <div style={s.scDoc}>📧 {sh.email}</div>
                  <div style={s.scDoc}>📄 GST: <b>{sh.gst||"Not provided"}</b></div>
                  <div style={s.scDoc}>🪪 Aadhaar: <b>{sh.aadhaar||"Not provided"}</b></div>
                </div>
                {sh.status==="pending" && (
                  <div style={s.scActions}>
                    <button style={s.approveBtn} onClick={()=>approve(sh.id)}>✅ Approve & Go Live</button>
                    <button style={s.rejectBtn} onClick={()=>reject(sh.id)}>❌ Reject</button>
                  </div>
                )}
                {sh.status==="rejected" && <div style={s.rejectedBadge}>❌ Application Rejected</div>}
              </div>
            ))}
          </>}

          {!loading && tab==="shops" && <>
            <div style={s.pageHeadRow}>
              <div style={s.pageTitle}>🏪 Live Shops</div>
              <input style={s.searchBox} placeholder="Search shops..." value={search} onChange={e=>setSearch(e.target.value)} />
            </div>
            {live.filter(sh=>sh.name.toLowerCase().includes(search.toLowerCase())||sh.area.toLowerCase().includes(search.toLowerCase())).map(sh=>(
              <div key={sh.id} style={s.shopCard}>
                <div style={s.scTop}>
                  <div style={{...s.scAv,background:"#10B981"}}>{sh.name[0]}</div>
                  <div style={{flex:1}}>
                    <div style={s.scName}>{sh.name} <span style={s.verTag}>✅ Verified</span></div>
                    <div style={s.scMeta}>👤 {sh.owner} · 📞 {sh.phone}</div>
                    <div style={s.scLoc}>📍 {sh.area}, {sh.city} · {CATEGORIES.find(c=>c.id===sh.category)?.icon} {CATEGORIES.find(c=>c.id===sh.category)?.label}</div>
                  </div>
                  <div style={{...s.statusPill,background:sh.is_open?"#D1FAE5":"#FEE2E2",color:sh.is_open?"#059669":"#DC2626"}}>
                    {sh.is_open?"🟢 Live":"🔴 Offline"}
                  </div>
                </div>
                <div style={s.scFooter}>
                  <span>⭐ {sh.rating||0} ({sh.reviews||0} reviews)</span>
                  <span style={{...s.subPill,background:sh.subscription==="Pro"?"#EEF2FF":"#F3F4F6",color:sh.subscription==="Pro"?"#4F46E5":"#6B7280"}}>{sh.subscription}</span>
                  <span>📅 {new Date(sh.created_at).toLocaleDateString()}</span>
                </div>
                <div style={s.scActions}>                  {sh.is_open
                    ? <button style={s.suspendBtn} onClick={()=>suspend(sh.id)}>⛔ Suspend</button>
                    : <button style={s.restoreBtn} onClick={()=>restore(sh.id)}>✅ Restore</button>}
                </div>
              </div>
            ))}
          </>}

          {!loading && tab==="customers" && <>
            <div style={s.pageHeadRow}>
              <div style={s.pageTitle}>👥 Customers</div>
              <input style={s.searchBox} placeholder="Search customers..." value={search} onChange={e=>setSearch(e.target.value)} />
            </div>
            {customers.length===0 && <div style={s.emptyMini}>No customers signed up yet.</div>}
            {customers.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())||c.phone.includes(search)).map(c=>(
              <div key={c.id} style={s.custCard}>
                <div style={s.custTop}>
                  <div style={{...s.custAv,background:c.status==="blocked"?"#EF4444":"#7C3AED"}}>{c.name[0]}</div>
                  <div style={{flex:1}}>
                    <div style={s.custName}>{c.name} {c.status==="blocked"&&<span style={s.blockedTag}>🚫 Blocked</span>}</div>
                    <div style={s.custMeta}>📞 {c.phone} · 📧 {c.email}</div>
                    <div style={s.custMeta}>📍 {c.area}, {c.city} · 📅 {new Date(c.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <div style={s.custActions}>
                  {c.status==="active"
                    ? <button style={s.blockBtn} onClick={()=>blockCustomer(c.id)}>🚫 Block</button>
                    : <button style={s.unblockBtn} onClick={()=>unblockCustomer(c.id)}>✅ Unblock</button>}
                </div>
              </div>
            ))}
          </>}

          {!loading && tab==="categories" && <>
            <div style={s.pageTitle}>🗂 Category Management</div>
            <div style={s.catGrid}>
              {CATEGORIES.map(cat=>(
                <div key={cat.id} style={s.catCard}>
                  <div style={s.catIcon}>{cat.icon}</div>
                  <div style={s.catName}>{cat.label}</div>
                  <div style={s.catShops}>{live.filter(sh=>sh.category===cat.id).length} shops</div>
                </div>
              ))}
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState("login");
  if(screen==="login")     return <Login onSuccess={()=>setScreen("dashboard")} />;
  if(screen==="dashboard") return <Dashboard onLogout={()=>setScreen("login")} />;
  return null;
}

const s = {
  loginPage:{minHeight:"100vh",background:"#0F172A",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Inter',system-ui,sans-serif"},
  loginBox:{background:"#1E293B",borderRadius:20,padding:32,width:"100%",maxWidth:400,border:"1px solid rgba(255,255,255,0.08)"},
  loginLogo:{fontSize:44,textAlign:"center",marginBottom:6},
  loginBrand:{fontWeight:900,fontSize:26,color:"#fff",textAlign:"center",letterSpacing:"-0.5px",marginBottom:2},
  loginUrl:{textAlign:"center",color:"#64748B",fontSize:12,marginBottom:20},
  loginWarning:{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",color:"#FCA5A5",fontSize:12,fontWeight:600,padding:"8px 12px",borderRadius:8,marginBottom:20,textAlign:"center"},
  loginForm:{},
  lbl:{display:"block",fontWeight:700,fontSize:13,color:"#94A3B8",marginBottom:5},
  inp:{width:"100%",boxSizing:"border-box",background:"#0F172A",border:"1.5px solid #334155",borderRadius:8,padding:"11px 12px",fontSize:14,marginBottom:14,outline:"none",color:"#fff",fontFamily:"inherit"},
  eyeBtn:{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16,marginTop:-7},
  errBox:{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",color:"#FCA5A5",fontSize:13,padding:"8px 12px",borderRadius:8,marginBottom:12},
  loginBtn:{width:"100%",background:"#4F46E5",color:"#fff",border:"none",padding:"13px",borderRadius:10,fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"inherit"},
  loginHint:{textAlign:"center",color:"#475569",fontSize:12,marginTop:12},
  root:{fontFamily:"'Inter',system-ui,sans-serif",background:"#F1F5F9",minHeight:"100vh"},
  toast:{position:"fixed",top:16,right:16,zIndex:999,color:"#fff",fontWeight:700,fontSize:13,padding:"10px 18px",borderRadius:10,boxShadow:"0 4px 16px rgba(0,0,0,0.2)"},
  nav:{background:"#0F172A",padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10},
  navLeft:{display:"flex",alignItems:"center",gap:12},
  navLogo:{fontSize:28},
  navBrand:{fontWeight:900,fontSize:16,color:"#fff"},
  navUrl:{fontSize:11,color:"#4ADE80"},
  navRight:{display:"flex",alignItems:"center",gap:10},
  refreshBtn:{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.8)",fontSize:12,padding:"5px 12px",borderRadius:8,cursor:"pointer"},
  navAlert:{background:"rgba(245,158,11,0.2)",color:"#FCD34D",fontSize:12,fontWeight:700,padding:"4px 12px",borderRadius:20},
  logoutBtn:{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.6)",fontSize:12,padding:"5px 12px",borderRadius:8,cursor:"pointer"},
  layout:{display:"flex",minHeight:"calc(100vh - 54px)"},
  sidebar:{width:200,background:"#fff",borderRight:"1px solid #E2E8F0",display:"flex",flexDirection:"column",flexShrink:0},
  sideBtn:{background:"none",border:"none",padding:"12px 16px",fontSize:13,fontWeight:600,cursor:"pointer",color:"#64748B",textAlign:"left",borderLeft:"3px solid transparent",fontFamily:"inherit"},
  sideBtnA:{color:"#4F46E5",background:"#EEF2FF",borderLeft:"3px solid #4F46E5"},
  sideFooter:{marginTop:"auto",padding:"16px",borderTop:"1px solid #F1F5F9"},
  sideVersion:{fontSize:11,color:"#10B981",fontWeight:700},
  main:{flex:1,padding:"20px",overflowY:"auto",maxWidth:800},
  loadingBox:{textAlign:"center",padding:60,color:"#9CA3AF",fontSize:14},
  pageTitle:{fontWeight:900,fontSize:20,marginBottom:16,letterSpacing:"-0.3px"},
  pageTitle2:{fontWeight:800,fontSize:16,margin:"24px 0 12px"},
  pageHeadRow:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,gap:12,flexWrap:"wrap"},
  searchBox:{border:"1.5px solid #E2E8F0",borderRadius:8,padding:"8px 12px",fontSize:13,outline:"none",width:200,fontFamily:"inherit"},
  statsGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:12,marginBottom:8},
  overviewStat:{borderRadius:14,padding:"16px 14px",textAlign:"center",border:"1px solid rgba(0,0,0,0.05)"},
  overviewStatIcon:{fontSize:24,marginBottom:6},
  overviewStatVal:{fontWeight:900,fontSize:24,marginBottom:4},
  overviewStatLabel:{fontSize:11,color:"#6B7280",fontWeight:600},
  emptyMini:{color:"#9CA3AF",fontSize:13,padding:"16px 0"},
  topShopRow:{background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,padding:"12px 14px",display:"flex",alignItems:"center",gap:10,marginBottom:8},
  topShopRank:{fontWeight:900,fontSize:18,color:"#9CA3AF",width:28},
  topShopAv:{width:36,height:36,borderRadius:10,background:"#10B981",color:"#fff",fontWeight:900,fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  topShopName:{fontWeight:800,fontSize:14,marginBottom:2},
  topShopMeta:{fontSize:12,color:"#9CA3AF"},
  topShopRating:{fontSize:12,color:"#F59E0B",fontWeight:700},
  shopCard:{background:"#fff",border:"1px solid #E2E8F0",borderRadius:14,padding:16,marginBottom:12},
  scTop:{display:"flex",alignItems:"flex-start",gap:12,marginBottom:12},
  scAv:{width:44,height:44,borderRadius:12,background:"#4F46E5",color:"#fff",fontWeight:900,fontSize:20,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  scName:{fontWeight:800,fontSize:15,marginBottom:3},
  scMeta:{fontSize:12,color:"#6B7280",marginBottom:2},
  scLoc:{fontSize:12,color:"#4F46E5",fontWeight:600},
  scTime:{fontSize:11,color:"#9CA3AF",whiteSpace:"nowrap"},
  scDocs:{display:"flex",gap:14,flexWrap:"wrap",marginBottom:12},
  scDoc:{fontSize:12,color:"#374151"},
  scFooter:{display:"flex",gap:12,flexWrap:"wrap",fontSize:12,color:"#6B7280",marginBottom:10,alignItems:"center"},
  scActions:{display:"flex",gap:8,flexWrap:"wrap"},
  approveBtn:{background:"#10B981",color:"#fff",border:"none",padding:"9px 14px",borderRadius:8,fontWeight:800,cursor:"pointer",fontSize:13,fontFamily:"inherit"},
  rejectBtn:{background:"#FEE2E2",color:"#DC2626",border:"none",padding:"9px 14px",borderRadius:8,fontWeight:800,cursor:"pointer",fontSize:13,fontFamily:"inherit"},
  suspendBtn:{background:"#FEE2E2",color:"#DC2626",border:"none",padding:"7px 12px",borderRadius:8,fontWeight:700,cursor:"pointer",fontSize:12,fontFamily:"inherit"},
  restoreBtn:{background:"#D1FAE5",color:"#059669",border:"none",padding:"7px 12px",borderRadius:8,fontWeight:700,cursor:"pointer",fontSize:12,fontFamily:"inherit"},
  rejectedBadge:{background:"#FEE2E2",color:"#DC2626",fontWeight:800,fontSize:13,padding:"10px",borderRadius:8,textAlign:"center"},
  verTag:{fontSize:11,color:"#059669",fontWeight:700},
  statusPill:{fontSize:11,fontWeight:800,padding:"4px 10px",borderRadius:20},
  subPill:{fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:20},
  custCard:{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:14,marginBottom:10},
  custTop:{display:"flex",gap:10,marginBottom:12},
  custAv:{width:40,height:40,borderRadius:10,color:"#fff",fontWeight:900,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  custName:{fontWeight:800,fontSize:14,marginBottom:3},
  custMeta:{fontSize:12,color:"#9CA3AF",marginBottom:2},
  custActions:{display:"flex",gap:8},
  blockBtn:{background:"#FEE2E2",color:"#DC2626",border:"none",padding:"7px 12px",borderRadius:8,fontWeight:700,cursor:"pointer",fontSize:12,fontFamily:"inherit"},
  unblockBtn:{background:"#D1FAE5",color:"#059669",border:"none",padding:"7px 12px",borderRadius:8,fontWeight:700,cursor:"pointer",fontSize:12,fontFamily:"inherit"},
  blockedTag:{background:"#FEE2E2",color:"#DC2626",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,marginLeft:6},
  catGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:10,marginBottom:16},
  catCard:{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:14,textAlign:"center"},
  catIcon:{fontSize:26,marginBottom:6},
  catName:{fontWeight:800,fontSize:12,marginBottom:4},
  catShops:{background:"#EEF2FF",color:"#4F46E5",fontSize:11,fontWeight:700,padding:"3px 8px",borderRadius:20,display:"inline-block"},
  emptyState:{textAlign:"center",padding:"48px 20px",background:"#fff",borderRadius:14,border:"1px solid #E2E8F0"},
  emptyTitle:{fontWeight:800,fontSize:18,marginBottom:6},
  emptySub:{color:"#9CA3AF",fontSize:14},
};
