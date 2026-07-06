const ts=require("typescript"),fs=require("fs");
const files=["lib/rate-limit.ts","components/funnel/CreateFunnelWizard.tsx"];
let bad=0;
for(const f of files){
  const o=ts.transpileModule(fs.readFileSync(f,"utf8"),{reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}});
  const e=(o.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  if(e.length){bad++;console.log("ERRORS "+f);e.forEach(d=>console.log("  "+ts.flattenDiagnosticMessageText(d.messageText,"\n")));}
  else console.log("OK "+f);
}
process.exit(bad?1:0);
