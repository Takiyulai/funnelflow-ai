const ts=require("typescript"),fs=require("fs");
const files=[["lib/funnels/types.ts",ts.ScriptKind.TS],["components/funnel/FunnelPreview.tsx",ts.ScriptKind.TSX]];
for(const [f,kind] of files){
  const src=fs.readFileSync(f,"utf8");
  const sf=ts.createSourceFile(f,src,ts.ScriptTarget.Latest,true,kind);
  const d=(sf.parseDiagnostics||[]);
  console.log((d.length?"ERR ":"OK ")+f+" ("+src.split("\n").length+"L)"+(d.length?" @L"+(sf.getLineAndCharacterOfPosition(d[0].start).line+1):""));
}
