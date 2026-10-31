"use client";
import { useEffect, useMemo, useState } from "react";
import { WorkflowCanvas } from "@/components/workflow-canvas";
import type { AcpNodeData } from "@/components/workflow-canvas";
import type { Node, Edge } from "@xyflow/react";
import { Upload, Sparkles, FileText, Workflow, ShieldCheck, TestTube2, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
async function api(path:string, init?:RequestInit) {
  const res = await fetch(`${API}${path}`, init);
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(typeof data.detail==="string"?data.detail:JSON.stringify(data.detail||data));
  return data;
}
type Project={id:string;name:string;domain:string;status:string};
type Requirement={id:string;code:string;title:string;description:string;category:string;status:string;confidence:number;field?:string;operator?:string;value?:unknown;clarification_question?:string};
type Artifact={id:string;type:string;name:string;version:number;status:string;payload:any};
const initialNodes:Node<AcpNodeData>[]=[
 {id:"intake",position:{x:0,y:0},data:{label:"Business brief",subtitle:"Source requirements",kind:"user_prompt"}},
 {id:"extract",position:{x:260,y:0},data:{label:"Requirement extraction",subtitle:"Structured + traceable",kind:"agent"}},
 {id:"clarify",position:{x:520,y:0},data:{label:"Clarification gate",subtitle:"Resolve ambiguity",kind:"condition"}},
 {id:"design",position:{x:780,y:0},data:{label:"Solution design",subtitle:"Workflow + mappings",kind:"transform"}},
 {id:"validate",position:{x:1040,y:0},data:{label:"Validation & tests",subtitle:"Positive / negative / edge",kind:"mcp"}},
];
const initialEdges:Edge[]=[{id:"e1",source:"intake",target:"extract",animated:true},{id:"e2",source:"extract",target:"clarify"},{id:"e3",source:"clarify",target:"design"},{id:"e4",source:"design",target:"validate"}];

export default function Home(){
 const [project,setProject]=useState<Project|null>(null),[requirements,setRequirements]=useState<Requirement[]>([]),[artifacts,setArtifacts]=useState<Artifact[]>([]);
 const [tab,setTab]=useState("overview"),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 const [nodes,setNodes]=useState(initialNodes),[edges,setEdges]=useState(initialEdges);
 const [file,setFile]=useState<File|null>(null);
 const unresolved=useMemo(()=>requirements.filter(r=>r.status!=="confirmed"),[requirements]);
 async function refresh(id:string){setRequirements(await api(`/projects/${id}/requirements`));setArtifacts(await api(`/projects/${id}/artifacts`));}
 async function action(fn:()=>Promise<void>){setBusy(true);setError("");setMessage("");try{await fn()}catch(e){setError(e instanceof Error?e.message:"Request failed")}finally{setBusy(false)}}
 async function seed(){await action(async()=>{const d=await api("/demo/seed",{method:"POST"});const p=await api(`/projects/${d.project_id}`);setProject(p);await refresh(p.id);setMessage(`Loaded ${d.requirements_count} synthetic requirements; ${d.unresolved_count} needs clarification.`)})}
 async function upload(){if(!project||!file)return;await action(async()=>{const body=new FormData();body.append("file",file);const d=await api(`/projects/${project.id}/documents`,{method:"POST",body});const extracted=await api(`/projects/${project.id}/documents/${d.document_id}/extract-requirements`,{method:"POST"});await refresh(project.id);setMessage(`Uploaded ${d.filename}; extracted ${extracted.count} requirements.`);setFile(null)})}
 async function generate(){if(!project)return;await action(async()=>{const d=await api(`/projects/${project.id}/generate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({include_mappings:true,include_api_contract:true})});await refresh(project.id);setMessage(`Generated ${d.count} implementation artefacts.`);setTab("artifacts")})}
 async function validate(){if(!project)return;await action(async()=>{const d=await api(`/projects/${project.id}/validate`,{method:"POST"});setMessage(`Validation ${d.status}: ${d.summary.issues} issue(s).`)})}
 async function genTests(){if(!project)return;await action(async()=>{const d=await api(`/projects/${project.id}/tests/generate`,{method:"POST"});setMessage(`Generated ${d.count} test cases.`)})}
 async function runTests(){if(!project)return;await action(async()=>{const d=await api(`/projects/${project.id}/tests/run`,{method:"POST"});setMessage(`Test run: ${d.passed} passed, ${d.failed} failed.`)})}
 async function clarify(r:Requirement){if(!project)return;const answer=window.prompt(r.clarification_question||"Clarify this requirement");if(!answer)return;await action(async()=>{await api(`/projects/${project.id}/requirements/${r.id}/clarification`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({answer})});await refresh(project.id);setMessage(`Clarification recorded for ${r.code}.`)})}
 useEffect(()=>{api("/projects").then((ps:Project[])=>{if(ps?.length){setProject(ps[0]);refresh(ps[0].id).catch(()=>{})}}).catch(()=>{})},[]);
 return <main className="shell">
  <aside className="sidebar"><div className="brand"><div className="brand-icon">✳</div><div><b>IMPLEMENT</b><small>AI STUDIO</small></div></div><div className="side-label">WORKSPACE</div>
   {[["overview","Overview"],["requirements","Requirements"],["workflow","Workflow canvas"],["artifacts","Implementation artefacts"],["tests","Validation & tests"]].map(([k,v])=><button key={k} className={tab===k?"side active":"side"} onClick={()=>setTab(k)}>{v}</button>)}
   <div className="side-bottom"><span className="online"/> Python API · local</div>
  </aside>
  <section className="main"><header><span>Implementation Studio / {project?.name||"New workspace"}</span><button className="ghost" onClick={()=>project&&refresh(project.id)}><RefreshCw size={14}/> Refresh</button></header>
   <div className="content"><div className="heading"><div><div className="eyebrow">REQUIREMENTS → DESIGN → VALIDATION → HANDOFF</div><h1>{project?.name||"AI Implementation Studio"}</h1><p>Turn business intent into traceable, reviewable and testable implementation packages.</p></div>{!project&&<button className="primary" disabled={busy} onClick={seed}><Sparkles size={15}/> Load synthetic demo</button>}</div>
    {(message||error||busy)&&<div className={error?"feedback error":"feedback"}>{error||message||"Working…"}</div>}
    <div className="stats"><div><small>Requirements</small><b>{requirements.length||"—"}</b></div><div><small>Need clarification</small><b>{unresolved.length||0}</b></div><div><small>Artefacts</small><b>{artifacts.length||0}</b></div><div><small>Confirmed</small><b>{requirements.filter(r=>r.status==="confirmed").length||0}</b></div></div>
    <nav>{[["overview","Overview"],["requirements","Requirements"],["workflow","Workflow canvas"],["artifacts","Artefacts"],["tests","Tests"]].map(([k,v])=><button className={tab===k?"tab selected":"tab"} onClick={()=>setTab(k)} key={k}>{v}</button>)}</nav>
    {tab==="overview"&&<div className="grid"><section className="panel"><h2>Implementation pipeline</h2><p className="muted">A controlled pipeline from source brief to validated handoff.</p><div className="pipeline">{["Source brief","Extract requirements","Resolve ambiguity","Generate design","Validate & test","Approve handoff"].map((s,i)=><div className="step" key={s}><span>{String(i+1).padStart(2,"0")}</span><b>{s}</b></div>)}</div><div className="actions"><button className="primary" onClick={seed} disabled={busy}><Sparkles size={14}/> Load demo</button><button onClick={()=>setTab("requirements")}>Review requirements</button><button onClick={generate} disabled={!project||busy}>Generate artefacts</button></div></section><section className="panel"><h2>Source brief</h2><p className="muted">Upload a PDF, DOCX, TXT or Markdown brief to extract structured requirements.</p><input type="file" accept=".pdf,.docx,.txt,.md" onChange={e=>setFile(e.target.files?.[0]||null)}/><button className="primary" disabled={!project||!file||busy} onClick={upload}><Upload size={14}/> Upload brief</button><div className="callout"><AlertTriangle size={15}/> Ambiguous requirements remain blocked until clarified. Generated output is marked as proposed until reviewed.</div></section></div>}
    {tab==="requirements"&&<section className="panel"><div className="panel-head"><div><h2>Structured requirements</h2><p className="muted">Every item retains its source excerpt, confidence and resolution state.</p></div><button onClick={generate} disabled={!project||busy}>Generate from requirements</button></div>{requirements.map(r=><article className="requirement" key={r.id}><div><span className="code">{r.code}</span><span className={r.status==="confirmed"?"status good":"status warn"}>{r.status.replaceAll("_"," ")}</span><h3>{r.title}</h3><p>{r.description}</p>{r.clarification_question&&<p className="question">Clarification: {r.clarification_question}</p>}<small>{r.category} · confidence {(r.confidence*100).toFixed(0)}%</small></div>{r.status!=="confirmed"&&<button onClick={()=>clarify(r)}>Resolve</button>}</article>)}</section>}
    {tab==="workflow"&&<section className="panel canvas-panel"><div className="panel-head"><div><h2>Implementation workflow</h2><p className="muted">Visual orchestration canvas · drag, connect, arrange and inspect nodes.</p></div><button className="primary" onClick={generate} disabled={!project||busy}><Sparkles size={14}/> Generate design</button></div><div className="canvas"><WorkflowCanvas initialNodes={nodes} initialEdges={edges} onChange={(n,e)=>{setNodes(n);setEdges(e)}} onRun={validate} runLabel="Validate implementation" runDisabled={!project||busy}/></div></section>}
    {tab==="artifacts"&&<section className="panel"><div className="panel-head"><div><h2>Implementation artefacts</h2><p className="muted">Versioned, requirement-linked output.</p></div><button className="primary" onClick={generate} disabled={!project||busy}>Generate artefacts</button></div>{artifacts.map(a=><article className="artifact" key={a.id}><div><span className="code">{a.type}</span><h3>{a.name}</h3><small>Version {a.version} · {a.status}</small></div><pre>{JSON.stringify(a.payload,null,2)}</pre></article>)}</section>}
    {tab==="tests"&&<section className="panel"><h2>Validation & test generation</h2><p className="muted">Generate positive, negative and boundary cases from confirmed requirements, then run the deterministic demo executor.</p><div className="actions"><button onClick={genTests} disabled={!project||busy}><TestTube2 size={14}/> Generate tests</button><button className="primary" onClick={runTests} disabled={!project||busy}>Run tests</button><button onClick={validate} disabled={!project||busy}><ShieldCheck size={14}/> Validate artefacts</button></div><div className="callout"><CheckCircle2 size={15}/> Test execution is synthetic in this MVP; no external banking systems are called.</div></section>}
   </div>
  </section>
 </main>
}
