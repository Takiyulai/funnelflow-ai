const ts=require("typescript"),fs=require("fs");
const files=[
 ["lib/funnels/types.ts",ts.ScriptKind.TS],
 ["components/funnel/FunnelPreview.tsx",ts.ScriptKind.TSX],
 ["components/editor/GlobalStylePanel.tsx",ts.ScriptKind.TSX],
];
let bad=0;
for(const [f,kind] of files){
  const src=fs.readFileSync(f,"utf8");
  const sf=ts.createSourceFile(f,src,ts.ScriptTarget.Latest,true,kind);
  const d=sf.parseDiagnostics||[];
  if(d.length){bad++;console.log("ERR "+f);d.slice(0,4).forEach(x=>{const p=sf.getLineAndCharacterOfPosition(x.start);console.log("  L"+(p.line+1)+" "+ts.flattenDiagnosticMessageText(x.messageText,"\n"));});}
  else console.log("OK "+f+" ("+src.split("\n").length+"L)");
}
process.exit(bad?1:0);
