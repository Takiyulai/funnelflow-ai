const ts=require("typescript"),fs=require("fs");
const files=[["lib/rate-limit.ts",ts.ScriptKind.TS],["components/funnel/CreateFunnelWizard.tsx",ts.ScriptKind.TSX]];
let bad=0;
for(const [f,kind] of files){
  const src=fs.readFileSync(f,"utf8");
  const sf=ts.createSourceFile(f,src,ts.ScriptTarget.Latest,true,kind);
  const diags=sf.parseDiagnostics||[];
  if(diags.length){bad++;console.log("SYNTAX ERRORS "+f);
    diags.slice(0,8).forEach(d=>{const p=sf.getLineAndCharacterOfPosition(d.start);console.log("  L"+(p.line+1)+":"+(p.character+1)+" "+ts.flattenDiagnosticMessageText(d.messageText,"\n"));});
  } else console.log("OK "+f);
}
process.exit(bad?1:0);
