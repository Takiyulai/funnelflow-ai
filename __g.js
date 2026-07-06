const ts=require("typescript"),fs=require("fs");
const files=[
 ["lib/billing/planGate.ts",ts.ScriptKind.TS],
 ["components/crm/SequencesClient.tsx",ts.ScriptKind.TSX],
 ["components/workflows/WorkflowsClient.tsx",ts.ScriptKind.TSX],
 ["app/(app)/import/page.tsx",ts.ScriptKind.TSX],
 ["components/editor/SectionRegenPanel.tsx",ts.ScriptKind.TSX],
];
for(const [f,kind] of files){
  const src=fs.readFileSync(f,"utf8");const total=src.split("\n").length;
  const sf=ts.createSourceFile(f,src,ts.ScriptTarget.Latest,true,kind);
  const d=sf.parseDiagnostics||[];
  if(d.length){const p=sf.getLineAndCharacterOfPosition(d[0].start);console.log("ERR "+f+" @L"+(p.line+1)+"/"+total+" "+ts.flattenDiagnosticMessageText(d[0].messageText,"\n"));}
  else console.log("OK "+f+" ("+total+"L)");
}
